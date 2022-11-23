import { check } from "k6";
import http from "k6/http";
import { getConfigOrThrow } from "../utils/config";

const config = getConfigOrThrow();

const urlBasePath = config.URL_BASE_PATH;

function generateRandomRptId(nm3:Boolean) {
  var type = nm3?'3':'2';
  var result = `77777777777${type}02001`;
  for (var i = 0; i < 12; i++) {
    result = result.concat((Math.floor(Math.random() * 10)).toString());
  }
  return result;
}

export function hitCache(){
  hitCacheTest(false);
}

export function hitCacheNm3(){
  hitCacheTest(true);
}


export function hitCacheTest(nm3:Boolean) {
    // Generate a new random rptId
    var rptId = generateRandomRptId(nm3);
    const tagPrefix = nm3?'PaymentRequest-verify-NM3':'PaymentRequest-verify';
    let url = `${urlBasePath}/payment-requests/${rptId}?recaptchaResponse=test`;
    // Get Payment Request Info NM3
    let response = http.get(
        url,
        {
          tags: { api: tagPrefix },
        }
    );
    check(
      response,
      { "Response status from GET /payment-request was 200": (r) => r.status == 200 },
      { api: tagPrefix }
    );
    //make a verify request for the same rptId to test cache hit response time
    response = http.get(
      url,
      {
        tags: { api: `${tagPrefix}-hitCache` },
      }
  );
  check(
    response,
    { "Response status from GET /payment-request was 200": (r) => r.status == 200 },
    { api: `${tagPrefix}-hitCache` }
  );
  }
