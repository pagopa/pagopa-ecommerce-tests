import { check} from "k6";
import http from "k6/http";
import *  as type from "k6/index";
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
        "http_req_duration{api:get-all-payment-methods-test}": ["p(95)<1000"],
        "http_req_duration{api:get-single-payment-method-test}": ["p(95)<1000"]
    },
};


export default function () {
    const urlBasePath = config.ACA_SERVICE_URL;
    const headersParams = {
      headers: {
        "Content-Type": "application/json",
      },
      redirects: 0,
    };

    let createPositionBody = JSON.stringify({
        paFiscalCode: "string",
        entityType: "F",
        entityFiscalCode: "string",
        entityFullName: "string",
        iuv: "string",
        amount: 99999999,
        description: "string",
        expirationDate: "2030-01-01T09:00:00.000Z"
      });

    let response = http.post(urlBasePath, createPositionBody, {
      ...headersParams,
      tags: { name: "newDebtPosition" },
    });
    check(
        response,
        { "Response status from POST newDebtPosition was 201": (r) => r.status == 201 },
        { name: "newDebtPosition" }
    );
}