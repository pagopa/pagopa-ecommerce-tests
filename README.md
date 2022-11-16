# Tests for pagopa-ecommerce project
This is a set of [k6](https://k6.io) load tests related to the pagopa-ecommerce services.

All tests require a set of parameters: **rate**, **duration**, **preAllocatedVUs** and **maxVUs**. These parameters are necessary to set the test target to a given number of iteration per second (**rate**) in a given time (**duration**), using a certain number of VUs (**preAllocatedVUs** and **maxVUs**).

To invoke k6 load test passing parameter use -e (or --env) flag:

```
-e MY_VARIABLE=MY_VALUE
```

Let's keep in mind that before perform a load test you have to:

- run `yarn install`
- run `yarn webpack`

## 01. Soak tests

This test require the dispatch of an email.

```
$ docker run -i --rm -v $(pwd)/dist:/dist  -e API_SUBSCRIPTION_KEY=${API_SUBSCRIPTION_KEY} -e URL_BASE_PATH=${URL_BASE_PATH} -e TEST_MAIL_FROM=${TEST_MAIL_FROM} -e TEST_MAIL_TO=${TEST_MAIL_TO} -e rate=${rate} -e duration=${duration} -e preAllocatedVUs=${preAllocatedVUs} -e maxVUs=${maxVUs} loadimpact/k6 run /dist/soak-test-notifications.js
```

To run test and load env vars from `.env` file:

```
$ yarn webpack && docker run -i --rm -v $(pwd)/dist:/dist  --env-file .env loadimpact/k6 run /dist/soak-test-notifications.js
```

## 02. Soak test - request transaction authorization

This test perform a complete transaction authorization flow.
The following steps are performed for each test:
1. GET payment request info NM3 (with a randomly generated rptId)
2. POST transactions for create a new transaction
3. GET the transaction created in the above step
4. GET payment methods for the transaction amount
5. GET PSPs for the payment method retrieved in the above step
6. POST transactions/auth-requests for create an authorization request for the created transaction

```
$ docker run -i --rm -v $(pwd)/dist:/dist -e API_SUBSCRIPTION_KEY=${API_SUBSCRIPTION_KEY} -e URL_BASE_PATH=${URL_BASE_PATH} -e TEST_MAIL_FROM=${TEST_MAIL_FROM} -e TEST_MAIL_TO=${TEST_MAIL_TO} -e rate=${rate} -e duration=${duration} -e preAllocatedVUs=${preAllocatedVUs} -e maxVUs=${maxVUs} loadimpact/k6 run /dist/soak-test-transaction-auth.js
```

To run test and load env vars from `.env` file:

```
$ yarn webpack && docker run -i --rm -v $(pwd)/dist:/dist  --env-file .env loadimpact/k6 run /dist/soak-test-transaction-auth.js
```

## 03. Soak test - carts

This test perform a payment notices cart creation and retrieve
The following steps are performed for each test:
1. POST /carts for create a cart for a given payment notice
2. GET /carts/{cartId} for retrieve the cart created at step 1 (taking cart id from POST response location header)

```
$ docker run -i --rm -v $(pwd)/dist:/dist -e API_SUBSCRIPTION_KEY=${API_SUBSCRIPTION_KEY} -e URL_BASE_PATH=${URL_BASE_PATH} -e TEST_MAIL_FROM=${TEST_MAIL_FROM} -e TEST_MAIL_TO=${TEST_MAIL_TO} -e rate=${rate} -e duration=${duration} -e preAllocatedVUs=${preAllocatedVUs} -e maxVUs=${maxVUs} loadimpact/k6 run /dist/soak-test-carts.js
```

To run test and load env vars from `.env` file:

```
$ yarn webpack && docker run -i --rm -v $(pwd)/dist:/dist  --env-file .env loadimpact/k6 run /dist/soak-test-carts.js
```

## 04. Soak test - verification

This test perform a payment notice verification request (for a given rptId)
The following steps are performed for each test:
1. GET /payment-requests/{rptId} for verify a payment notice status

```
$ docker run -i --rm -v $(pwd)/dist:/dist -e API_SUBSCRIPTION_KEY=${API_SUBSCRIPTION_KEY} -e URL_BASE_PATH=${URL_BASE_PATH} -e TEST_MAIL_FROM=${TEST_MAIL_FROM} -e TEST_MAIL_TO=${TEST_MAIL_TO} -e rate=${rate} -e duration=${duration} -e preAllocatedVUs=${preAllocatedVUs} -e maxVUs=${maxVUs} loadimpact/k6 run /dist/soak-test-verification.js
```

To run test and load env vars from `.env` file:

```
$ yarn webpack && docker run -i --rm -v $(pwd)/dist:/dist  --env-file .env loadimpact/k6 run /dist/soak-test-verification.js
```