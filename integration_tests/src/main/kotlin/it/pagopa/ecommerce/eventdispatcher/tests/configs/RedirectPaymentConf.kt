package it.pagopa.ecommerce.eventdispatcher.tests.configs

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "redirect-test-conf")
data class RedirectPaymentConf(val pspId: String, val paymentTypeCode: String)
