import { check, fail, sleep } from "k6";
import http from "k6/http";
import { getConfigOrThrow } from "../utils/config";

const config = getConfigOrThrow();

function generateRptId() {
  var result = '77777777777302001';
  for (var i = 0; i < 12; i++) {
    result = result.concat((Math.floor(Math.random() * 10)).toString());
  }
  return result;
}
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
    "http_req_duration{api:PaymentRequest-verify}": ["p(95)<1000"],//95% of post carts request must complete below 1.0s
  },
};


const urlBasePath = config.URL_BASE_PATH;


export default function () {
    var rptId = generateRptId();
    rptId = '77777777777211111111112222222';
    let url = `${urlBasePath}/checkout/ecommerce/v1/payment-requests/${rptId}?recaptchaResponse=test`;
    // Get Payment Request Info NM3
    let response = http.get(
        url,
        {
          tags: { api: "PaymentRequest-verify" },
        }
    );
    check(
      response,
      { "Response status from GET /payment-request was 200": (r) => r.status == 200 },
      { api: "PaymentRequest-verify" }
    );
  }
