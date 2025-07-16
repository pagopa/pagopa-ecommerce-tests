package it.pagopa.ecommerce.eventdispatcher.tests.configs.testdata

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "transaction-test-conf")
class TransactionConf(val userMailPdvToken: String)
