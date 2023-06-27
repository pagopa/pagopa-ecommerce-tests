import { check, fail } from "k6";
import http from "k6/http";
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
        "http_req_duration{name:get-payment-methods}": ["p(95)<1000"],
        "http_req_duration{name:get-payment-method-by-id}": ["p(95)<1000"],
        "http_req_duration{name:post-fees}": ["p(95)<1000"]
    },
};

export default function () {
    const urlBasePath = config.URL_BASE_PATH;

    const filterAmount = "10000"

    // Test for GET all payment methods
    const paymentMethodsResponse = http.get(
        `${urlBasePath}/payment-methods?amount=${filterAmount}`, 
        { tags: { name: "get-payment-methods" },
    });

    check(
        paymentMethodsResponse,
        { "Response status from GET /payment-methods was 200": (r) => r.status == 200 },
        { name: "get-payment-methods" }
    );
/*
    if ( paymentMethodsResponse.status == 200 && paymentMethodsResponse.json() !== undefined ) {


        (<type.JSONArray>paymentMethodsResponse.json()).forEach(function (firstPaymentMethod: type.JSONObject) {
           
            let paymentMethodId = (<type.JSONObject>firstPaymentMethod)["id"];

            // Test for GET  payment method by ud
            const paymentMethodResponse = http.get(
                `${urlBasePath}/payment-methods/${paymentMethodId}`, 
                { tags: { name: "get-payment-method-by-id" },
            });

            check(
                paymentMethodResponse,
                { "Response status from GET /payment-methods/:id was 200": (r) => r.status == 200 },
                { name: "get-payment-method-by-id" }
            );

            // Test for POST fees  payment method by ud
            const feesResponse = http.post(
                `${urlBasePath}/payment-methods/${firstPaymentMethodId}/fees`, 
                { tags: { name: "post-fees" },
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
                { name: "post-fees" }
            );
        });


    }*/
}