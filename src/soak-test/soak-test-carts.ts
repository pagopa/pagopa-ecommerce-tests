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
    "http_req_duration{api:PostCarts}": ["p(95)<1000"],//95% of post carts request must complete below 1.0s
    "http_req_duration{api:GetCarts}": ["p(95)<1000"],//95% of get carts request must complete below 1.0s
  },
};


const urlBasePath = config.URL_BASE_PATH;

const headersParams = {
  headers: {
    "Content-Type": "application/json",
  },
  redirects: 0,
};

const cartRequest =  {
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

export default function() {
  let url = `${urlBasePath}/checkout/ec/v1/carts`;
  let res = http.post(url, 
    JSON.stringify(cartRequest),
     {
    ...headersParams,
    tags: { api: "PostCarts" },
  });
  check(
    res,
    { "Response status from POST /carts was 302": (r) => r.status == 302 },
    { api: "PostCarts" } 
  );
  let cartId;
  if(res.status == 302){
    cartId = res.headers["Location"];
    //take the cart id from the response header location value
    cartId = cartId.substring(cartId.lastIndexOf('/')+1);
    url = `${urlBasePath}/checkout/ecommerce/v1/carts/${cartId}`;
    res = http.get(url, {
      ...headersParams,
      tags: { api: "GetCarts" },
    });
    check(
      res,
      { "Response status from GET /carts was 200": (r) => r.status == 200 },
      { api: "GetCarts"  }
    );
  }else{
    console.log("Post carts response code: "+res.status);
    fail("Invalid post carts response received");
  }
  
}
