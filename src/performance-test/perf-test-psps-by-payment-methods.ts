import { Int } from "io-ts";
import { check, fail } from "k6";
import http from "k6/http";
import *  as type from "k6/index";
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
        "http_req_duration{api:get-all-psps-test}": ["p(95)<1000"],
        "http_req_duration{api:get-psps-by-payment-method-test}": ["p(95)<1000"]
    },
};

let initialized = false;

let paymentMethods: type.JSONArray;
const urlBasePath = config.URL_BASE_PATH

function init() {
    if (!initialized) {
        //Test for GET all payment method
        let url = `${urlBasePath}/pagopa-ecommerce-payment-methods-service/payment-methods`;
        let response = http.get(url, { tags: { api: "get-all-payment-methods-test" } });
        if (response.status == 200 && response.json() !== undefined) {
            paymentMethods = response.json() as type.JSONArray;
            console.log("Payment methods retrieved successfully");
        } else {
            fail('Error retrieving payment methods!')
        }
    }
}

export default function () {
    init();
    let url = `${urlBasePath}/payment-methods/psps`;
    let response = http.get(url, { tags: { api: "get-all-psps-test" } });
    check(
        response,
        { "Response status from GET /psps was 200": (r) => r.status == 200 },
        { api: "get-all-psps-test" }
    );
    paymentMethods.forEach(function (paymentMethod) {
        url = `${urlBasePath}/payment-methods/${(<type.JSONObject>paymentMethod)["id"]}/psps`;
        response = http.get(url, { tags: { api: "get-psps-by-payment-method-test" } });
        check(
            response,
            { "Response status from GET /psps by payment method id was 200": (r) => r.status == 200 },
            { api: "get-psps-by-payment-method-test" }
        );
    });


}