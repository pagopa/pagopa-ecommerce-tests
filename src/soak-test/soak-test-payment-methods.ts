import { check, fail } from "k6";
import http from "k6/http";
import { getConfigOrThrow } from "../utils/config";
import { PaymentMethodResponse } from "../generated/ecommerce/PaymentMethodResponse";
import { PaymentMethodsResponse } from "../generated/ecommerce/PaymentMethodsResponse";
import { calculateFeeRequest } from "../common/soak-test-common";

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
        "http_req_duration{name:calculate-fees}": ["p(95)<1000"]
    },
};

const headersParams = {
    headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': config.API_SUBSCRIPTION_KEY,
        'Authorization': "Bearer "
    },
};

export default function () {
    const urlBasePath = config.URL_BASE_PATH;

    const filterAmount = "10000"

    // Test for GET all payment methods
    let response = http.get(
        `${urlBasePath}/payment-methods?amount=${filterAmount}`,
        {
            ...headersParams,
            tags: { name: "get-payment-methods" },
        });

    check(
        response,
        { "Response status from GET /payment-methods was 200": (r) => r.status == 200 },
        { name: "get-payment-methods" }
    );

    if (response.status == 200 && response.json() !== undefined) {
        const paymentMethods = response.json() as unknown as PaymentMethodsResponse;
        if (paymentMethods.paymentMethods) {
            const firstPaymentMethod = paymentMethods.paymentMethods[0] as unknown as PaymentMethodResponse;
            // Test for GET payment method by id
            response = http.get(
                `${urlBasePath}/payment-methods/${firstPaymentMethod.id}`,
                {
                    ...headersParams,
                    tags: { name: "get-payment-method-by-id" },
                });
            check(
                response,
                { "Response status from GET /payment-methods/{id} was 200": (r) => r.status == 200 },
                { name: "get-payment-method-by-id" }
            );
            const calculateFee = calculateFeeRequest()
            
            //Test calculate fees
            response = http.post(
                `${urlBasePath}/payment-methods/${firstPaymentMethod.id}/fees`,
                JSON.stringify(calculateFee),
                {
                    ...headersParams,
                    tags: { name: "calculate-fees" },
                });
            check(
                response,
                { "Response status from POST /payment-methods/{id}/fees was 200": (r) => r.status == 200 },
                { name: "calculate-fees" }
            );

        } else {
            fail("Get all payment methods returned no payment method!");
        }

    } else {
        fail(`Cannot retrieve all payment methods, received error code: ${response.status} and body ${response.body}`)
    }
}