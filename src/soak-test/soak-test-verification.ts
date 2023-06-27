import { getConfigOrThrow } from "../utils/config";
import http from "k6/http";
import { check } from "k6";
import { generateRptId } from "../common/soak-test-common"

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
    "http_req_duration{name:PaymentRequest-verify}": ["p(95)<1000"],//95% of requests must complete below 1.0s
    "http_req_duration{name:PaymentRequest-verify-hitCache}": ["p(95)<1000"],//95% of requests must complete below 1.0s
  },
};

export default function hitCacheTest() {
  const urlBasePath = config.URL_BASE_PATH;
  const headersParams = {
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': config.API_SUBSCRIPTION_KEY,
      'Authorization': "Bearer "
    },
  };
  const rptId = generateRptId();
  let url = `${urlBasePath}/payment-requests/${rptId}?recaptchaResponse=test`;
  // Get Payment Request Info NM3
  let response = http.get(
    url,
    {
      ...headersParams,
      tags: { name: 'PaymentRequest-verify' },
    }
  );
  check(
    response,
    { "Response status from GET /payment-request was 200": (r) => r.status == 200 },
    { name: 'PaymentRequest-verify' }
  );
  //make a verify request for the same rptId to test cache hit response time
  response = http.get(
    url,
    {
      ...headersParams,
      tags: { name: `PaymentRequest-verify-hitCache` },
    }
  );
  check(
    response,
    { "Response status from GET /payment-request was 200": (r) => r.status == 200 },
    { name: `PaymentRequest-verify-hitCache` }
  );
}



