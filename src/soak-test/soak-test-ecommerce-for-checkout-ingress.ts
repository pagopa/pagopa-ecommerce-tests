import { check, fail, sleep } from "k6";
import http from "k6/http";
import { PaymentMethod, createActivationRequest, createAuthorizationRequest, createFeeRequestV2, paymentMethodIds, randomPaymentMethod, generateOrderId, pspsIds, generateRptId, createPatchAuthorizationRequest } from "../common/soak-test-common"
import { NewTransactionResponse } from "../generated/ecommerce-v1/NewTransactionResponse";
import { CreateSessionResponse } from "../generated/ecommerce-v1/CreateSessionResponse";
import { CalculateFeeResponse } from "../generated/ecommerce-v2/CalculateFeeResponse";
import { TransactionStatusEnum } from "../generated/ecommerce-v1/TransactionStatus";
import { AmountEuroCents } from "../generated/ecommerce-v1/AmountEuroCents";

export let options = {
    scenarios: {
      contacts: {
        executor: 'ramping-arrival-rate',
        startRate: 0,
        timeUnit: '1s',
        preAllocatedVUs: 100,
        maxVUs: 1000,
        stages: [
          { target: 30, duration: "15m" },
          { target: 30, duration: "1h" },
          { target: 0, duration: "15m" },
        ],
      },
    },

    thresholds: {
        http_req_duration: ["p(95)<=250"], // 95% of requests must complete below 250ms
        checks: ['rate>0.9'], // 90% of the request must be completed
        "http_req_duration{name:activate-transaction}": ["p(95)<=250"],
        "http_req_duration{name:calculate-fees}": ["p(95)<=250"],
        "http_req_duration{name:get-transaction}": ["p(95)<=250"],
        "http_req_duration{name:authorization-transaction}": ["p(95)<=250"],
        "http_req_duration{name:create-session}": ["p(95)<=250"],
        "http_req_duration{name:get-session}": ["p(95)<=250"],
        "http_req_duration{name:verify-payment-notice}": ["p(95)<=250"],
        "http_req_duration{name:patch-auth-request}": ["p(95)<=250"]
    },
};

