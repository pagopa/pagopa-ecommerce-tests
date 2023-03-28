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
        "http_req_duration{api:get-payment-methods}": ["p(95)<1000"],
        "http_req_duration{api:get-payment-method-by-id}": ["p(95)<1000"],
        "http_req_duration{api:post-fees}": ["p(95)<1000"]
    },
};

let counter: number = 0;

export default function () {
    const urlBasePath = config.URL_BASE_PATH;

    const filterAmount = "10000"

    // Test for GET all payment methods
    const paymentMethodsResponse = http.post(
        `${urlBasePath}/ecommerce/checkout/v1/payment-methods?amount=${filterAmount}`, 
        { tags: { api: "get-payment-methods" },
    });

    check(
        paymentMethodsResponse,
        { "Response status from GET /payment-methods was 200": (r) => r.status == 200 },
        { api: "get-payment-methods" }
    );

    const firstPaymentMethodId = paymentMethodsResponse.json()["id"]

    // Test for GET  payment method by ud
    const paymentMethodResponse = http.post(
        `${urlBasePath}/ecommerce/checkout/v1/payment-methods/${firstPaymentMethodId}`, 
        { tags: { api: "get-payment-method-by-id" },
    });

    check(
        paymentMethodResponse,
        { "Response status from GET /payment-methods/:id was 200": (r) => r.status == 200 },
        { api: "get-payment-method-by-id" }
    );

    // Test for POST fees  payment method by ud
    const feesResponse = http.post(
        `${urlBasePath}/ecommerce/checkout/v1/payment-methods/${firstPaymentMethodId}/fees`, 
        { tags: { api: "post-fees" },
    });

    // Body request for POST fees
    const bodyCreatePaymentMethodRequest = {
        bin: "400000",
        touchpoint: "CHECKOUT",
        paymentAmount: "10000",
        primaryCreditorInstitution: "66666666666",
        transferList : [
            { 
              creditorInstitution : "66666666666",
              digitalStamp : false
            }
        ]
    }

    check(
        paymentMethodResponse,
        { "Response status from GET /payment-methods/:id/fees was 200": (r) => r.status == 200 },
        { api: "post-fees" }
    );
}