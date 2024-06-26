import { Int } from "io-ts";
import { JSONObject, check, fail } from "k6";
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
        "http_req_duration{name:create-payment-method-test}": ["p(95)<1000"],
        "http_req_duration{name:get-single-payment-method-test}": ["p(95)<1000"],
        "http_req_duration{name:patch-payment-method-status-test}": ["p(95)<1000"],
        "http_req_duration{name:get-psps-by-payment-method-test}": ["p(95)<1000"],
        "http_req_duration{name:get-all-payment-methods-test}": ["p(95)<1000"],
        "http_req_duration{name:get-all-psps-test}": ["p(95)<1000"],
        "http_req_duration{name:update-psps-list-test}": ["p(95)<1000"]
    },
};

let counter: number = 0;

export default function () {
    const urlBasePath = config.URL_BASE_PATH;
    var paymentMethodId;
    var paymentMethodStatus;

    // Body request for POST create a new payment method
    const bodyCreatePaymentMethodRequest = {
        name: config.PAYMENT_METHOD_NAME.concat((counter++).toString()),
        description: "The new payment method",
        asset: "maestro",
        status: "DISABLED",
        paymentTypeCode: "PPAY",
        ranges: [{
            min: 0,
            max: 99999999
        }]

    }

    // Body request for PATCH payment method status
    const badyForPatchStatus = {
        status: "ENABLED"
    }

    // Generic header parameter
    const headersParams = {
        headers: {
            'Content-Type': 'application/json'
        },
    };


    // Test for POST create a new payment method
    let url = `${urlBasePath}/ecommerce/payment-methods-service/v1/payment-methods`;
    let response = http.post(url, JSON.stringify(bodyCreatePaymentMethodRequest), {
        ...headersParams,
        tags: { name: "create-payment-method-test" },
    });

    check(
        response,
        { "Response status from POST /payment-methods was 200": (r) => r.status == 200 },
        { name: "create-payment-method-test" }
    );

    if (response.status == 200) {
        paymentMethodId = (response.json() as JSONObject)["id"];
        //Test for GET single payment method after POST
        url = `${urlBasePath}/checkout/ecommerce/v1/payment-methods/${paymentMethodId}`;
        response = http.get(url, { tags: { name: "get-single-payment-method-test" } });

        check(
            response,
            { "Response status from GET /payment-methods/{id} was 200": (r) => r.status == 200 },
            { name: "get-single-payment-method-test" }
        );

        //Test for PATCH paymnet method status
        url = `${urlBasePath}/ecommerce/payment-methods-service/v1/payment-methods/${paymentMethodId}`;
        response = http.patch(url, JSON.stringify(badyForPatchStatus), {
            ...headersParams,
            tags: { name: "patch-payment-method-status-test" },
        });

        check(
            response,
            { "Response status from PATCH /payment-methods/{id} was 200": (r) => r.status == 200 },
            { name: "patch-payment-method-status-test" }
        );

        if (response.status == 200) {
            paymentMethodStatus = (response.json() as JSONObject)["status"];

            if (paymentMethodStatus === "ENABLED") {

                //Test for GET psps by paymentMethodId
                url = `${urlBasePath}/checkout/ecommerce/v1/payment-methods/${paymentMethodId}/psps`;
                response = http.get(url, { tags: { name: "get-psps-by-payment-method-test" } });
                check(
                    response,
                    { "Response status from GET /psps by payment method id was 200": (r) => r.status == 200 },
                    { name: "get-psps-by-payment-method-test" }
                );

            } else {
                fail('Error patch method for change payment method status. The state has not changed.');
            }
        } else {
            fail('Error patch method for change payment method status');
        }
    } else {
        fail('Error creating new payment method');
    }



    //Test for GET all payment method
    url = `${urlBasePath}/checkout/ecommerce/v1/payment-methods`;
    response = http.get(url, { tags: { name: "get-all-payment-methods-test" } });
    check(
        response,
        { "Response status from GET payment-methods was 200": (r) => r.status == 200 },
        { name: "get-all-payment-methods-test" }
    );

    //Test for GET psps
    url = `${urlBasePath}/checkout/ecommerce/v1/payment-methods/psps`;
    response = http.get(url, { tags: { name: "get-all-psps-test" } });
    check(
        response,
        { "Response status from GET /psps was 200": (r) => r.status == 200 },
        { name: "get-all-psps-test" }
    );

    //Test for PUT psps list
    // url = `${urlBasePath}/checkout/ecommerce/v1/payment-methods/psps`;
    // response = http.put(url, null, { tags: { name: "update-psps-list-test" } });
    // check(
    //     response,
    //     { "Response status from PUT /psps was 200": (r) => r.status == 200 },
    //     { name: "update-psps-list-test" }
    // );
}