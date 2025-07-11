package it.pagopa.ecommerce.eventdispatcher.integrationtests.pendingtransactions

import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.eventdispatcher.integrationtests.utils.logger
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
@Order(0)
class CleanEnvTest(@param:Autowired val deadLetterQueueAsyncClient: QueueAsyncClient) {

  @BeforeEach
  fun cleanDlqEvents() {
    // clean DLQ queue
    logger.info("Clearing all DLQ events")
    deadLetterQueueAsyncClient.clearMessages().block()
  }

  @Test fun foo() {}
}
