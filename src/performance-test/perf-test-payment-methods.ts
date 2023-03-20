import { check} from "k6";
import http from "k6/http";
import *  as type from "k6/index";
import { getConfigOrThrow } from "../utils/config";

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
        "http_req_duration{api:get-all-payment-methods-test}": ["p(95)<1000"],
        "http_req_duration{api:get-single-payment-method-test}": ["p(95)<1000"]
    },
};


export default function () {
    const urlBasePath = config.URL_BASE_PATH;

    //Test for GET all payment method
    //ecommerce/payment-methods-service/v1/payment-methods
    let url = `${urlBasePath}/payment-methods`;
    let response = http.get(url, { tags: { api: "get-all-payment-methods-test" } });
    check(
        response,
        { "Response status from GET payment-methods was 200": (r) => r.status == 200 },
        { api: "get-all-payment-methods-test" }
    );

    if (response.status == 200 && response.json()!==undefined) {
        let paymentMethods = response.json();
        (<type.JSONArray>paymentMethods).forEach(function (paymentMethod) {
            let paymentMethodId = (<type.JSONObject>paymentMethod)["id"];
            url = `${urlBasePath}/payment-methods/${paymentMethodId}`;
            response = http.get(url, { tags: { api: "get-single-payment-method-test" } });
            check(
                response,
                { "Response status from GET /payment-methods/{id} was 200": (r) => r.status == 200 },
                { api: "get-single-payment-method-test" }
            );
        });

    }
}