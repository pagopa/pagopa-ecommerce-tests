import { check, fail } from "k6";
import http from "k6/http";
import { getConfigOrThrow } from "../utils/config";

const config = getConfigOrThrow();

export let options = {
    scenarios: {
        contacts: {
            executor: "constant-arrival-rate",
            rate: config.rate, // e.g. 20000 for 20K iterations
            duration: config.duration, // e.g. '1m'
            preAllocatedVUs: config.preAllocatedVUs, // e.g. 500
            maxVUs: config.maxVUs, // e.g. 1000
        },
    },
    thresholds: {
        http_req_duration: ["p(99)<1500"], // 99% of requests must complete below 1.5s
        checks: ['rate>0.9'], // 90% of the request must be completed
        "http_req_duration{api:get-payment-methods}": ["p(95)<1000"]
    },
};

let counter: number = 0;

export default function () {
    const urlBasePath = config.URL_BASE_PATH;

    // Test for GET all payment methods
    let url = `${urlBasePath}/ecommerce/checkout/payment-methods-service/v1/payment-methods`;
    let response = http.post(url, { tags: { api: "get-payment-methods" },
    });

    check(
        response,
        { "Response status from POST /payment-methods was 200": (r) => r.status == 200 },
        { api: "get-payment-methods" }
    );
}