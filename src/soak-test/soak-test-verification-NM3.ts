import { getConfigOrThrow } from "../utils/config";
import {hitCacheTest} from "../common/soak-test-verification-common"

const config = getConfigOrThrow();

export let options = {
  scenarios: {
    hitCacheNm3: {
      executor: "constant-arrival-rate",
      rate: config.rate, // e.g. 20000 for 20K iterations
      duration: config.duration, // e.g. '1m'
      preAllocatedVUs: config.preAllocatedVUs, // e.g. 500
      maxVUs: config.maxVUs, // e.g. 1000
    }
  },
  thresholds: {
    "http_req_duration{api:PaymentRequest-verify-NM3}": ["p(95)<1000"],//95% of requests must complete below 1.0s
    "http_req_duration{api:PaymentRequest-verify-NM3-hitCache}": ["p(95)<1000"],//95% of requests must complete below 1.0s
  },
};

export default function(){
  hitCacheTest(true);
}



