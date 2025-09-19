import { check, fail, JSONObject } from "k6";
import http from "k6/http";

// TO BE CONFIGURED
const config = {
    preAllocatedVUs: 1,
    maxVUs: 2,
    rate: 1,
    rampingDuration: '30s',
    duration: '5m',
    URL_BASE_PATH: 'https://weudev.ecommerce.internal.dev.platform.pagopa.it',
    API_KEY: '___API_KEY___'
}

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
        http_req_duration: ["p(95)<250"], // 99% of requests must complete below 250ms
        checks: ['rate>0.9'], // 90% of the request must be completed
        "http_req_duration{name:retrieve-all-payment-methods}": ["p(95)<250"],
        "http_req_duration{name:get-single-payment-method-test}": ["p(95)<1000"]
    },
};

export default function () {
    const urlBasePath = config.URL_BASE_PATH;

    const bodyRetrivePaymentMethodRequest = {
        userTouchpoint: "CHECKOUT",
        userDevice: "WEB",
        totalAmount: 15050,
        paymentNotice: [
            {
                paymentAmount: 15050,
                primaryCreditorInstitution: "77777777777",
                transferList: [
                    {
                        creditorInstitution: "77777777777",
                        transferCategory: "TAX",
                        digitalStamp: false
                    }
                ]
            }
        ],
        "allCCp": false
    }

    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.API_KEY
        },
    };


    const url = `${urlBasePath}/pagopa-ecommerce-payment-methods-handler/payment-methods`;
    const response = http.post(url, JSON.stringify(bodyRetrivePaymentMethodRequest), {
        ...headersParams,
        tags: { name: "retrieve-all-payment-methods" },
    });

    check(
        response,
        { "Response status from POST /payment-methods to retrive payment methods was 200": (r) => r.status == 200 },
        { name: "retrieve-all-payment-methods" }
    );

    if (response.status == 200) {

        const paymentMethods = (response.json() as JSONObject)["paymentMethods"];
        
        if (paymentMethods && Array.isArray(paymentMethods) && paymentMethods.length > 0) {

            const paymentMethodId = (paymentMethods[0] as JSONObject)["id"];
       
            const retriveSinglePaymentMethodHeadersParams = {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.API_KEY,
                    'x-client-id': 'CHECKOUT'
                },  
            };

            const urlGetPaymentMethod = `${urlBasePath}/pagopa-ecommerce-payment-methods-handler/payment-methods/${paymentMethodId}`;
            const responseGetPaymentMethod = http.get(urlGetPaymentMethod, { 
                ...retriveSinglePaymentMethodHeadersParams,
                tags: { name: "get-single-payment-method-test" } 
            });

            check(
                responseGetPaymentMethod,
                { "Response status from GET /payment-methods/{id} was 200": (r) => r.status == 200 },
                { name: "get-single-payment-method-test" }
            );

        } else {

            fail('Error invalid pament methods list');
        }

    } else {
        fail('Error retrive all payment methods');
    }

}