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
class AuthorizationRequestedOnlyPendingTransactionTests(
  @param:Autowired val eventStoreRepository: TransactionsEventStoreRepository,
  @param:Autowired val viewRepository: TransactionsViewRepository,
  @param:Autowired val expirationQueueAsyncClient: QueueAsyncClient,
  @param:Autowired val deadLetterQueueAsyncClient: QueueAsyncClient
) {

  @Test
  fun `Should handle NPG transaction in AUTHORIZATION_REQUESTED status performing refund for valid GET order response`() {
    // pre-conditions
    val testTransactionId = TransactionId("20000000000000000000000000000000")
    val npgActivationData = TransactionTestUtils.npgTransactionGatewayActivationData()
    val transactionActivatedEvent =
      TransactionTestUtils.transactionActivateEvent(npgActivationData) as TransactionEvent<Any>
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    val transactionTestData =
      IntegrationTestData(
        events =
          listOf(
            transactionActivatedEvent as TransactionEvent<Any>,
            transactionAuthRequestedEvent as TransactionEvent<Any>),
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
          wantedStatus = TransactionStatusDto.REFUNDED,
          transactionId = testTransactionId)
      }
      .block(Duration.ofMinutes(1))
  }
}
