import { Int } from "io-ts";
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
        "http_req_duration{api:get-all-payment-methods-test}": ["p(95)<1000"],
        "http_req_duration{api:get-single-payment-method-test}": ["p(95)<1000"]
    },
};

let counter: number = 0;

export default function () {
    const urlBasePath = config.URL_BASE_PATH;

    //Test for GET all payment method
    let url = `${urlBasePath}/pagopa-ecommerce-payment-methods-service/payment-methods`;
    let response = http.get(url, { tags: { api: "get-all-payment-methods-test" } });
    check(
        response,
        { "Response status from GET payment-methods was 200": (r) => r.status == 200 },
        { api: "get-all-payment-methods-test" }
    );

    if (response.status == 200) {
        let [] paymentMethods = response.json();
        paymentMethods.forEach(function (paymentMethod) {
            let paymentMethodId = paymentMethod["id"];
            url = `${urlBasePath}/checkout/ecommerce/v1/payment-methods/${paymentMethodId}`;
            response = http.get(url, { tags: { api: "get-single-payment-method-test" } });

            check(
                response,
                { "Response status from GET /payment-methods/{id} was 200": (r) => r.status == 200 },
                { api: "get-single-payment-method-test" }
            );
        });

    }
}