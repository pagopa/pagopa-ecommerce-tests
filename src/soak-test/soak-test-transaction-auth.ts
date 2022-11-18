import { check, fail} from "k6";
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
        "http_req_duration{api:GetPaymentRequestInfo}": ["p(95)<1000"],
        "http_req_duration{api:CreateNewTransaction}": ["p(95)<1000"],
        "http_req_duration{api:GetTransaction}": ["p(95)<1000"],
        "http_req_duration{api:GetPaymentMethods}": ["p(95)<1000"],
        "http_req_duration{api:GetPSPByPaymentMethod}": ["p(95)<1000"],
        "http_req_duration{api:AuthRequest}": ["p(95)<1000"],
    },
};

function generateRptId() {
    var result = '77777777777302001';
    for (var i = 0; i < 12; i++) {
        result = result.concat((Math.floor(Math.random() * 10)).toString());
    }
    return result;
}

export default function () {
    const urlBasePath = config.URL_BASE_PATH
    let response
    var rptId = generateRptId();
    var paymentContextCode;
    var transactionId;
    var amount = 1000;
    var paymentMethodId;
    var paymentToken;
    var pspId;
    var emailAddress = config.TEST_MAIL_TO
    // Get Payment Request Info NM3
    response = http.get(
        `${urlBasePath}/checkout/ecommerce/v1/payment-requests/${rptId}?recaptchaResponse=test`, 
         {tags: { api: "GetPaymentRequestInfo" }}
    )
    check(response, 
        {'Response status from GET /payment-requests is 200': (r) => r.status == 200},
        { api: "GetPaymentRequestInfo" }
        );
    if (response.status == 200) {
        paymentToken = response.json()["paymentToken"];
        rptId = response.json()["rptId"];
        paymentContextCode = response.json()["paymentContextCode"];
    }
    if (paymentContextCode !== undefined && amount !== undefined) {
        // Create new transaction
        const bodyRequest = {
            "rptId": rptId,
            "paymentContextCode": paymentContextCode,
            "email": emailAddress,
            "amount": amount
        }

        response = http.post(
            `${urlBasePath}/checkout/ecommerce/v1/transactions?test=debug`,
            JSON.stringify(bodyRequest),
            {
                headers: {
                    'content-type': 'application/json',
                },
                tags: { api: "CreateNewTransaction" }
            }
        )
        check(response, 
            {'rResponse status from POST /transactions is 200': (r) => r.status == 200},
            { api: "CreateNewTransaction" });
    } else {
        fail('Missing data for create new transaction');
    }
    if (response.status == 200) {
        transactionId = response.json()["transactionId"];
    }

    if (transactionId !== undefined) {
        // Get transaction
        response = http.get(
            `${urlBasePath}/checkout/ecommerce/v1/transactions/${transactionId}`,
            {tags: { api: "GetTransaction" }}
        )
        check(response, 
            {'Response status from GET /transactions is 200': (r) => r.status == 200},
            { api: "GetTransaction" }
            );
    } else {
        fail('Missing data for get transaction');
    }

    if (response.status == 200) {
        paymentToken = response.json()["paymentToken"];
    }
    // Get payment methods
    if (amount !== undefined) {
        response = http.get(
            `${urlBasePath}/checkout/ecommerce/v1/payment-methods?amount=${amount}`,
            {tags: { api: "GetPaymentMethods" }}
        )
        check(response, 
            {'Response status from GET /payment-methods is 200': (r) => r.status == 200},
            {api: "GetPaymentMethods" }
            );
    } else {
        fail('Missing data for get payment methods');
    }
    if (response.status == 200) {
        paymentMethodId = response.json()[0].id
    }
    // Get PSPs by payment method
    if (paymentMethodId !== undefined && amount !== undefined) {
        response = http.get(
            `${urlBasePath}/checkout/ecommerce/v1/payment-methods/${paymentMethodId}/psps?amount=${amount}`,
            {tags: { api: "GetPSPByPaymentMethod" }}
        )
        check(response, 
            {'Response status from GET /payment-methods is 200': (r) => r.status == 200},
            {api: "GetPSPByPaymentMethod" }
            );
        if (response.status == 200) {
            pspId = response.json()["psp"][0]["code"];
        }
    } else {
        fail('Missing data for get PSPs by payment method')
    }
    if (transactionId !== undefined && amount !== undefined && pspId !==undefined) {
        // Authorization request
        const bodyRequest = {
            "amount": amount,
            "fee": 1.0,
            "paymentInstrumentId": paymentMethodId,
            "pspId": pspId,
            "language": "IT"
        }
        response = http.post(
            `${urlBasePath}/checkout/ecommerce/v1/transactions/${transactionId}/auth-requests`,
            JSON.stringify(bodyRequest),
            {
                headers: {
                    'content-type': 'application/json',
                },
                tags: { api: "AuthRequest" }
            }
        )
        check(response, 
            {'Response status from POST /transactions/{transactionId}/auth-requests is 200': (r) => r.status == 200},
            { api: "AuthRequest" }
            );
    } else {
        fail('Missing data for authorization request');
    }
}
