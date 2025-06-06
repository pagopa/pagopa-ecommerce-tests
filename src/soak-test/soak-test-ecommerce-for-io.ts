import { check, fail, sleep} from "k6";
import http from "k6/http";
import { getConfigOrThrow } from "../utils/config";
import { createFeeRequestV2, generateRptId, PaymentMethod, paymentMethodIds } from "../common/soak-test-common";
import { uuid } from "../utils/utils";
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
        http_req_duration: ["p(95)<=250"], 
        checks: ['rate>0.9'], 
        "http_req_duration{name:activate-transaction}": ["p(95)<=250"],
        "http_req_duration{name:auth-request}": ["p(95)<=250"],
        "http_req_duration{name:get-transaction}": ["p(95)<=250"],
        "http_req_duration{name:calculate-fees}": ["p(95)<=250"],
        "http_req_duration{name:get-user-stats}": ["p(95)<=250"],
    },
};
const urlBasePath = "https://weuuat.ecommerce.internal.uat.platform.pagopa.it"
const paymentMethodId = "0d1450f4-b993-4f89-af5a-1770a45f5d71";//PAYPAL per client id IO
const pspId = "BCITITMM";
export default function () {
    const randomUUID =  uuid();
    const rptId = generateRptId();
    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'x-client-id': 'IO',
            'x-correlation-id': randomUUID,
            'x-user-id': randomUUID,
            'x-pgs-id': "NPG",
        }
    };
    /* transaction activation */
    const newTransactionRequest = {
        paymentNotices: [
            {
                rptId: rptId,
                amount: 120000
            }
    
        ],
        emailToken: randomUUID,
        orderId: "E1729083167537t611"
    }
    let url = `${urlBasePath}/beta/pagopa-ecommerce-transactions-service/v2.1/transactions`;
    let response = http.post(url, JSON.stringify(newTransactionRequest), {
        ...headersParams,
        tags: { name: "activate-transaction" },
        timeout: '10s'
    });

    check(
        response,
        { "Response status from POST /transactions was 200": (r) => r.status == 200 },
        { name: "activate-transaction" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error into activation request ${response.status} - ${JSON.stringify(response.body)}`);
    }

    const postTransactionResponseBody = response.json() as any;

      /* Calculate fees */
      url = `${urlBasePath}/beta/pagopa-ecommerce-payment-methods-service/v2/payment-methods/${paymentMethodId}/fees?maxOccurences=1235`;
      const calculateFeeRequest = createFeeRequestV2();
      response = http.post(url, JSON.stringify(calculateFeeRequest), {
          ...headersParams,
          tags: { name: "calculate-fees" },
          timeout: '10s'
      });
  
      check(response,
          { 'Response status from POST /payment-methods/{paymentMethodId}/fees is 200': (r) => r.status == 200 },
          { name: "calculate-fees" }
      );
  
      if (response.status != 200 || response.json() == null) {
          fail(`Error during calculate fees request ${response.status}`);
      }
    
    /* request transaction authorization */
    const transactionId = postTransactionResponseBody.transactionId;
    const authorizationRequest = {
        amount: postTransactionResponseBody.payments[0].amount,
        fee: 100,
        pspId: pspId,
        language: "IT",
        paymentInstrumentId: paymentMethodId,
        details: {
            detailType: "apm",
        },
        isAllCCP: postTransactionResponseBody.payments[0].isAllCCP
    }
    url = `${urlBasePath}/beta/pagopa-ecommerce-transactions-service/transactions/${transactionId}/auth-requests`;
    response = http.post(url, JSON.stringify(authorizationRequest), {
        ...headersParams,
        tags: { name: "auth-request" },
        timeout: '10s'
    });

    check(
        response,
        { "Response status from POST /transactions/auth-request was 200": (r) => r.status == 200 },
        { name: "auth-request" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error into POST auth-request ${response.status} - ${JSON.stringify(response.body)}`);
    }
     /*  Simulate checkout-fe polling */
     url = `${urlBasePath}/beta/pagopa-ecommerce-transactions-service/transactions/${transactionId}`;
     for (let i = 0; i < 5; i++) {
         response = http.get(url, {
             ...headersParams,
             tags: { name: "get-transaction" },
             timeout: '10s'
         });
         check(response,
             { 'Response status from GET /transactions/{transactionId} is 200': (r) => r.status == 200 },
             { name: "get-transaction" }
         );
         if (response.status != 200 || response.json() == null) {
             fail(`Error during get transaction ${response.status}`);
         }
         sleep(3);
     }
    /* GET user last payment method used */
    url = `${urlBasePath}/pagopa-ecommerce-user-stats-service/user/lastPaymentMethodUsed`;
    response = http.get(url, {
        ...headersParams,
        tags: { name: "get-user-stats" },
        timeout: '10s'
    });

    check(
        response,
        { "Response status from GET /user/lastPaymentMethodUsed was 200": (r) => r.status == 200 },
        { name: "get-user-stats" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error into GET /user/lastPaymentMethodUsed  ${response.status} - ${JSON.stringify(response.body)}`);
    }

    
}
