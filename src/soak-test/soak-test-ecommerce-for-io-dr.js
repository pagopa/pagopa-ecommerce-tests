import { check, fail, sleep } from "k6";
import http from "k6/http";
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ============================================================
// CONFIGURATION
// ============================================================
// Notice code prefix used to build fake RPT IDs for test payments
const noticeCodePrefix = __ENV.NOTICE_CODE_PREFIX || "302001";


// k6 run \
//   -e rate=1 \
//   -e rampingDuration=1m \
//   -e duration=10m \
//   dr-load-test.js

// Base path kept for reference / future use if endpoints move to a
// configurable host instead of the hardcoded ones below
const urlBasePath = __ENV.URL_BASE_PATH || "https://api.uat.platform.pagopa.it";

// VU pool sizing for the ramping-arrival-rate executor
const preAllocatedVUs = __ENV.preAllocatedVUs ? parseInt(__ENV.preAllocatedVUs) : 1;
const maxVUs = __ENV.maxVUs ? parseInt(__ENV.maxVUs) : 2;

// Target request rate (requests/iterations per second) during the steady-state phase
const rate = __ENV.rate ? parseInt(__ENV.rate) : 2;

// How long it takes to ramp up/down to/from the target rate
const rampingDuration = __ENV.rampingDuration || "1m";

// How long the STEADY-STATE (constant traffic) phase lasts.
// This is the phase that actually matters for DR testing: it's the
// window during which traffic must stay constant so the recovery
// procedure can be exercised under stable load.
// Default profile: 1m ramp-up + 10m constant traffic + 1m ramp-down = 12m total.
const duration = __ENV.duration || "10m";

// ============================================================
// TEST OPTIONS
// ============================================================
export let options = {
    scenarios: {
        contacts: {
            executor: 'ramping-arrival-rate',
            startRate: 0,
            timeUnit: '1s',
            preAllocatedVUs: preAllocatedVUs,
            maxVUs: maxVUs,
            stages: [
                // Ramp-up: gradually increase load to the target rate
                { target: rate, duration: rampingDuration },
                // Steady-state / plateau: KEEP TRAFFIC CONSTANT here.
                // This is the phase to align with the DR failover window.
                { target: rate, duration: duration },
                // Ramp-down: gradually bring load back to zero
                { target: 0, duration: rampingDuration },
            ],
        },
    },

    thresholds: {
        http_req_duration: ["p(95)<=1000"],
        checks: ['rate>0.9']
    },
};

// ============================================================
// TEST DATA / CONSTANTS
// ============================================================
// Left empty on purpose: an empty userId/userEmail is used to run the
// flow as a "guest"/anonymous test user, which also avoids attaching
// a real email address to the session.
const userId = "";
const userEmail = "";

const pspId = "BCITITMM";
const paymentMethodId = "0d1450f4-b993-4f89-af5a-1770a45f5d71";

// ============================================================
// HELPERS
// ============================================================

// Builds a random-but-valid-looking RPT ID (notice code) for each transaction,
// so that every iteration hits the backend with a distinct payment notice.
function generateRptId() {
    let result = '77777777777' + noticeCodePrefix;
    for (let i = 0; i < 12; i++) {
        result = result.concat((Math.floor(Math.random() * 10)).toString());
    }
    return result;
}

function uuid() {
    return uuidv4().toString();
}

// ============================================================
// MAIN SCENARIO
// ============================================================
export default function () {
    const randomUUID = uuid();

    /* ---------------------------------------------------------
     * STEP 1 - Create session
     * -----------------------------------------------------------
     * NOTE ON EMAIL NOTIFICATIONS:
     * userEmail is intentionally left empty above, which should
     * prevent the backend from having an address to send any
     * notification to.
     * --------------------------------------------------------- */
    const sessionHeaders = {
        headers: {
            'Content-Type': 'application/json',
        }
    };
    const sessionRequestBody = {
        userId: userId,
        expiryInMinutes: 60,
        userEmail: userEmail,
        usePDV: true,
    };

    let sessionResponse = http.post(`${urlBasePath}/session-wallet/mock/v1/session`, JSON.stringify(sessionRequestBody), {
        ...sessionHeaders,
        tags: { name: "create-session" },
        timeout: '10s'
    });

    check(
        sessionResponse,
        { "Response status from POST /session was 201": (r) => r.status == 201 },
        { name: "create-session" }
    );

    if (sessionResponse.status != 201 || sessionResponse.json() == null) {
        fail(`Error into create session request ${sessionResponse.status} - ${JSON.stringify(sessionResponse.body)}`);
    }

    const sessionResponseBody = sessionResponse.json();
    const token = sessionResponseBody.token;

    const rptId = generateRptId();
    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
        }
    };

    /* ---------------------------------------------------------
     * STEP 2 - Transaction activation
     * --------------------------------------------------------- */
    const newTransactionRequest = {
        paymentNotices: [
            {
                rptId: rptId,
                amount: 120000
            }
        ]
    };

    let url = `${urlBasePath}/ecommerce/io/v2/transactions`;
    let response = http.post(url, JSON.stringify(newTransactionRequest), {
        ...headersParams,
        tags: { name: "activate-transaction" },
        timeout: '10s'
    });

    check(
        response,
        { "Response status from POST /transactions was 200": (r) => r.status == 200 },
        { name: "activate-transaction" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error into activation request ${response.status} - ${JSON.stringify(response.body)}`);
    }

    const postTransactionResponseBody = response.json();
    const transactionId = postTransactionResponseBody.transactionId;

    /* ---------------------------------------------------------
     * STEP 3 - Authorization request
     * --------------------------------------------------------- */
    const authorizationRequest = {
        amount: postTransactionResponseBody.payments[0].amount,
        fee: "100",
        pspId: pspId,
        language: "IT",
        paymentInstrumentId: paymentMethodId,
        details: {
            detailType: "wallet",
            walletId: "8da54661-7fd5-4621-a023-79bcf42fabc4"
        },
        isAllCCP: postTransactionResponseBody.payments[0].isAllCCP
    };

    url = `${urlBasePath}/ecommerce/io/v2/transactions/${transactionId}/auth-requests`;
    response = http.post(url, JSON.stringify(authorizationRequest), {
        ...headersParams,
        tags: { name: "auth-request" },
        timeout: '10s'
    });

    check(
        response,
        { "Response status from POST /transactions/auth-request was 200": (r) => r.status == 200 },
        { name: "auth-request" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error into POST auth-request ${response.status} - ${JSON.stringify(response.body)}`);
    }

    const authResponseBody = response.json();
    const authorizationUrl = authResponseBody.authorizationUrl;

    /* ---------------------------------------------------------
     * STEP 4 - Follow the redirect to the authorization URL, if present
     * --------------------------------------------------------- */
    if (authorizationUrl) {
        let authUrlResponse = http.get(authorizationUrl, {
            tags: { name: "get-authorization-url" },
            timeout: '10s'
        });
        check(
            authUrlResponse,
            { "Response status from GET authorizationUrl was 200": (r) => r.status == 200 },
            { name: "get-authorization-url" }
        );
    }


}