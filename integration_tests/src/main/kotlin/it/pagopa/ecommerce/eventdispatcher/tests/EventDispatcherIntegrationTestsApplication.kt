package it.pagopa.ecommerce.eventdispatcher.tests

import it.pagopa.ecommerce.eventdispatcher.tests.configs.testdata.TransactionConf
import it.pagopa.ecommerce.eventdispatcher.tests.configs.testdata.gateway.NpgPaymentConf
import it.pagopa.ecommerce.eventdispatcher.tests.configs.testdata.gateway.RedirectPaymentConf
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import reactor.core.publisher.Hooks

@SpringBootApplication
@EnableConfigurationProperties(
  NpgPaymentConf::class, RedirectPaymentConf::class, TransactionConf::class)
class EventDispatcherIntegrationTestsApplication

fun main(args: Array<String>) {
  Hooks.onOperatorDebug()
  runApplication<EventDispatcherIntegrationTestsApplication>(*args)
}
