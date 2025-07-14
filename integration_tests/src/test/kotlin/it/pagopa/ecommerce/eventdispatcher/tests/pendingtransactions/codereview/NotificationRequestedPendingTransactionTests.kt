package it.pagopa.ecommerce.eventdispatcher.tests.pendingtransactions.codereview

import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.commons.documents.v2.TransactionClosureData
import it.pagopa.ecommerce.commons.documents.v2.TransactionUserReceiptData
import it.pagopa.ecommerce.commons.documents.v2.activation.NpgTransactionGatewayActivationData
import it.pagopa.ecommerce.commons.generated.npg.v1.dto.OperationResultDto
import it.pagopa.ecommerce.commons.generated.server.model.TransactionStatusDto
import it.pagopa.ecommerce.commons.v2.TransactionTestUtils
import it.pagopa.ecommerce.eventdispatcher.tests.repository.TransactionsEventStoreRepository
import it.pagopa.ecommerce.eventdispatcher.tests.repository.TransactionsViewRepository
import it.pagopa.ecommerce.eventdispatcher.tests.utils.*
import java.time.Duration
import java.time.ZonedDateTime
import java.util.*
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
@Order(1)
class NotificationRequestedPendingTransactionTests(
  @param:Autowired val eventStoreRepository: TransactionsEventStoreRepository,
  @param:Autowired val viewRepository: TransactionsViewRepository,
  @param:Autowired val expirationQueueAsyncClient: QueueAsyncClient
) {

  @Test
  fun `Should perform refund for NPG transaction stuck in NOTIFICATION_REQUESTED status with KO send payment result outcome`() {
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
    val transactionClosedEvent =
      TransactionTestUtils.transactionClosedEvent(TransactionClosureData.Outcome.OK)
    val transactionAddUserReceiptAddedEvent =
      TransactionTestUtils.transactionUserReceiptRequestedEvent(
        TransactionTestUtils.transactionUserReceiptData(TransactionUserReceiptData.Outcome.KO))
    val transactionTestData =
      IntegrationTestData(
        events =
          listOf(
            transactionActivatedEvent,
            transactionAuthRequestedEvent,
            transactionAuthCompletedEvent,
            transactionClosureRequestedEvent,
            transactionClosedEvent,
            transactionAddUserReceiptAddedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.NOTIFICATION_REQUESTED, ZonedDateTime.now()),
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

  @Test
  fun `Should expire transaction stuck in NOTIFICATION_REQUESTED status with OK send payment result outcome without writing event to DLQ`() {
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
    val transactionClosedEvent =
      TransactionTestUtils.transactionClosedEvent(TransactionClosureData.Outcome.OK)
    val transactionAddUserReceiptAddedEvent =
      TransactionTestUtils.transactionUserReceiptRequestedEvent(
        TransactionTestUtils.transactionUserReceiptData(TransactionUserReceiptData.Outcome.OK))
    val transactionTestData =
      IntegrationTestData(
        events =
          listOf(
            transactionActivatedEvent,
            transactionAuthRequestedEvent,
            transactionAuthCompletedEvent,
            transactionClosureRequestedEvent,
            transactionClosedEvent,
            transactionAddUserReceiptAddedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.NOTIFICATION_REQUESTED, ZonedDateTime.now()),
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
      .block(Duration.ofMinutes(1))
  }
}
