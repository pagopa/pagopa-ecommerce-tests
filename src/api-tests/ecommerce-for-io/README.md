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
**Flow:** Guest payment with cards - SETUP FLOW ONLY
- Tests the new card save choice functionality ("No, non salvare")
- Validates setup phase: session → payment method session → transaction → cleanup
- **LIMITATION:** Does not test fees/auth (requires browser)

### 4. `ecommerce-for-io-contextual-onboarding.postman_collection.json`
**Flow:** Contextual onboarding with cards - SETUP FLOW ONLY
- Tests the new card save choice functionality ("Sì, salva la carta")
- Validates setup phase: session → payment info → payment methods → redirect URL → webview transaction → wallet creation → wallet NPG session → status validation → cleanup
- Includes validation checks for transaction and wallet status
- **LIMITATION:** Does not test card submission/fees/auth/wallet validation (requires browser)

---

## Guest Card Payment - Setup Flow

### What This Flow Tests

This collection validates the **setup phase** of the new guest card payment flow with card save choice. When users navigate to the payment page in a browser, they see a choice:
- **"Sì, salva la carta"** → Contextual onboarding (separate collection)
- **"No, non salvare"** → Guest payment (THIS COLLECTION)

When the user chooses "No", the browser automatically calls `POST /ecommerce/webview/v1/payment-methods/{id}/sessions` to create a session and generate an `orderId`. This collection simulates that browser behavior for API testing.

### API Flow (Setup Phase Only)

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
   - Sets `ORDER_ID` and `CORRELATION_ID`

6. **Start Transaction** → `POST /ecommerce/io/v2/transactions`
   - Creates transaction with `RPTID` and `AMOUNT`
   - Returns `transactionId` with status `ACTIVATED`
   - Sets `TRANSACTION_ID`

7. **Delete Transaction** → `DELETE /ecommerce/io/v2/transactions/{id}`
   - Cleans up the ACTIVATED transaction
   - Returns `202 Accepted`

---

## Contextual Onboarding - Setup Flow

### What This Flow Tests

This collection validates the **setup phase** of the new contextual onboarding flow with card save choice. When users navigate to the payment page in a browser, they see a choice:
- **"Sì, salva la carta"** → Contextual onboarding (THIS COLLECTION)
- **"No, non salvare"** → Guest payment (separate collection)

When the user chooses "Sì", fills card details and submits through NPG iframes, the browser generates a "magic link" containing both `walletId` and `transactionId`. The API flow would then use these values for fees, authorization, and wallet validation.

### API Flow (Setup Phase Only)

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
   - Extracts `WEBVIEW_SESSION_TOKEN` from the URL

5. **Create Webview Transaction** → `POST /ecommerce/webview/v1/transactions`
   - Simulates browser behavior when user chooses "Sì, salva la carta"
   - Uses `WEBVIEW_SESSION_TOKEN` from redirect URL
   - Creates transaction with `RPTID` and `AMOUNT`
   - Returns `transactionId` and `authToken`
   - Sets `TRANSACTION_ID` and `ECOMMERCE_AUTH_TOKEN`

6. **Create Wallet** → `POST /ecommerce/webview/v1/transactions/{id}/wallets`
   - Creates wallet associated with the transaction
   - Uses `x-ecommerce-session-token` header with `ECOMMERCE_AUTH_TOKEN`
   - Returns `walletId` and redirect URL with wallet JWT token
   - Sets `WALLET_ID` and `WALLET_JWT_TOKEN`

7. **Create Wallet Session** → `POST /webview-payment-wallet/v1/wallets/{id}/sessions`
   - Creates NPG session for wallet
   - Uses `WALLET_JWT_TOKEN` for authentication
   - Returns `orderId` and NPG iframe form fields
   - Sets `ORDER_ID`

8. **Get Transaction Status** → `GET /ecommerce/io/v2/transactions/{id}`
   - Validates transaction is in `ACTIVATED` state
   - Uses `SESSION_TOKEN` for authentication
   - Returns transaction details and current status

9. **Get Wallet Status** → `GET /io-payment-wallet/v1/wallets/{id}`
   - Validates wallet status (expected: `CREATED` or `INITIALIZED`)
   - Uses `SESSION_TOKEN` for authentication
   - Returns wallet details and current status

10. **Delete Transaction** → `DELETE /ecommerce/io/v2/transactions/{id}`
   - Cleans up the ACTIVATED transaction
   - Uses `SESSION_TOKEN` for authentication
   - Returns `202 Accepted`

11. **Delete Wallet** → `DELETE /io-payment-wallet/v1/wallets/{id}`
   - Cleans up the created wallet
   - Uses `SESSION_TOKEN` for authentication
   - Returns `204 No Content`

### Key Differences: Contextual Onboarding vs Guest Cards

