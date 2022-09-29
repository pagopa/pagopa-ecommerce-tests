import { check, fail, sleep } from "k6";
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
    "http_req_duration{api:checkMessages}": ["p(95)<1000"],
  },
};


export default function() {
  const urlBasePath = config.URL_BASE_PATH;
  const bodyRequest =  {
    from: config.TEST_MAIL_FROM,
    to: config.TEST_MAIL_TO,
    templateId: "poc-1",
    pspName: "pspName",
    amount: 100,
    transactionId: true
  }

  const headersParams = {
    headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': config.API_SUBSCRIPTION_KEY
    },
};

  let url = `${urlBasePath}/v1/emails`;
  let res = http.post(url, JSON.stringify(bodyRequest), {
    ...headersParams,
    tags: { api: "notifications-test" },
  });
  check(
    res,
    { "Response status from POST /emails was 200": (r) => r.status == 200 },
    { tags: { api: "notifications-test" } }
  );
  
}
