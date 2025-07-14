package it.pagopa.ecommerce.eventdispatcher.tests

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import reactor.core.publisher.Hooks

@SpringBootApplication class EventDispatcherIntegrationTestsApplication

fun main(args: Array<String>) {
  Hooks.onOperatorDebug()
  runApplication<EventDispatcherIntegrationTestsApplication>(*args)
}
