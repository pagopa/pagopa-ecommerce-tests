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
        "http_req_duration{api:create-payment-method-test}": ["p(95)<1000"],
        "http_req_duration{api:get-single-payment-method-test}": ["p(95)<1000"],
        "http_req_duration{api:patch-payment-method-status-test}": ["p(95)<1000"],
        "http_req_duration{api:get-psps-by-payment-method-test}": ["p(95)<1000"],
        "http_req_duration{api:get-all-payment-methods-test}": ["p(95)<1000"],
        "http_req_duration{api:get-all-psps-test}": ["p(95)<1000"],
        "http_req_duration{api:update-psps-list-test}": ["p(95)<1000"]
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
        tags: { api: "create-payment-method-test" },
    });

    check(
        response,
        { "Response status from POST /payment-methods was 200": (r) => r.status == 200 },
        { api: "create-payment-method-test" }
    );

    if (response.status == 200) {
        paymentMethodId = response.json()["id"];
        //Test for GET single payment method after POST
        url = `${urlBasePath}/ecommerce/payment-methods-service/v1/payment-methods/${paymentMethodId}`;
        response = http.get(url, { tags: { api: "get-single-payment-method-test" } });

        check(
            response,
            { "Response status from GET /payment-methods/{id} was 200": (r) => r.status == 200 },
            { api: "get-single-payment-method-test" }
        );

        //Test for PATCH paymnet method status
        url = `${urlBasePath}/ecommerce/payment-methods-service/v1/payment-methods/${paymentMethodId}`;
        response = http.patch(url, JSON.stringify(badyForPatchStatus), {
            ...headersParams,
            tags: { api: "patch-payment-method-status-test" },
        });

        check(
            response,
            { "Response status from PATCH /payment-methods/{id} was 200": (r) => r.status == 200 },
            { api: "patch-payment-method-status-test" }
        );

        if (response.status == 200) {
            paymentMethodStatus = response.json()["status"];

            if (paymentMethodStatus === "ENABLED") {

                //Test for GET psps by paymentMethodId
                url = `${urlBasePath}/ecommerce/payment-methods-service/v1/payment-methods/${paymentMethodId}/psps`;
                response = http.get(url, { tags: { api: "get-psps-by-payment-method-test" } });
                check(
                    response,
                    { "Response status from GET /psps by payment method id was 200": (r) => r.status == 200 },
                    { api: "get-psps-by-payment-method-test" }
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
    url = `${urlBasePath}/ecommerce/payment-methods-service/v1/payment-methods`;
    response = http.get(url, { tags: { api: "get-all-payment-methods-test" } });
    check(
        response,
        { "Response status from GET payment-methods was 200": (r) => r.status == 200 },
        { api: "get-all-payment-methods-test" }
    );

    //Test for GET psps
    url = `${urlBasePath}/ecommerce/payment-methods-service/v1/payment-methods/psps`;
    response = http.get(url, { tags: { api: "get-all-psps-test" } });
    check(
        response,
        { "Response status from GET /psps was 200": (r) => r.status == 200 },
        { api: "get-all-psps-test" }
    );

    //Test for PUT psps list
    // url = `${urlBasePath}/ecommerce/payment-methods-service/v1/payment-methods`;
    // response = http.put(url, null, { tags: { api: "update-psps-list-test" } });
    // check(
    //     response,
    //     { "Response status from PUT /psps was 200": (r) => r.status == 200 },
    //     { api: "update-psps-list-test" }
    // );
}