| Aspect                  | Contextual Onboarding                              | Guest Cards                                           |
|-------------------------|----------------------------------------------------|-------------------------------------------------------|
| User choice             | "Sì, salva la carta"                               | "No, non salvare"                                     |
| Card saved to wallet?   | ✅ Yes                                              | ❌ No                                                  |
| Wallet creation         | ✅ Tested (`POST /wallets`)                         | ❌ Not applicable                                      |
| Session endpoint        | `/webview-payment-wallet/v1/wallets/{id}/sessions` | `/ecommerce/webview/v1/payment-methods/{id}/sessions` |
| Transaction creation    | ✅ Tested (`POST /webview/v1/transactions`)         | ✅ Tested (`POST /io/v2/transactions`)                 |
| Magic link contains     | `walletId` + `transactionId`                       | `orderId`                                             |
| Fees request body       | `{"walletId": "..."}`                              | `{"orderId": "..."}`                                  |
| Auth detail type        | `"wallet"`                                         | `"cards"`                                             |
| Auth requires           | `walletId`                                         | `orderId` + `paymentMethodId`                         |
| Post-payment validation | Wallet status = `VALIDATED`                        | N/A                                                   |
| Cleanup (API tests)     | ✅ Transaction + Wallet deletion tested             | ✅ Transaction deletion tested                         |

---

## Environment Variables

### Required Variables (passed via `--env-var` in pipeline)

| Variable              | Description               | Example Value                          |
|-----------------------|---------------------------|----------------------------------------|
| `HOSTNAME`            | API base URL              | `https://api.dev.platform.pagopa.it`   |
| `USER_ID`             | Test user ID              | `05b47118-ac54-4324-90f0-59a784972184` |
| `WALLET_TOKEN_TEST`   | Session wallet auth token | `$(WALLET_TOKEN_TEST_DEV)` (secret)    |
| `PAYMENT_METHOD_NAME` | Payment method to use     | `"CARDS"`                              |

### Dynamically Set Variables (by collection)

| Variable                | Set By                        | Description                                       |
|-------------------------|-------------------------------|---------------------------------------------------|
| `SESSION_TOKEN`         | Start session                 | Session authentication token                      |
| `RPTID_NM3`             | Pre-request script            | Randomly generated RPTID                          |
| `PAYMENT_TOKEN`         | Get payment info              | Payment context code                              |
| `AMOUNT`                | Get payment info              | Payment amount (e.g., 12000 cents)                |
| `PAYMENT_METHOD_ID`     | Get payment methods           | Payment method ID for CARDS                       |
| `WEBVIEW_SESSION_TOKEN` | Get redirect URL              | Extracted from redirectUrl for the session        |
| `ORDER_ID`              | Create NPG session            | orderId from session creation                     |
| `CORRELATION_ID`        | Create payment method session | Correlation ID (guest cards only)                 |
| `TRANSACTION_ID`        | Create transaction            | Created transaction ID                            |
| `WALLET_ID`             | Create wallet                 | Created wallet ID (contextual onboarding only)    |
| `ECOMMERCE_AUTH_TOKEN`  | Create webview transaction    | eCommerce auth token (contextual onboarding only) |
| `WALLET_JWT_TOKEN`      | Create wallet                 | Wallet JWT token (contextual onboarding only)     |

---

## Running the Tests

### Guest Cards Flow

#### Via Newman (CI Pipeline)
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

#### Via Postman UI (Local Testing)
1. Import `ecommerce-for-io-payguest-cards.postman_collection.json`
2. Set environment variables:
   - `HOSTNAME`: `https://api.dev.platform.pagopa.it`
   - `USER_ID`: `05b47118-ac54-4324-90f0-59a784972184`
   - `PAYMENT_METHOD_NAME`: `CARDS`
   - `WALLET_TOKEN_TEST`: `<your-test-token>`
3. Run collection

---

### Contextual Onboarding Flow

#### Via Newman (CI Pipeline)
```bash
newman run src/api-tests/ecommerce-for-io/ecommerce-for-io-contextual-onboarding.postman_collection.json \
  --env-var USER_ID="<valid_id>" \
  --env-var PAYMENT_METHOD_NAME="CARDS" \
  --env-var HOSTNAME="https://api.dev.platform.pagopa.it" \
  --env-var WALLET_TOKEN_TEST="<secret-token>" \
  --ignore-redirects \
  --reporters cli,junit \
  --reporter-junit-export Results/contextual-onboarding-api-TEST.xml
```

#### Via Postman UI (Local Testing)
1. Import `ecommerce-for-io-contextual-onboarding.postman_collection.json`
2. Set environment variables:
   - `HOSTNAME`: `https://api.dev.platform.pagopa.it`
   - `USER_ID`: `<valid_id`
   - `PAYMENT_METHOD_NAME`: `CARDS`
   - `WALLET_TOKEN_TEST`: `<secret>`
3. Run collection

