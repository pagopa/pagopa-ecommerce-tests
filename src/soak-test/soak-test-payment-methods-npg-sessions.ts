import { check } from "k6";
import http from "k6/http";
 
export let options = {
    scenarios: {
      contacts: {
        executor: 'ramping-arrival-rate',
        startRate: 0,
        timeUnit: '1s',
        preAllocatedVUs: 1,
        maxVUs: 2,
        stages: [
          { target: 10, duration: "1s" },
          { target: 10, duration: "10m" },
          { target: 0, duration: "1s" },
        ],
      },
    },
    thresholds: {
        http_req_duration: ["p(99)<1500"], // 99% of requests must complete below 1.5s
        checks: ['rate>0.9'], // 90% of the request must be completed
        "http_req_duration{name:create-npg-sessions-test}": ["p(95)<1000"],
    },
};

export default function () {
    var paymentMethodId = "378d0b4f-8b69-46b0-8215-07785fe1aad4";
    
    let url = `https://api.uat.platform.pagopa.it/ecommerce/checkout/v1/payment-methods/${paymentMethodId}/sessions?recaptchaResponse=123`;
    let response = http.post(url,JSON.stringify({}), {
        tags: { name: "create-npg-sessions-test" },
    });
    check(
        response,
        { "Response status from POST /payment-methods/:paymentMethodId/sessions was 200 (with NPG buildForm)": (r) => r.status == 200 },
        { name: "create-npg-sessions-test" }
    );

}