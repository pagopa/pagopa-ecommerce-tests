# eCommerce for IO API Tests

This directory contains Postman collections for testing eCommerce for IO payment flows.

## Collections

### 1. `ecommerce-for-io-paywallet.postman_collection.json`
**Flow:** Wallet-based payment (onboarded cards/PayPal)
- User has already onboarded a card or PayPal account
- Payment uses `walletId` to reference saved payment method
- Complete flow from session to authorization

### 2. `ecommerce-for-io-payguest.postman_collection.json`
**Flow:** Guest payment with APM (PayPal, BancomatPay)
- User pays without saving payment method
- Supports non-card payment methods (PayPal, BPAY)
- Complete flow from session to authorization

### 3. `ecommerce-for-io-payguest-cards.postman_collection.json`
**Flow:** Guest payment with cards
- Tests the new card save choice functionality ("No, non salvare")
- Complete E2E flow: session → NPG card entry → fees → authorization → outcomes
- Validates payment without wallet onboarding
- Uses hardcoded test card data for NPG submission

---

## Guest Card Payment

### What This Flow Tests

This collection validates the **complete end-to-end** guest card payment flow with card save choice. When users navigate to the payment page in a browser, they see a choice:
- **"Sì, salva la carta"** → Contextual onboarding (separate collection)
- **"No, non salvare"** → Guest payment (THIS COLLECTION)

When the user chooses "No", the flow proceeds through NPG card data entry, payment authorization, and outcome validation - all without creating a persistent wallet.

### API Flow

1. **Start Session** → `POST /session-wallet/mock/v1/session`
   - Creates session with `userId`
   - Returns `SESSION_TOKEN`

2. **Get Payment Info** → `GET /ecommerce/io/v2/payment-requests/{rptId}`
   - Randomly generated RPTID
   - Returns payment details and `AMOUNT`

3. **Get Payment Methods** → `GET /ecommerce/io/v2/payment-methods`
   - Filters by `PAYMENT_METHOD_NAME="CARDS"`
   - Sets `PAYMENT_METHOD_ID`

4. **Get Redirect URL** → `GET /ecommerce/io/v2/payment-methods/{id}/redirectUrl`
   - Returns URL to card save choice page (`scelta-salvataggio-carta`)
   - Extracts `sessionToken` from the URL

5. **Create Payment Method Session** → `POST /ecommerce/webview/v1/payment-methods/{id}/sessions`
   - Simulates browser behavior when user chooses "No, non salvare"
   - Uses `WEBVIEW_SESSION_TOKEN` from redirect URL
   - Returns `orderId` and NPG iframe form data
   - Extracts NPG session data: `NPG_CORRELATION_ID`, `NPG_SESSION_ID`
   - Sets `ORDER_ID`

6. **Get NPG Field Settings** → `GET https://stg-ta.nexigroup.com/fe/build/field_settings/CARD_NUMBER`
   - Initializes NPG cookies for card data entry
   - Uses extracted `NPG_CORRELATION_ID` and `NPG_SESSION_ID` headers

7. **Fill NPG Card Data** → `POST https://stg-ta.nexigroup.com/fe/build/text/`
   - Submits test card data to NPG iframe
   - Hardcoded values: `4242424242424242`, `12/30`, `123`, `Test Test`
   - Uses NPG session headers

8. **Start Transaction** → `POST /ecommerce/io/v2/transactions`
   - Creates transaction with `RPTID` and `AMOUNT`
   - Returns `transactionId` with status `ACTIVATED`
   - Saves `authToken` as `OUTCOME_TOKEN` for outcomes API
   - Sets `TRANSACTION_ID`

9. **Get Fees** → `POST /ecommerce/io/v2/payment-methods/{id}/fees`
   - Retrieves payment fees and available PSPs
   - Uses hardcoded PSP: `BNLIITRR` and fee: `95`
   - Request body includes `orderId`, `paymentAmount`, `transferList`

10. **Start Authorization** → `POST /ecommerce/io/v2/transactions/{id}/auth-requests`
    - Initiates payment authorization
    - Uses hardcoded PSP `BNLIITRR` and fee `95`
    - Details type: `cards` with `orderId` and `paymentMethodId`
    - Returns `authorizationUrl`

