package it.pagopa.ecommerce.eventdispatcher.integrationtests.pendingtransactions

import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.commons.generated.server.model.TransactionStatusDto
import it.pagopa.ecommerce.commons.v2.TransactionTestUtils
import it.pagopa.ecommerce.eventdispatcher.integrationtests.repository.TransactionsEventStoreRepository
import it.pagopa.ecommerce.eventdispatcher.integrationtests.repository.TransactionsViewRepository
import it.pagopa.ecommerce.eventdispatcher.integrationtests.utils.*
import java.time.Duration
import java.time.ZonedDateTime
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
@Order(1)
class ActivatedOnlyPendingTransactionTests(
  @param:Autowired val eventStoreRepository: TransactionsEventStoreRepository,
  @param:Autowired val viewRepository: TransactionsViewRepository,
  @param:Autowired val expirationQueueAsyncClient: QueueAsyncClient
) {

  @Test
  fun `Should handle transaction stuck in ACTIVATED status once expired updating in EXPIRED_NOT_AUTHORIZED status`() {
    // pre-conditions
    val testTransactionId = getProgressiveTrxId()
    val transactionTestData =
      IntegrationTestData(
        events = listOf(TransactionTestUtils.transactionActivateEvent()),
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