export default function () {

    //console.log({urlBasePathV1, urlBasePathV2})

    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer ",
            'x-correlation-id': 'c1155812-0f9f-467d-ab67-8e9a84534d48',
            'x-transaction-id-from-client': "",
            "deployment": "blue",
            "x-client-id": "CHECKOUT",
            "x-pgs-id": "NPG"
        }
    };
    // GET payment-request (Node verifyPaymentNotice)
    let url = `https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-payment-requests-service/payment-requests/${generateRptId()}?recaptchaResponse=test`
    let response = http.get(url, {
        ...headersParams,
        tags: { name: "verify-payment-notice" },
        timeout: '10s'
    });

   // console.log("URL: ======", url)
    
    check(
        response,
        { "Response status from GET /payment-request/{rptId} was 200": (r) => r.status == 200 },
        { name: "verify-payment-notice" }
    );

    // POST /sessions
    let orderId = generateOrderId();
    const paymentMethod: PaymentMethod = randomPaymentMethod();
    if (paymentMethod == PaymentMethod.CARDS) {
        let url = `https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-payment-methods-service/payment-methods/${paymentMethodIds[paymentMethod]}/sessions?recaptchaResponse=test`
        let response = http.post(url, JSON.stringify({}), {
            ...headersParams,
            tags: { name: "create-session" },
            timeout: '10s'
        });
        
        check(
            response,
            { "Response status from POST /payment-methods/{methodId}/sessions was 200": (r) => r.status == 200 },
            { name: "create-session" }
        );

        if (response.status != 200 || response.json() == null) {
            fail(`Error during create session request ${response.status}`);
        }

        orderId  = (response.json() as unknown as CreateSessionResponse).orderId;
    }

    const activationBodyRequest = createActivationRequest(orderId);
    
    // Activate transaction
    url = `https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-transactions-service/v2/transactions?recaptchaResponse=test`;
    response = http.post(url, JSON.stringify(activationBodyRequest), {
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
        fail(`Error into activation request ${response.status}`);
    }

    let body = response.json() as unknown as NewTransactionResponse;
    let transactionId = body.transactionId;
    headersParams.headers.Authorization = headersParams.headers.Authorization + body.authToken as string;
    headersParams.headers["x-transaction-id-from-client"] = transactionId
    if (body.status !== TransactionStatusEnum.ACTIVATED) {
        fail('Error into authorization request');
    }

    // GET session (aka card data) only for CARDS
    if (paymentMethod == PaymentMethod.CARDS) {
        url = `https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-payment-methods-service/payment-methods/${paymentMethodIds[paymentMethod]}/sessions/${orderId}`;
        response = http.get(url, {
            ...headersParams,
            tags: { name: 'get-session' },
            timeout: '10s'
        });

        check(response,
            { 'Response status from GET /payment-methods/{paymentMethodId}/sessions/{orderId} is 200': (r) => r.status == 200 },
            { name: "get-session" }
        );
    }

    const totalAmount = body.payments.map(it => it.amount).reduce((acc, c) => acc + c, 0);
    const isAllCCP = body.payments[0].isAllCCP;

    // Calculate fees
    url = `https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-payment-methods-service/v2/payment-methods/${paymentMethodIds[paymentMethod]}/fees?maxOccurences=1235`;
    const calculateFeeRequest = createFeeRequestV2();
    response = http.post(url, JSON.stringify(calculateFeeRequest), {
        ...headersParams,
        tags: { name: "calculate-fees" },
        timeout: '10s'
    });

    //console.log("fees URL", url)

    check(response,
        { 'Response status from POST /payment-methods/{paymentMethodId}/fees is 200': (r) => r.status == 200 },
        { name: "calculate-fees" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error during calculate fees request ${response.status}`);
    }

    const pspBundle = (response.json() as unknown as CalculateFeeResponse).bundles.filter(it => it.idPsp == pspsIds[paymentMethod])[0];

    // Request authorization
    url = `https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-transactions-service/transactions/${transactionId}/auth-requests`;

    //console.log("request URL", url)

    const authRequestBodyRequest = createAuthorizationRequest(orderId, isAllCCP, totalAmount as AmountEuroCents, pspBundle, paymentMethod);
    response = http.post(url, JSON.stringify(authRequestBodyRequest), {
        ...headersParams,
        tags: { name: "authorization-transaction" },
        timeout: '10s'
    });
    check(response,
        { 'Response status from POST /transactions/{transactionId}/auth-requests is 200': (r) => r.status == 200 },
        { name: "authorization-transaction" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error during auth request ${response.status} ${console.log(response.body?.toString())}`);
    }

    // PATCH authorization
    url = `https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-transactions-service/v2/transactions/${transactionId}/auth-requests`;

    // console.log("PATCH authorization request URL", url)

    const authRequestPatchBodyRequest = createPatchAuthorizationRequest(paymentMethod, orderId, pspBundle.idPsp!!, transactionId);
    
    response = http.patch(url, JSON.stringify(authRequestPatchBodyRequest), {
        ...headersParams,
        tags: { name: "patch-auth-request" },
        timeout: '10s'
    });
    check(response,
        { 'Response status from PATCH /transactions/{transactionId}/auth-requests is 200': (r) => r.status == 200 },
        { name: "patch-auth-request" }
    );

    if (response.status != 200 || response.json() == null) {
        fail(`Error during auth completed ${response.status} ${console.log(response.body?.toString())}`);
    } 


    // Simulate checkout-fe polling
    url = `https://weuuat.ecommerce.internal.uat.platform.pagopa.it/beta/pagopa-ecommerce-transactions-service/transactions/${transactionId}/outcomes`;
   //console.log("OUTCOMES URL", url)
    for (let i = 0; i < 5; i++) {
        sleep(3);
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
    }
}
