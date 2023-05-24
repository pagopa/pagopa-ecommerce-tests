import { check } from "k6";
import http from "k6/http";
import { NewTransactionResponse } from "../generated/ecommerce/NewTransactionResponse";
import { getConfigOrThrow } from "../utils/config";
import { generateRptId, createActivationRequest } from "../common/soak-test-common"

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
        http_req_duration: ["p(95)<1000"],
        checks: ['rate>0.9'],
        "http_req_duration{name:activate-transaction-test}": ["p(95)<1000"],
        "http_req_duration{name:get-transaction-test}": ["p(95)<1000"]
    },
};


export default function () {
    const urlBasePath = config.URL_BASE_PATH;
    const bodyRequest = createActivationRequest();

    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': config.API_SUBSCRIPTION_KEY,
            'Authorization': ""
        },
    };
    let url = `${urlBasePath}/transactions?recaptchaResponse=token`;
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
        var transactionId = body.transactionId;
        headersParams.headers.Authorization = "Bearer " + body.authToken as string;

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
    }
}

