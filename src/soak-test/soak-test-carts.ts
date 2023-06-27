import { check, fail, sleep } from "k6";
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
    "http_req_duration{name:PostCarts}": ["p(95)<1000"],//95% of post carts request must complete below 1s
    "http_req_duration{name:GetCarts}": ["p(95)<1000"],//95% of get carts request must complete below 1s
  },
};


const urlBasePath = config.URL_BASE_PATH;

const headersParams = {
  headers: {
    "Content-Type": "application/json",
  },
  redirects: 0,
};

const cartRequest = {
  paymentNotices: [
    {
      noticeNumber: "302000100440009424",
      fiscalCode: "77777777777",
      amount: 10000,
      companyName: "Test company",
      description: "Payment notice description"
    }
  ],
  returnUrls: {
    returnOkUrl: "https://returnOkUrl",
    returnCancelUrl: "https://returnCancelUrl",
    returnErrorUrl: "https://returnErrorUrl"
  },
  emailNotice: "test@test.it"
}

export default function () {
  let url = `${urlBasePath}/checkout/ec/v1/carts`;
  let res = http.post(url,
    JSON.stringify(cartRequest),
    {
      ...headersParams,
      tags: { name: "PostCarts" },
    });
  check(
    res,
    { "Response status from POST /carts was 302": (r) => r.status == 302 },
    { name: "PostCarts" }
  );
  let cartId;
  if (res.status == 302) {
    cartId = res.headers["Location"];
    //take the cart id from the response header location value
    let endIdx = cartId.lastIndexOf('/') ;
    cartId = cartId.substring(endIdx-36,endIdx);
    url = `${urlBasePath}/ecommerce/checkout/v1/carts/${cartId}`;
    res = http.get(url, {
      ...headersParams,
      tags: { name: "GetCarts" },
    });
    check(
      res,
      { "Response status from GET /carts was 200": (r) => r.status == 200 },
      { name: "GetCarts" }
    );
  } else {
    console.log("Post carts response code: " + res.status);
    fail("Invalid post carts response received");
  }

}
