# Load test for eCommerce platform using JMeter as tool

This folder contains JMeter related files that contains load tests for eCommerce platform

Those tests can be run locally using JMeter, through [Azure Load test](https://learn.microsoft.com/en-us/azure/app-testing/load-testing/overview-what-is-azure-load-testing) or any other JMeter compatible tool.

## Test scripts

### Soak Test Ecommerce For Checkout

This test run a payment flow using the eCommerce for checkout apis to perform all invocations
from payment notice verification to transaction authorization

### Soak test payment with contextual onboarding

This test cover the `Payment with contextual onboarding` feature, that is the payment flow
used in IO app that allow to perform a payment notice payment performing contextual onboarding.
This test is meant to be executed with real downstream dependencies (such as NPG).
All apis included in payment flow are included, starting from payment notice verification through the authorization request.
This test simulate also user interaction of card data insertion to allow for authorization request to be performed successfully.
This test was meant to be used to find any issue in the flow perform a run with low execution rate.
For this reason this test contains a `ConstantThroughputTimer` to cap maximum rate limit to 10 iteration/s, that is 1 RPS for each api involved in the payment flow since any iteration contains 10 api call
