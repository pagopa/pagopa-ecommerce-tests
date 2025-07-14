package it.pagopa.ecommerce.eventdispatcher.tests.pendingtransactions.codereview

import com.azure.core.util.serializer.TypeReference
import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.commons.documents.v2.TransactionActivatedEvent
import it.pagopa.ecommerce.commons.documents.v2.TransactionAuthorizationRequestData
import it.pagopa.ecommerce.commons.documents.v2.TransactionRefundRequestedEvent
import it.pagopa.ecommerce.commons.documents.v2.TransactionRefundRetriedEvent
import it.pagopa.ecommerce.commons.documents.v2.activation.NpgTransactionGatewayActivationData
import it.pagopa.ecommerce.commons.domain.v2.TransactionEventCode
import it.pagopa.ecommerce.commons.domain.v2.TransactionId
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
    val testTransactionId = getProgressiveTransactionId()
    val npgActivationData = TransactionTestUtils.npgTransactionGatewayActivationData()
    (npgActivationData as NpgTransactionGatewayActivationData).correlationId =
      UUID.randomUUID().toString()
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    transactionAuthRequestedEvent.data.pspId = "BCITITMM"
    val transactionTestData =
      IntegrationTestData(
        events = listOf(transactionActivatedEvent, transactionAuthRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.AUTHORIZATION_REQUESTED, ZonedDateTime.now()),
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
  fun `Should handle NPG transaction in AUTHORIZATION_REQUESTED status writing event to DLQ for transaction already refund in GET order response`() {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val npgOrderId =
      "E00000000000000000" // NPG mock order id used to return already refund transaction
    val npgActivationData: NpgTransactionGatewayActivationData =
      TransactionTestUtils.npgTransactionGatewayActivationData()
        as NpgTransactionGatewayActivationData
    npgActivationData.correlationId = UUID.randomUUID().toString()
    npgActivationData.orderId = npgOrderId
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    transactionAuthRequestedEvent.data.pspId = "BCITITMM" // set intesa as PSP
    transactionAuthRequestedEvent.data.authorizationRequestId =
      npgOrderId // set NPG order id as authorization request id
    val transactionTestData =
      IntegrationTestData(
        events = listOf(transactionActivatedEvent, transactionAuthRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.AUTHORIZATION_REQUESTED, ZonedDateTime.now()),
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
          wantedStatus = TransactionStatusDto.REFUND_ERROR,
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

  @Test
  fun `Should handle NPG transaction in AUTHORIZATION_REQUESTED status writing event to DLQ for 4xx in GET order`() {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val npgOrderId = "E00000000000000001" // NPG mock order id used to return 404
    val npgActivationData: NpgTransactionGatewayActivationData =
      TransactionTestUtils.npgTransactionGatewayActivationData()
        as NpgTransactionGatewayActivationData
    npgActivationData.correlationId = UUID.randomUUID().toString()
    npgActivationData.orderId = npgOrderId
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    transactionAuthRequestedEvent.data.pspId = "BCITITMM" // set intesa as PSP
    transactionAuthRequestedEvent.data.authorizationRequestId =
      npgOrderId // set NPG order id as authorization request id
    val transactionTestData =
      IntegrationTestData(
        events = listOf(transactionActivatedEvent, transactionAuthRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.AUTHORIZATION_REQUESTED, ZonedDateTime.now()),
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

  @Test
  fun `Should handle NPG transaction in AUTHORIZATION_REQUESTED status writing event to DLQ for 5xx in GET order`() {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val npgOrderId = "E00000000000000002" // NPG mock order id used to return 500
    val npgActivationData: NpgTransactionGatewayActivationData =
      TransactionTestUtils.npgTransactionGatewayActivationData()
        as NpgTransactionGatewayActivationData
    npgActivationData.correlationId = UUID.randomUUID().toString()
    npgActivationData.orderId = npgOrderId
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    transactionAuthRequestedEvent.data.pspId = "BCITITMM" // set intesa as PSP
    transactionAuthRequestedEvent.data.authorizationRequestId =
      npgOrderId // set NPG order id as authorization request id
    val transactionTestData =
      IntegrationTestData(
        events = listOf(transactionActivatedEvent, transactionAuthRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.AUTHORIZATION_REQUESTED, ZonedDateTime.now()),
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
          wantedStatus = TransactionStatusDto.REFUND_ERROR,
          transactionId = testTransactionId)
      }
      .flatMap {
        readEventFromQueue(
            queueAsyncClient = deadLetterQueueAsyncClient,
            typeReference = object : TypeReference<QueueEvent<TransactionRefundRetriedEvent>>() {},
            transactionId = testTransactionId)
          .doOnNext {
            assertEquals(
              TransactionEventCode.TRANSACTION_REFUND_RETRIED_EVENT.toString(), it.eventCode)
          }
      }
      .block(Duration.ofMinutes(1))
  }

  @Test
  fun `Should handle Redirect transaction in AUTHORIZATION_REQUESTED status performing refund successfully`() {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent()
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionAuthorizationRequestData.PaymentGateway.REDIRECT,
        TransactionTestUtils.redirectTransactionGatewayAuthorizationRequestedData())
    transactionAuthRequestedEvent.data.pspId = "BCITITMM"
    transactionAuthRequestedEvent.data.paymentTypeCode = "RBPR"
    val transactionTestData =
      IntegrationTestData(
        events = listOf(transactionActivatedEvent, transactionAuthRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.AUTHORIZATION_REQUESTED, ZonedDateTime.now()),
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
  fun `Should handle Redirect transaction in AUTHORIZATION_REQUESTED writing event to DLQ in case of response with KO outcome`() {
    // pre-conditions
    val testTransactionId =
      TransactionId(
        "00000000000000000000000000000001") // fixed transaction id, used in redirect mock
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent()
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionAuthorizationRequestData.PaymentGateway.REDIRECT,
        TransactionTestUtils.redirectTransactionGatewayAuthorizationRequestedData())
    transactionAuthRequestedEvent.data.pspId = "BCITITMM"
    transactionAuthRequestedEvent.data.paymentTypeCode = "RBPR"
    val transactionTestData =
      IntegrationTestData(
        events = listOf(transactionActivatedEvent, transactionAuthRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.AUTHORIZATION_REQUESTED, ZonedDateTime.now()),
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
          wantedStatus = TransactionStatusDto.REFUND_ERROR,
          transactionId = testTransactionId)
      }
      .flatMap {
        readEventFromQueue(
            queueAsyncClient = deadLetterQueueAsyncClient,
            typeReference =
              object : TypeReference<QueueEvent<TransactionRefundRequestedEvent>>() {},
            transactionId = testTransactionId)
          .doOnNext {
            assertEquals(
              TransactionEventCode.TRANSACTION_REFUND_REQUESTED_EVENT.toString(), it.eventCode)
          }
      }
      .block(Duration.ofMinutes(1))
  }

  @Test
  fun `Should handle Redirect transaction in AUTHORIZATION_REQUESTED writing event to DLQ in case of 4xx response`() {
    // pre-conditions
    val testTransactionId =
      TransactionId(
        "00000000000000000000000000000002") // fixed transaction id, used in redirect mock
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent()
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionAuthorizationRequestData.PaymentGateway.REDIRECT,
        TransactionTestUtils.redirectTransactionGatewayAuthorizationRequestedData())
    transactionAuthRequestedEvent.data.pspId = "BCITITMM"
    transactionAuthRequestedEvent.data.paymentTypeCode = "RBPR"
    val transactionTestData =
      IntegrationTestData(
        events = listOf(transactionActivatedEvent, transactionAuthRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.AUTHORIZATION_REQUESTED, ZonedDateTime.now()),
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
          wantedStatus = TransactionStatusDto.REFUND_ERROR,
          transactionId = testTransactionId)
      }
      .flatMap {
        readEventFromQueue(
            queueAsyncClient = deadLetterQueueAsyncClient,
            typeReference =
              object : TypeReference<QueueEvent<TransactionRefundRequestedEvent>>() {},
            transactionId = testTransactionId)
          .doOnNext {
            assertEquals(
              TransactionEventCode.TRANSACTION_REFUND_REQUESTED_EVENT.toString(), it.eventCode)
          }
      }
      .block(Duration.ofMinutes(1))
  }

  @Test
  fun `Should handle Redirect transaction in AUTHORIZATION_REQUESTED writing event to DLQ in case of 5xx response`() {
    // pre-conditions
    val testTransactionId =
      TransactionId(
        "00000000000000000000000000000003") // fixed transaction id, used in redirect mock
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent()
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionAuthorizationRequestData.PaymentGateway.REDIRECT,
        TransactionTestUtils.redirectTransactionGatewayAuthorizationRequestedData())
    transactionAuthRequestedEvent.data.pspId = "BCITITMM"
    transactionAuthRequestedEvent.data.paymentTypeCode = "RBPR"
    val transactionTestData =
      IntegrationTestData(
        events = listOf(transactionActivatedEvent, transactionAuthRequestedEvent),
        view =
          TransactionTestUtils.transactionDocument(
            TransactionStatusDto.AUTHORIZATION_REQUESTED, ZonedDateTime.now()),
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
          wantedStatus = TransactionStatusDto.REFUND_ERROR,
          transactionId = testTransactionId)
      }
      .flatMap {
        readEventFromQueue(
            queueAsyncClient = deadLetterQueueAsyncClient,
            typeReference = object : TypeReference<QueueEvent<TransactionRefundRetriedEvent>>() {},
            transactionId = testTransactionId)
          .doOnNext {
            assertEquals(
              TransactionEventCode.TRANSACTION_REFUND_RETRIED_EVENT.toString(), it.eventCode)
          }
      }
      .block(Duration.ofMinutes(1))
  }
}
