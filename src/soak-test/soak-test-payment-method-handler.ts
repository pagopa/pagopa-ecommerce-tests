import { check, fail, JSONObject } from "k6";
import http from "k6/http";

// TO BE CONFIGURED
const config = {
    preAllocatedVUs: 50,
    maxVUs: 200,
    rate: 200,
    rampingDuration: '10m',
    duration: '3h',
    URL_BASE_PATH: 'https://weuuat.ecommerce.internal.uat.platform.pagopa.it',
    API_KEY: 'TO_UPDATE_WITH_A_VALID_API_KEY',
    NPG_BASE_URL: 'https://stg-ta.nexigroup.com',
    NPG_TEST_CARD_NUMBER: '4242424242424242',
    NPG_TEST_EXPIRY: '12/99',
    NPG_TEST_CVV: '123',
    NPG_TEST_CARDHOLDER: 'Test Test',
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
        "http_req_duration{name:npg-fill-card-data}": ["p(95)<1000"],
        "http_req_duration{name:get-session-card-data}": ["p(95)<500"],
        "http_req_duration{name:update-session}": ["p(95)<250"],
        "http_req_duration{name:get-transaction-id-for-session}": ["p(95)<250"],
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
    const bodyRetrivePaymentMethodRequest = {
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

    const url = `${urlBasePath}/pagopa-ecommerce-payment-methods-handler/payment-methods`;
    const response = http.post(url, JSON.stringify(bodyRetrivePaymentMethodRequest), {
        ...handlerHeaders,
        tags: { name: "retrieve-all-payment-methods" },
    });

    check(
        response,
        { "Response status from POST /payment-methods to retrive payment methods was 200": (r) => r.status == 200 },
        { name: "retrieve-all-payment-methods" }
    );

    if (response.status == 200) {

        const paymentMethods = (response.json() as JSONObject)["paymentMethods"];
        
        if (paymentMethods && Array.isArray(paymentMethods) && paymentMethods.length > 0) {

            const retrievedPaymentMethodId = (paymentMethods[0] as JSONObject)["id"];
       
            const retriveSinglePaymentMethodHeadersParams = {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.API_KEY,
                    'x-client-id': 'IO'
                },  
            };

            const urlGetPaymentMethod = `${urlBasePath}/pagopa-ecommerce-payment-methods-handler/payment-methods/${retrievedPaymentMethodId}`;
            const responseGetPaymentMethod = http.get(urlGetPaymentMethod, { 
                ...retriveSinglePaymentMethodHeadersParams,
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
    const createSessionUrl = `${urlBasePath}/pagopa-ecommerce-payment-methods-handler/payment-methods/${paymentMethodId}/sessions`;
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
        return;
    }

    const sessionJson = createSessionResponse.json() as JSONObject;
    const orderId = sessionJson["orderId"] as string;
    const correlationId = sessionJson["correlationId"] as string;

    // Extract sessionId from the first field's src URL
    const paymentMethodData = sessionJson["paymentMethodData"] as JSONObject;
    const form = paymentMethodData["form"] as JSONObject[];
    const firstFieldSrc = form[0]["src"] as string;
    const sessionIdMatch = firstFieldSrc.match(/sessionid=([^&]+)/);
    if (!sessionIdMatch) {
        fail('Could not extract sessionId from form field src URL');
        return;
    }
    const npgSessionId = sessionIdMatch[1];

    // =========================================================================
    // Step 3: POST NPG /fe/build/text/ — Fill card data (mock/staging NPG)
    // =========================================================================
    const npgFillCardUrl = `${config.NPG_BASE_URL}/fe/build/text/`;
    const npgFillCardBody = JSON.stringify({
        fieldValues: [
            { id: "CARD_NUMBER", value: config.NPG_TEST_CARD_NUMBER },
            { id: "EXPIRATION_DATE", value: config.NPG_TEST_EXPIRY },
            { id: "SECURITY_CODE", value: config.NPG_TEST_CVV },
            { id: "CARDHOLDER_NAME", value: config.NPG_TEST_CARDHOLDER },
        ]
    });

    const npgFillCardResponse = http.post(npgFillCardUrl, npgFillCardBody, {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Correlation-Id': correlationId,
            'session': npgSessionId,
            'Idempotency-Key': `${Date.now()}-${Math.random().toString(36).substring(2)}`,
        },
        tags: { name: "npg-fill-card-data" },
        timeout: '10s',
    });

    check(
        npgFillCardResponse,
        { "Response status from NPG fill card data was 200": (r) => r.status == 200 },
        { name: "npg-fill-card-data" }
    );

    if (npgFillCardResponse.status != 200) {
        fail(`Error filling card data on NPG: status=${npgFillCardResponse.status}`);
        return;
    }

    // =========================================================================
    // Step 4: GET /payment-methods/{id}/sessions/{orderId} — Get card data
    // =========================================================================
    const getSessionUrl = `${urlBasePath}/pagopa-ecommerce-payment-methods-handler/payment-methods/${paymentMethodId}/sessions/${orderId}`;
    const getSessionResponse = http.get(getSessionUrl, {
        ...handlerHeaders,
        tags: { name: "get-session-card-data" },
        timeout: '10s',
    });

    check(
        getSessionResponse,
        { "Response status from GET /sessions/{orderId} was 200": (r) => r.status == 200 },
        { name: "get-session-card-data" }
    );

    if (getSessionResponse.status != 200) {
        fail(`Error getting session card data: status=${getSessionResponse.status}`);
        return;
    }

    // =========================================================================
    // Step 5: PATCH /payment-methods/{id}/sessions/{orderId} — Update session
    //         (associate transactionId)
    // =========================================================================
    const fakeTransactionId = `soak-test-txn-${Date.now()}`;
    const updateSessionUrl = `${urlBasePath}/pagopa-ecommerce-payment-methods-handler/payment-methods/${paymentMethodId}/sessions/${orderId}`;
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
        return;
    }

    // =========================================================================
    // Step 6: GET /payment-methods/{id}/sessions/{orderId}/transactionId
    //         — Get transaction ID for session
    // =========================================================================
    /*
    const securityToken = "SECURITY_TOKEN";
    const getTransactionIdUrl = `${urlBasePath}/pagopa-ecommerce-payment-methods-handler/payment-methods/${paymentMethodId}/sessions/${orderId}/transactionId`;
    const getTransactionIdResponse = http.get(getTransactionIdUrl, {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.API_KEY,
            'X-Client-Id': 'IO',
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
    */
}