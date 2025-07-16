package it.pagopa.ecommerce.eventdispatcher.tests.configs.testdata.gateway

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "npg-test-conf")
data class NpgPaymentConf(val pspId: String, val paymentTypeCode: String)
