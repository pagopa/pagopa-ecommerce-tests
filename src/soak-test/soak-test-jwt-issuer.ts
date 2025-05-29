import { check } from "k6";
import http from "k6/http";
import { getJwtIssuerTestConfigOrThrow } from "../utils/config";
import { KJUR, KEYUTIL,b64utoutf8,b64utohex } from "jsrsasign";

const config = getJwtIssuerTestConfigOrThrow();

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
    http_req_duration: ["p(99)<1000"], // 99% of requests must complete below 1s
    checks: ['rate>0.95'], // 90% of the request must be completed
    "http_req_duration{name:create-token-test}": ["p(95)<100"],
    "http_req_duration{name:get-keys-test}": ["p(95)<750"]
  },
};

export default function () {
  const urlBasePath = config.URL_BASE_PATH;
  const bodyRequest = {
    audience: "audience",
    duration: 300,
    privateClaims: {
      customClaim1: "customClaim1",
      customClaim2: "customClaim2"
    }
  }

  const headersParams = {
    headers: {
      'Content-Type': 'application/json'
    },
  };

  let tokensUrl = `${urlBasePath}/tokens`;
  let tokenResponse = http.post(tokensUrl, JSON.stringify(bodyRequest), {
    ...headersParams,
    tags: { name: "create-token-test" },
  });

  let keysUrl = `${urlBasePath}/tokens/keys`;
  let keysResponse = http.get(keysUrl, {
    ...headersParams,
    tags: { name: "get-keys-test" },
  });

  check(
    tokenResponse,
    { "Response status from POST /tokens was 200": (r) => r.status == 200 },
    { name: "create-token-test"  }
  );

  check(
    keysResponse,
    {"Response status from Get /tokens/keys was 200": (r) => r.status == 200},
    {name: "get-keys-test"}
  )

  // Parse the token response body to extract the JWT token
  const jwtToken = JSON.parse(tokenResponse.body).token;

  // Parse the keys response
  const keys = JSON.parse(keysResponse.body).keys;

  // Find the key with the matching kid
  const jwtParts = jwtToken.split(".");
  const headerBase64Url = jwtParts[0];

  // Manually decode base64url to get the header JSON
  const headerJson = b64utoutf8(headerBase64Url);
  const header = JSON.parse(headerJson);

  // Find the key with the matching kid
  const key = keys.find(k => k.kid === header.kid);

  check(
    { key },
    { "Public key found": (r) => key != null },
    { name: "jwt-public-key" }
  );

  if (key) {
    // Convert modulus and exponent from base64url to hex
    const modulusHex = b64utohex(key.n);
    const exponentHex = b64utohex(key.e);

    // Create a public key object
    const pubKey = KEYUTIL.getKey({
      n: modulusHex,
      e: exponentHex,
    });

    // Verify the JWT signature
    const isValid = KJUR.jws.JWS.verifyJWT(jwtToken, pubKey, { alg: ["RS256"] });

    check(
      { isValid },
      { "JWT signature is valid": (r) => r.isValid },
      { name: "jwt-signature-verification" }
    );
  } else {
    console.error('No matching key found for kid: ${header.kid}, keys retrieved:', keys);
  }
}
