import { check, fail, JSONObject } from "k6";
import http from "k6/http";

// TO BE CONFIGURED
const config = {
    preAllocatedVUs: 50,
    maxVUs: 10000,
    rate: 50,
    rampingDuration: '10m',
    duration: '1h',
    URL_BASE_PATH: 'https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-payment-methods-handler',
    // Base path for session APIs (with /beta prefix in UAT)
    SESSIONS_BASE_PATH: 'https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-payment-methods-handler',
    API_KEY: 'TO_UPDATE_WITH_A_VALID_API_KEY',
    // Payment method ID for CARDS
    PAYMENT_METHOD_ID: '378d0b4f-8b69-46b0-8215-07785fe1aad4',
}

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
        http_req_duration: ["p(95)<500"],
        checks: ['rate>0.9'], // 90% of the request must be completed
        "http_req_duration{name:retrieve-all-payment-methods}": ["p(95)<250"],
        "http_req_duration{name:get-single-payment-method-test}": ["p(95)<250"],
        "http_req_duration{name:create-session}": ["p(95)<500"],
        "http_req_duration{name:get-session}": ["p(95)<500"],
        "http_req_duration{name:update-session}": ["p(95)<250"],
    },
};

export default function () {
    const urlBasePath = config.URL_BASE_PATH;
    const paymentMethodId = config.PAYMENT_METHOD_ID;

    const handlerHeaders = {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.API_KEY,
            'x-client-id': 'CHECKOUT',
        },
    };

    // =========================================================================
    // Step 1: POST /payment-methods — Retrieve all payment methods
    // =========================================================================
    const bodyRetrievePaymentMethodRequest = {
        userTouchpoint: "CHECKOUT",
        userDevice: "WEB",
        totalAmount: 15050,
        paymentNotice: [
            {
                paymentAmount: 15050,
                primaryCreditorInstitution: "77777777777",
                transferList: [
                    {
                        creditorInstitution: "77777777777",
                        transferCategory: "TAX",
                        digitalStamp: false
                    }
                ]
            }
        ],
        "allCCp": false
    }

    const url = `${urlBasePath}/payment-methods`;
    const response = http.post(url, JSON.stringify(bodyRetrievePaymentMethodRequest), {
        ...handlerHeaders,
        tags: { name: "retrieve-all-payment-methods" },
    });

    check(
        response,
        { "Response status from POST /payment-methods to retrieve payment methods was 200": (r) => r.status == 200 },
        { name: "retrieve-all-payment-methods" }
    );

    if (response.status == 200) {

        const paymentMethods = (response.json() as JSONObject)["paymentMethods"];

        if (paymentMethods && Array.isArray(paymentMethods) && paymentMethods.length > 0) {

            const retrievedPaymentMethodId = (paymentMethods[0] as JSONObject)["id"];

            const retrieveSinglePaymentMethodHeadersParams = {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.API_KEY,
                    'x-client-id': 'CHECKOUT'
                },  
            };

            const urlGetPaymentMethod = `${urlBasePath}/payment-methods/${retrievedPaymentMethodId}`;
            const responseGetPaymentMethod = http.get(urlGetPaymentMethod, {
                ...retrieveSinglePaymentMethodHeadersParams,
                tags: { name: "get-single-payment-method-test" }
            });

            check(
                responseGetPaymentMethod,
                { "Response status from GET /payment-methods/{id} was 200": (r) => r.status == 200 },
                { name: "get-single-payment-method-test" }
            );

        } else {
            fail('Error invalid payment methods list');
        }

    } else {
        fail('Error retrieve all payment methods');
    }

    // =========================================================================
    // Step 2: POST /payment-methods/{id}/sessions — Create NPG session
    // =========================================================================
    const sessionsBasePath = config.SESSIONS_BASE_PATH;
    const createSessionUrl = `${sessionsBasePath}/payment-methods/${paymentMethodId}/sessions`;
    const createSessionResponse = http.post(createSessionUrl, JSON.stringify({}), {
        ...handlerHeaders,
        tags: { name: "create-session" },
        timeout: '10s',
    });

    check(
        createSessionResponse,
        { "Response status from POST /sessions was 200": (r) => r.status == 200 },
        { name: "create-session" }
    );

    if (createSessionResponse.status != 200 || createSessionResponse.json() == null) {
        fail(`Error during createSession: status=${createSessionResponse.status}`);
    }

    const sessionJson = createSessionResponse.json() as JSONObject;
    const orderId = sessionJson["orderId"] as string;

    // =========================================================================
    // Step 3: GET /payment-methods/{id}/sessions/{orderId} — Get session data
    // =========================================================================
    const getSessionUrl = `${sessionsBasePath}/payment-methods/${paymentMethodId}/sessions/${orderId}`;
    const getSessionResponse = http.get(getSessionUrl, {
        ...handlerHeaders,
        tags: { name: "get-session" },
        timeout: '10s',
    });

    check(
        getSessionResponse,
        { "Response status from GET /sessions/{orderId} was 200": (r) => r.status == 200 },
        { name: "get-session" }
    );

    if (getSessionResponse.status != 200) {
        fail(`Error getting session data: status=${getSessionResponse.status}`);
    }

    // =========================================================================
    // Step 4: PATCH /payment-methods/{id}/sessions/{orderId} — Update session
    // =========================================================================
    const fakeTransactionId = `soak-test-txn-${Date.now()}`;
    const updateSessionUrl = `${sessionsBasePath}/payment-methods/${paymentMethodId}/sessions/${orderId}`;
    const updateSessionResponse = http.patch(updateSessionUrl, JSON.stringify({
        transactionId: fakeTransactionId,
    }), {
        ...handlerHeaders,
        tags: { name: "update-session" },
        timeout: '10s',
    });

    check(
        updateSessionResponse,
        { "Response status from PATCH /sessions/{orderId} was 204": (r) => r.status == 204 },
        { name: "update-session" }
    );

    if (updateSessionResponse.status != 204) {
        fail(`Error updating session: status=${updateSessionResponse.status}`);
    }

    // =========================================================================
    // Step 5: GET /payment-methods/{id}/sessions/{orderId}/transactionId
    // =========================================================================
    const securityToken = "SECURITY_TOKEN";
    const getTransactionIdUrl = `${sessionsBasePath}/payment-methods/${paymentMethodId}/sessions/${orderId}/transactionId`;
    const getTransactionIdResponse = http.get(getTransactionIdUrl, {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.API_KEY,
            'X-Client-Id': 'CHECKOUT',
            'Authorization': `Bearer ${securityToken}`,
        },
        tags: { name: "get-transaction-id-for-session" },
        timeout: '10s',
    });

    check(
        getTransactionIdResponse,
        { "Response status from GET /sessions/{orderId}/transactionId was 200": (r) => r.status == 200 },
        { name: "get-transaction-id-for-session" }
    );

    if (getTransactionIdResponse.status != 200 || getTransactionIdResponse.json() == null) {
        fail(`Error getting transaction ID: status=${getTransactionIdResponse.status}`);
    }
}