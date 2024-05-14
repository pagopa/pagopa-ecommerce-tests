import { check, fail, sleep } from "k6";
import http from "k6/http";
import { getConfigOrThrow, getVersionedBaseUrl } from "../utils/config";
import { PaymentMethod, createActivationRequest, createAuthorizationRequest, createFeeRequestV2, paymentMethodIds, randomPaymentMethod, generateOrderId, pspsIds, generateRptId } from "../common/soak-test-common"
import { NewTransactionResponse } from "../generated/ecommerce-v1/NewTransactionResponse";
import { CreateSessionResponse } from "../generated/ecommerce-v1/CreateSessionResponse";
import { CalculateFeeResponse } from "../generated/ecommerce-v2/CalculateFeeResponse";
import { TransactionStatusEnum } from "../generated/ecommerce-v1/TransactionStatus";
import { AmountEuroCents } from "../generated/ecommerce-v1/AmountEuroCents";

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
        http_req_duration: ["p(95)<=250"], // 95% of requests must complete below 1.5s
        checks: ['rate>0.9'], // 90% of the request must be completed
        "http_req_duration{name:activate-transaction}": ["p(95)<=250"],
        "http_req_duration{name:calculate-fees}": ["p(95)<=250"],
        "http_req_duration{name:get-transaction}": ["p(95)<=250"],
        "http_req_duration{name:authorization-transaction}": ["p(95)<=250"],
        "http_req_duration{name:create-session}": ["p(95)<=250"],
        "http_req_duration{name:get-session}": ["p(95)<=250"],
        "http_req_duration{name:verify-payment-notice}": ["p(95)<=250"]
    },
};

export function setup() {
    console.info(`Using BLUE deployments ${config.USE_BLUE_DEPLOYMENT}`);
}

export default function () {
    const urlBasePathV1 = getVersionedBaseUrl(config.URL_BASE_PATH, "v1");
    const urlBasePathV2 = getVersionedBaseUrl(config.URL_BASE_PATH, "v2");    

    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer ",
            'x-correlation-id': 'c1155812-0f9f-467d-ab67-8e9a84534d48',
            'x-transaction-id-from-client': "",
            ...(config.USE_BLUE_DEPLOYMENT == "True" ? { "deployment": "blue" } : {})
        },
    };
    // GET payment-request (Node verifyPaymentNotice)
    let url = `${urlBasePathV1}/payment-requests/${generateRptId()}?recaptchaResponse=test`
        let response = http.get(url, {
            ...headersParams,
            tags: { name: "verify-payment-notice" },
        });
        
        check(
            response,
            { "Response status from GET /payment-request/{rptId} was 200": (r) => r.status == 200 },
            { name: "verify-payment-notice" }
        );

    // POST /sessions
    let orderId = generateOrderId();
    const paymentMethod: PaymentMethod = randomPaymentMethod();
    if (paymentMethod == PaymentMethod.CARDS) {
        let url = `${urlBasePathV1}/payment-methods/${paymentMethodIds[paymentMethod]}/sessions?recaptchaResponse=test`
        let response = http.post(url, JSON.stringify({}), {
            ...headersParams,
            tags: { name: "create-session" },
        });
        
        check(
            response,
            { "Response status from POST /payment-methods/{methodId}/sessions was 200": (r) => r.status == 200 },
            { name: "create-session" }
        );

        if (response.status != 200 || response.json() == null) {
            fail(`Error during create session request ${response.status}`);
        }

        orderId  = (response.json() as unknown as CreateSessionResponse).orderId;
    }

    const activationBodyRequest = createActivationRequest(orderId);
    
    // Activate transaction
    url = `${urlBasePathV2}/transactions?recaptchaResponse=test`;
    response = http.post(url, JSON.stringify(activationBodyRequest), {
        ...headersParams,
        tags: { name: "activate-transaction" },
    });

    check(
        response,
        { "Response status from POST /transactions was 200": (r) => r.status == 200 },
        { name: "activate-transaction" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error into activation request ${response.status}`);
    }

    let body = response.json() as unknown as NewTransactionResponse;
    let transactionId = body.transactionId;
    headersParams.headers.Authorization = headersParams.headers.Authorization + body.authToken as string;
    headersParams.headers["x-transaction-id-from-client"] = transactionId
    if (body.status !== TransactionStatusEnum.ACTIVATED) {
        fail('Error into authorization request');
    }

    // GET session (aka card data) only for CARDS
    if (paymentMethod == PaymentMethod.CARDS) {
        url = `${urlBasePathV1}/payment-methods/${paymentMethodIds[paymentMethod]}/sessions/${orderId}`;
        response = http.get(url, {
            ...headersParams,
            tags: { name: 'get-session' }
        });

        check(response,
            { 'Response status from GET /payment-methods/{paymentMethodId}/sessions/{orderId} is 200': (r) => r.status == 200 },
            { name: "get-session" }
        );
    }

    const totalAmount = body.payments.map(it => it.amount).reduce((acc, c) => acc + c, 0);
    const isAllCCP = body.payments[0].isAllCCP;

    // Calculate fees
    url = `${urlBasePathV2}/payment-methods/${paymentMethodIds[paymentMethod]}/fees?maxOccurences=1235`;
    const calculateFeeRequest = createFeeRequestV2();
    response = http.post(url, JSON.stringify(calculateFeeRequest), {
        ...headersParams,
        tags: { name: "calculate-fees" },
    });

    check(response,
        { 'Response status from POST /payment-methods/{paymentMethodId}/fees is 200': (r) => r.status == 200 },
        { name: "calculate-fees" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error during calculate fees request ${response.status}`);
    }

    const pspBundle = (response.json() as unknown as CalculateFeeResponse).bundles.filter(it => it.idPsp == pspsIds[paymentMethod])[0];

    // Request authorization
    url = `${urlBasePathV1}/transactions/${transactionId}/auth-requests`;
    const authRequestBodyRequest = createAuthorizationRequest(orderId, isAllCCP, totalAmount as AmountEuroCents, pspBundle, paymentMethod);
    response = http.post(url, JSON.stringify(authRequestBodyRequest), {
        ...headersParams,
        tags: { name: "authorization-transaction" },
    });
    check(response,
        { 'Response status from POST /transactions/{transactionId}/auth-requests is 200': (r) => r.status == 200 },
        { name: "authorization-transaction" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error during auth request ${response.status}`);
    }

    // Simulate checkout-fe polling
    url = `${urlBasePathV1}/transactions/${transactionId}`;
    for (let i = 0; i < 5; i++) {
        response = http.get(url, {
            ...headersParams,
            tags: { name: "get-transaction" },
        });
        check(response,
            { 'Response status from GET /transactions/{transactionId} is 200': (r) => r.status == 200 },
            { name: "get-transaction" }
        );
        if (response.status != 200 || response.json() == null) {
            fail(`Error during get transaction ${response.status}`);
        }
        sleep(3);
    }
}
