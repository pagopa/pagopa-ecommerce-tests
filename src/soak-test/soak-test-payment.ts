import { check, fail } from "k6";
import http from "k6/http";
import { getConfigOrThrow, getVersionedBaseUrl } from "../utils/config";
import { createActivationRequest, createAuthorizationRequest, createFeeRequest, paymentMethodIds, randomPaymentMethod } from "../common/soak-test-common"
import { NewTransactionResponse } from "../generated/ecommerce-v1/NewTransactionResponse";
import { TransactionStatusEnum } from "../generated/ecommerce-v1/TransactionStatus";

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
        http_req_duration: ["p(99)<1500"], // 99% of requests must complete below 1.5s
        checks: ['rate>0.9'], // 90% of the request must be completed
        "http_req_duration{name:activate-transaction-test}": ["p(95)<1500"],
        "http_req_duration{name:get-transaction-test}": ["p(95)<1000"],
        "http_req_duration{name:authorization-transaction-test}": ["p(95)<1500"]
    },
};


export default function () {
    const urlBasePathV1 = getVersionedBaseUrl(config.URL_BASE_PATH, "v1");
    const urlBasePathV2 = getVersionedBaseUrl(config.URL_BASE_PATH, "v2");
    
    const activationBodyRequest = createActivationRequest();

    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': config.API_SUBSCRIPTION_KEY,
            'Authorization': "Bearer "
        },
    };
    const rptId = activationBodyRequest.paymentNotices[0].rptId;

    // POST /sessions
    const paymentMethod = randomPaymentMethod()
    let url = `${urlBasePathV1}/payment-methods/${paymentMethodIds[paymentMethod]}/sessions?recaptchaResponse=test`
    let response = http.post(url, JSON.stringify({}), {
        ...headersParams,
        tags: { name: "create-session-test" },
    });

    check(
        response,
        { "Response status from POST /payment-methods/{methodId}/sessions was 200": (r) => r.status == 200 },
        { name: "create-session-test" }
    );

    // Activate transaction
    url = `${urlBasePathV2}/transactions`;
    response = http.post(url, JSON.stringify(activationBodyRequest), {
        ...headersParams,
        tags: { name: "activate-transaction-test" },
    });

    check(
        response,
        { "Response status from POST /transactions was 200": (r) => r.status == 200 },
        { name: "activate-transaction-test" }
    );

    if (response.status != 200 || response.json() == null) {
        fail('Error into activation request');
    }

    let body = response.json() as unknown as NewTransactionResponse;
    let transactionId = body.transactionId;
    headersParams.headers.Authorization = headersParams.headers.Authorization + body.authToken as string;

    if (body.status !== TransactionStatusEnum.ACTIVATED) {
        fail('Error into authorization request');
    }

    // Calculate fees
    url = `${urlBasePathV2}/payment-methods/${paymentMethodIds[paymentMethod]}/fees`;
    const calculateFeeRequest = createFeeRequest();

    response = http.post(url, JSON.stringify(calculateFeeRequest), {
        ...headersParams,
        tags: { name: "calculate-fee-test" },
    });

    check(response,
        { 'Response status from POST /payment-methods/{paymentMethodId}/fees is 200': (r) => r.status == 200 },
        { name: "calculate-fees" }
    );

    // Request authorization
    url = `${urlBasePathV1}/transactions/${transactionId}/auth-requests`;
    const authRequestBodyRequest = createAuthorizationRequest(paymentMethod);
    response = http.post(url, JSON.stringify(authRequestBodyRequest), {
        ...headersParams,
        tags: { name: "authorization-transaction-test" },
    });

    check(response,
        { 'Response status from POST /transactions/{transactionId}/auth-requests is 200': (r) => r.status == 200 },
        { name: "AuthRequest" }
    );

    // Simulate checkout-fe polling
    url = `${urlBasePathV1}/transactions/${transactionId}`;
    setTimeout(() => {
        for (let i = 0; i < 5; i++) {
            response = http.get(url, {
                ...headersParams,
                tags: { name: "get-transactions" },
            });
            check(response,
                { 'Response status from GET /transactions/{transactionId} is 200': (r) => r.status == 200 },
                { name: "get-transactions" }
            );
        }
    }, 1500);
}
