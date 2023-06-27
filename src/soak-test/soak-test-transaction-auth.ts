import { check, fail } from "k6";
import http from "k6/http";
import { getConfigOrThrow } from "../utils/config";
import { generateRptId, createActivationRequest, createAuthorizationRequest } from "../common/soak-test-common"
import { NewTransactionResponse } from "../generated/ecommerce/NewTransactionResponse";
import { TransactionStatusEnum } from "../generated/ecommerce/TransactionStatus";

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
    var transactionId;
    const urlBasePath = config.URL_BASE_PATH;
    const rptId = generateRptId();
    const bodyRequest = createActivationRequest(rptId);

    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': config.API_SUBSCRIPTION_KEY,
            'Authorization': "Bearer "
        },
    };

    let url = `${urlBasePath}/transactions`;
    let response = http.post(url, JSON.stringify(bodyRequest), {
        ...headersParams,
        tags: { name: "activate-transaction-test" },
    });

    check(
        response,
        { "Response status from POST /transactions was 200": (r) => r.status == 200 },
        { name: "activate-transaction-test" }
    );

    if (response.status == 200 && response.json() != null) {
        var body = response.json() as unknown as NewTransactionResponse;
        transactionId = body.transactionId;
        headersParams.headers.Authorization = headersParams.headers.Authorization + body.authToken as string;

        url = `${urlBasePath}/transactions/${transactionId}`;
        response = http.get(url, {
            ...headersParams,
            tags: { name: "get-transaction-test" }
        });

        check(
            response,
            { "Response status from GET /transactions by transaction id was 200": (r) => r.status == 200 },
            { name: "get-transaction-test" }
        );

        if (body.status === TransactionStatusEnum.ACTIVATED) {
            url = `${urlBasePath}/transactions/${transactionId}/auth-requests`;
            // Authorization request
            const bodyRequest = createAuthorizationRequest();
            let response = http.post(url, JSON.stringify(bodyRequest), {
                ...headersParams,
                tags: { name: "authorization-transaction-test" },
            });

            check(response,
                { 'Response status from POST /transactions/{transactionId}/auth-requests is 200': (r) => r.status == 200 },
                { name: "AuthRequest" }
            );
        } else {
            fail('Error into authorization request');
        }

    } else {
        fail('Error into activation request');
    }
}
