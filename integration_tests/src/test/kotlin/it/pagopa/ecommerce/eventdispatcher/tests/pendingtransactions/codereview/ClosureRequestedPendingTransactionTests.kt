package it.pagopa.ecommerce.eventdispatcher.tests.pendingtransactions.codereview

import com.azure.core.util.serializer.TypeReference
import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.commons.documents.v2.TransactionActivatedEvent
import it.pagopa.ecommerce.commons.documents.v2.activation.NpgTransactionGatewayActivationData
import it.pagopa.ecommerce.commons.domain.v2.TransactionEventCode
import it.pagopa.ecommerce.commons.generated.npg.v1.dto.OperationResultDto
import it.pagopa.ecommerce.commons.generated.server.model.TransactionStatusDto
import it.pagopa.ecommerce.commons.queues.QueueEvent
import it.pagopa.ecommerce.commons.v2.TransactionTestUtils
import it.pagopa.ecommerce.eventdispatcher.tests.repository.TransactionsEventStoreRepository
import it.pagopa.ecommerce.eventdispatcher.tests.repository.TransactionsViewRepository
import it.pagopa.ecommerce.eventdispatcher.tests.utils.*
import java.time.Duration
import java.time.ZonedDateTime
import java.util.*
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
@Order(1)
class ClosureRequestedPendingTransactionTests(
  @param:Autowired val eventStoreRepository: TransactionsEventStoreRepository,
  @param:Autowired val viewRepository: TransactionsViewRepository,
  @param:Autowired val expirationQueueAsyncClient: QueueAsyncClient,
  @param:Autowired val deadLetterQueueAsyncClient: QueueAsyncClient
) {

  @Test
  fun `Should write event in DLQ for NPG transaction stuck in CLOSURE_REQUESTED status that have been authorized by gateway`() {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val npgActivationData = TransactionTestUtils.npgTransactionGatewayActivationData()
    (npgActivationData as NpgTransactionGatewayActivationData).correlationId =
      UUID.randomUUID().toString()
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    val transactionAuthCompletedEvent =
      TransactionTestUtils.transactionAuthorizationCompletedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationData(OperationResultDto.EXECUTED))
    transactionAuthRequestedEvent.data.pspId = "BCITITMM"
    val transactionClosureRequestedEvent = TransactionTestUtils.transactionClosureRequestedEvent()
    val transactionTestData =
      IntegrationTestData(
        events =
          listOf(
            transactionActivatedEvent,
            transactionAuthRequestedEvent,
            transactionAuthCompletedEvent,
            transactionClosureRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.CLOSURE_REQUESTED, ZonedDateTime.now()),
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
          wantedStatus = TransactionStatusDto.EXPIRED,
          transactionId = testTransactionId)
      }
      .flatMap {
        readEventFromQueue(
            queueAsyncClient = deadLetterQueueAsyncClient,
            typeReference = object : TypeReference<QueueEvent<TransactionActivatedEvent>>() {},
            transactionId = testTransactionId)
          .doOnNext {
            assertEquals(TransactionEventCode.TRANSACTION_ACTIVATED_EVENT.toString(), it.eventCode)
          }
      }
      .block(Duration.ofMinutes(1))
  }
}