11. **Get Transaction Outcomes** → `GET /ecommerce/webview/v1/transactions/{id}/outcomes`
    - Validates final transaction outcome
    - Uses `OUTCOME_TOKEN` (authToken from transaction creation)
    - Checks outcome code and `isFinalStatus`

---

## Environment Variables

### Required Variables (passed via `--env-var` in pipeline)

| Variable              | Description               | Example Value                                |
|-----------------------|---------------------------|----------------------------------------------|
| `HOSTNAME`            | API base URL              | `https://api.dev.platform.pagopa.it`         |
| `USER_ID`             | Test user ID              | `05b47118-ac54-4324-90f0-59a784972184` (DEV) |
| `WALLET_TOKEN_TEST`   | Session wallet auth token | `$(WALLET_TOKEN_TEST_DEV)` (secret)          |
| `PAYMENT_METHOD_NAME` | Payment method to use     | `"CARDS"`                                    |

### Dynamically Set Variables (by collection)

| Variable                | Set By                        | Description                                   |
|-------------------------|-------------------------------|-----------------------------------------------|
| `SESSION_TOKEN`         | Start session                 | Session authentication token                  |
| `RPTID_NM3`             | Pre-request script            | Randomly generated RPTID                      |
| `PAYMENT_TOKEN`         | Get payment info              | Payment context code                          |
| `AMOUNT`                | Get payment info              | Payment amount (e.g., 12000 cents)            |
| `PAYMENT_METHOD_ID`     | Get payment methods           | Payment method ID for CARDS                   |
| `WEBVIEW_SESSION_TOKEN` | Get redirect URL test         | Extracted from redirectUrl for NPG session    |
| `ORDER_ID`              | Create payment method session | orderId from NPG session creation             |
| `NPG_CORRELATION_ID`    | Create payment method session | NPG correlation ID (extracted from form src)  |
| `NPG_SESSION_ID`        | Create payment method session | NPG session ID (extracted from form src)      |
| `NPG_IFRAME_FIELD_URL`  | Create payment method session | Full NPG iframe field URL                     |
| `TRANSACTION_ID`        | Start transaction             | Created transaction ID                        |
| `OUTCOME_TOKEN`         | Start transaction             | authToken for transaction outcomes API        |

### Hardcoded Values (in collection)

| Variable               | Value                                  | Description                    |
|------------------------|----------------------------------------|--------------------------------|
| `NPG_HOST`             | `https://stg-ta.nexigroup.com`         | NPG server URL                 |
| `NPG_TEST_CARD_PAN`    | `4242424242424242`                     | Test card number               |
| `NPG_TEST_EXPIRATION`  | `12/30`                                | Test card expiration           |
| `NPG_TEST_CVV`         | `123`                                  | Test card CVV                  |
| `NPG_TEST_CARDHOLDER`  | `Test Test`                            | Test cardholder name           |
| `NPG_IFRAME_FIELD_ID`  | `CARD_NUMBER`                          | NPG field identifier           |
| `ID_PSP`               | `BNLIITRR`                             | PSP identifier for fees/auth   |
| `FEE`                  | `95`                                   | Payment fee in cents           |

---

## Running the Tests

### Via Newman (CI Pipeline)
```bash
newman run src/api-tests/ecommerce-for-io/ecommerce-for-io-payguest-cards.postman_collection.json \
  --env-var USER_ID="05b47118-ac54-4324-90f0-59a784972184" \
  --env-var PAYMENT_METHOD_NAME="CARDS" \
  --env-var HOSTNAME="https://api.dev.platform.pagopa.it" \
  --env-var WALLET_TOKEN_TEST="<secret-token>" \
  --ignore-redirects \
  --reporters cli,junit \
  --reporter-junit-export Results/guest-cards-api-TEST.xml
```

### Via Postman UI (Local Testing)
1. Import `ecommerce-for-io-payguest-cards.postman_collection.json`
2. Set environment variables:
   - `HOSTNAME`: `https://api.dev.platform.pagopa.it`
   - `USER_ID`: `05b47118-ac54-4324-90f0-59a784972184`
   - `PAYMENT_METHOD_NAME`: `CARDS`
   - `WALLET_TOKEN_TEST`: `<your-test-token>`
3. Run collection

