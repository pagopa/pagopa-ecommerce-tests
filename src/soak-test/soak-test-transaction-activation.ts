import { check } from "k6";
import http from "k6/http";
import { AmountEuroCents } from "../generated/ecommerce/AmountEuroCents";
import { NewTransactionRequest } from "../generated/ecommerce/NewTransactionRequest";
import { NewTransactionResponse } from "../generated/ecommerce/NewTransactionResponse";
import { PaymentContextCode } from "../generated/ecommerce/PaymentContextCode";
import { RptId } from "../generated/ecommerce/RptId";
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
        "http_req_duration{api:activate-transaction-test}": ["p(95)<1500"],
        "http_req_duration{api:get-transaction-test}": ["p(95)<1000"]
    },
};

function generateRptId() {
    var result = '77777777777' + config.NOTICE_CODE_PREFIX + '01';
    for (var i = 0; i < 12; i++) {
        result = result.concat((Math.floor(Math.random() * 10)).toString());
    }
    return result;
}

export const createActivationRequest = (
    requestRptId: string
): NewTransactionRequest => ({
    email: "mario.rossi@gmail.it",
    paymentNotices: [
        {
            rptId: requestRptId as RptId,
            amount: 1000 as AmountEuroCents,
            paymentContextCode: "6cd9114e-6427-4932-9a27-96168640d944" as PaymentContextCode
        }
    ]
});

export default function () {
    const urlBasePath = config.URL_BASE_PATH;
    const rptId = generateRptId();
    const bodyRequest = createActivationRequest(rptId);

    const headersParams = {
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': config.API_SUBSCRIPTION_KEY,
            'Authorization': "Bearer "
        },
    };

    let url = `${urlBasePath}/transactions`;
    let response = http.post(url, JSON.stringify(bodyRequest), {
        ...headersParams,
        tags: { api: "activate-transaction-test" },
    });

    check(
        response,
        { "Response status from POST /transactions was 200": (r) => r.status == 200 },
        { api: "activate-transaction-test" }
    );

    if (response.status == 200 && response.json() != null) {
        var body = response.json() as unknown as NewTransactionResponse;
        var transactionId = body.transactionId;
        headersParams.headers.Authorization = headersParams.headers.Authorization + body.authToken as string;

        url = `${urlBasePath}/transactions/${transactionId}`;
        response = http.get(url, {
            ...headersParams,
            tags: { api: "get-transaction-test" }
        });

        check(
            response,
            { "Response status from GET /transactions by transaction id was 200": (r) => r.status == 200 },
            { api: "get-transaction-test" }
        );
    }

}

