package it.pagopa.ecommerce.eventdispatcher.integrationtests.pendingtransactions

import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.commons.documents.v2.TransactionEvent
import it.pagopa.ecommerce.commons.domain.v2.TransactionId
import it.pagopa.ecommerce.commons.generated.server.model.TransactionStatusDto
import it.pagopa.ecommerce.commons.v2.TransactionTestUtils
import it.pagopa.ecommerce.eventdispatcher.integrationtests.repository.TransactionsEventStoreRepository
import it.pagopa.ecommerce.eventdispatcher.integrationtests.repository.TransactionsViewRepository
import it.pagopa.ecommerce.eventdispatcher.integrationtests.utils.IntegrationTestData
import it.pagopa.ecommerce.eventdispatcher.integrationtests.utils.pollTransactionForWantedStatus
import it.pagopa.ecommerce.eventdispatcher.integrationtests.utils.populateDbWithTestData
import it.pagopa.ecommerce.eventdispatcher.integrationtests.utils.sendExpirationEventToQueue
import java.time.Duration
import java.time.ZonedDateTime
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
class ActivatedOnlyPendingTransactionTests(
  @param:Autowired val eventStoreRepository: TransactionsEventStoreRepository,
  @param:Autowired val viewRepository: TransactionsViewRepository,
  @param:Autowired val expirationQueueAsyncClient: QueueAsyncClient
) {

  @Test
  fun `Should handle transaction stuck in ACTIVATED status once expired updating in EXPIRED_NOT_AUTHORIZED status`() {
    // pre-conditions
    val testTransactionId = TransactionId("10000000000000000000000000000000")
    val transactionTestData =
      IntegrationTestData(
        events = listOf(TransactionTestUtils.transactionActivateEvent() as TransactionEvent<Any>),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.ACTIVATED, ZonedDateTime.now()),
        testTransactionId = testTransactionId)
    // populate DB with events
    populateDbWithTestData(
        eventStoreRepository = eventStoreRepository,
        viewRepository = viewRepository,
        integrationTestData = transactionTestData)
      .then(
        sendExpirationEventToQueue(
          testData = transactionTestData, queueAsyncClient = expirationQueueAsyncClient))
      .flatMap {
        pollTransactionForWantedStatus(
          viewRepository = viewRepository,
          wantedStatus = TransactionStatusDto.EXPIRED_NOT_AUTHORIZED,
          transactionId = testTransactionId)
      }
      .block(Duration.ofMinutes(1))
  }
}
