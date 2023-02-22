import { getConfigOrThrow } from "../utils/config";
import http from "k6/http";
import { check } from "k6";
import { generateRptId } from "../common/soak-test-common"

const config = getConfigOrThrow();
export let options = {
  scenarios: {
    contacts: {
      executor: 'ramping-vus',
      stages: [
        { target: config.maxVUs, duration: config.rampingDuration },
        { target: config.maxVUs, duration: config.duration },
        { target: 0, duration: config.rampingDuration },
      ],
    },
  },

  thresholds: {
    "http_req_duration{api:PaymentRequest-verify}": ["p(95)<1000"],//95% of requests must complete below 1.0s
    "http_req_duration{api:PaymentRequest-verify-hitCache}": ["p(95)<1000"],//95% of requests must complete below 1.0s
  },
};

export default function hitCacheTest() {
  const urlBasePath = config.URL_BASE_PATH;
  const rptId = generateRptId();
  let url = `${urlBasePath}/payment-requests/${rptId}?recaptchaResponse=test`;
  // Get Payment Request Info NM3
  let response = http.get(
    url,
    {
      tags: { api: 'PaymentRequest-verify' },
    }
  );
  check(
    response,
    { "Response status from GET /payment-request was 200": (r) => r.status == 200 },
    { api: 'PaymentRequest-verify' }
  );
  //make a verify request for the same rptId to test cache hit response time
  response = http.get(
    url,
    {
      tags: { api: `PaymentRequest-verify-hitCache` },
    }
  );
  check(
    response,
    { "Response status from GET /payment-request was 200": (r) => r.status == 200 },
    { api: `PaymentRequest-verify-hitCache` }
  );
}



