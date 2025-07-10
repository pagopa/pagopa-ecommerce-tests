package it.pagopa.ecommerce.eventdispatcher.integrationtests

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class EventDispatcherIntegrationTestsApplication

fun main(args: Array<String>) {
    runApplication<EventDispatcherIntegrationTestsApplication>(*args)
}
