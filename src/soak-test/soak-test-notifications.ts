import { check } from "k6";
import http from "k6/http";
import { getConfigOrThrow } from "../utils/config";

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
    "http_req_duration{name:notifications-test}": ["p(95)<1000"],
  },
};


export default function () {
  const urlBasePath = config.URL_BASE_PATH;
  const bodyRequest = {
    to: config.TEST_MAIL_TO,
    subject: "test",
    templateId: "poc-1",
    parameters: {
      amount: 100,
      email: config.TEST_MAIL_FROM,
      noticeCode: "302000100000009424"
    }
  }

  const headersParams = {
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': config.API_SUBSCRIPTION_KEY
    },
  };

  let url = `${urlBasePath}/emails`;
  let res = http.post(url, JSON.stringify(bodyRequest), {
    ...headersParams,
    tags: { name: "notifications-test" },
  });

  check(
    res,
    { "Response status from POST /emails was 200": (r) => r.status == 200 },
    { name: "notifications-test"  }
  );

}
