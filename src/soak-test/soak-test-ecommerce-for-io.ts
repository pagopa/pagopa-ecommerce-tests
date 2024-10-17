import { check, fail, sleep} from "k6";
import http from "k6/http";
import { getConfigOrThrow } from "../utils/config";
import { generateRptId, PaymentMethod, paymentMethodIds } from "../common/soak-test-common";
import { uuid } from "../utils/utils";
const config = getConfigOrThrow();
export let options = {
    scenarios: {
      contacts: {
        executor: 'ramping-arrival-rate',
        startRate: 0,
        timeUnit: '1s',
        preAllocatedVUs: config.preAllocatedVUs,
        maxVUs: config.maxVUs,
        stages: [
          { target: config.rate, duration: config.rampingDuration },
          { target: config.rate, duration: config.duration },
          { target: 0, duration: config.rampingDuration },
        ],
      },
    },

    thresholds: {
        http_req_duration: ["p(95)<=250"], 
        checks: ['rate>0.9'], 
        "http_req_duration{name:activate-transaction}": ["p(95)<=250"],
        "http_req_duration{name:auth-request}": ["p(95)<=250"],
        "http_req_duration{name:get-user-stats}": ["p(95)<=250"],
    },
};
const urlBasePath = "https://weuuat.ecommerce.internal.uat.platform.pagopa.it"

export default function () {
    const randomUUID =  uuid();
    const rptId = generateRptId();
    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'x-client-id': 'IO',
            'x-correlation-id': randomUUID,
            'x-user-id': randomUUID,
            'x-pgs-id': "REDIRECT",
        }
    };
    /* transaction activation */
    const newTransactionRequest = {
        paymentNotices: [
            {
                rptId: rptId,
                amount: 120000
            }
    
        ],
        emailToken: randomUUID,
        orderId: "E1729083167537t611"
    }
    let url = `${urlBasePath}/beta/pagopa-ecommerce-transactions-service/v2.1/transactions`;
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
    /* request transaction authorization */
    const responseBody = response.json() as any;
    const transactionId = responseBody.transactionId;
    const authorizationRequest = {
        amount: responseBody.payments[0].amount,
        fee: 150,
        pspId: "PPAYITR1XXX",
        language: "IT",
        paymentInstrumentId: paymentMethodIds[PaymentMethod.REDIRECT_RPIC],
        details: {
            detailType: "redirect",
        },
        isAllCCP: responseBody.payments[0].isAllCCP
    }
    url = `${urlBasePath}/beta/pagopa-ecommerce-transactions-service/transactions/${transactionId}/auth-requests`;
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
    //wait for user stats to be propagated before getting it
    sleep(3)
    /* GET user last payment method used */
    url = `${urlBasePath}/pagopa-ecommerce-user-stats-service/user/lastPaymentMethodUsed`;
    response = http.get(url, {
        ...headersParams,
        tags: { name: "get-user-stats" },
        timeout: '10s'
    });

    check(
        response,
        { "Response status from GET /user/lastPaymentMethodUsed was 200": (r) => r.status == 200 },
        { name: "get-user-stats" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error into GET /user/lastPaymentMethodUsed  ${response.status} - ${JSON.stringify(response.body)}`);
    }

    
}
