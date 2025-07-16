package it.pagopa.ecommerce.eventdispatcher.tests.pendingtransactions.codereview

import com.azure.core.util.serializer.TypeReference
import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.commons.documents.v2.ClosureErrorData
import it.pagopa.ecommerce.commons.documents.v2.TransactionEvent
import it.pagopa.ecommerce.commons.documents.v2.activation.NpgTransactionGatewayActivationData
import it.pagopa.ecommerce.commons.domain.v2.TransactionEventCode
import it.pagopa.ecommerce.commons.generated.npg.v1.dto.OperationResultDto
import it.pagopa.ecommerce.commons.generated.server.model.TransactionStatusDto
import it.pagopa.ecommerce.commons.queues.QueueEvent
import it.pagopa.ecommerce.commons.v2.TransactionTestUtils
import it.pagopa.ecommerce.eventdispatcher.tests.configs.testdata.gateway.NpgPaymentConf
import it.pagopa.ecommerce.eventdispatcher.tests.repository.DeadLetterQueueRepository
import it.pagopa.ecommerce.eventdispatcher.tests.repository.TransactionsEventStoreRepository
import it.pagopa.ecommerce.eventdispatcher.tests.repository.TransactionsViewRepository
import it.pagopa.ecommerce.eventdispatcher.tests.utils.*
import java.time.Duration
import java.time.ZonedDateTime
import java.util.*
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpStatus

@SpringBootTest
class ClosePaymentErrorPendingTransactionTests(
  @param:Autowired val eventStoreRepository: TransactionsEventStoreRepository,
  @param:Autowired val viewRepository: TransactionsViewRepository,
  @param:Autowired val closePaymentQueueAsyncClient: QueueAsyncClient,
  @param:Autowired val deadLetterQueueRepository: DeadLetterQueueRepository,
  @param:Autowired val npgPaymentConf: NpgPaymentConf
) {

  companion object {
    @JvmStatic
    fun `Node close payment error responses that should trigger automatic refund test data`():
      Stream<Arguments> =
      Stream.of(
        // mock payment token, expected nodo error code, expected nodo error description
        Arguments.of("00000000000000000000000000000001", 400, "Generic error description"),
        Arguments.of("00000000000000000000000000000002", 404, "Generic error description"),
        Arguments.of("00000000000000000000000000000004", 422, "Node did not receive RPT yet"))

    @JvmStatic
    fun `Node close payment error responses that should trigger DLQ event writing`():
      Stream<Arguments> =
      Stream.of(
        // mock payment token, expected nodo error code, expected nodo error description
        Arguments.of("00000000000000000000000000000005", 500, "Generic error description"))
  }

  @ParameterizedTest
  @MethodSource("Node close payment error responses that should trigger automatic refund test data")
  fun `Should perform refund for specific Nodo close payment error response codes and descriptions`(
    nodoMockPaymentToken: String,
    expectedNodoErrorCode: Int,
    expectedNodoErrorDescription: String
  ) {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val npgActivationData = TransactionTestUtils.npgTransactionGatewayActivationData()
    (npgActivationData as NpgTransactionGatewayActivationData).correlationId =
      UUID.randomUUID().toString()
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    transactionActivatedEvent.data.paymentNotices[0].paymentToken = nodoMockPaymentToken
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    val transactionAuthCompletedEvent =
      TransactionTestUtils.transactionAuthorizationCompletedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationData(OperationResultDto.EXECUTED))
    transactionAuthRequestedEvent.data.pspId = npgPaymentConf.pspId
    transactionAuthRequestedEvent.data.paymentTypeCode = npgPaymentConf.paymentTypeCode
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
        integrationTestData = transactionTestData,
        deadLetterQueueRepository = deadLetterQueueRepository)
      .then(
        sendEventToQueue(
          event = transactionClosureRequestedEvent,
          queueAsyncClient = closePaymentQueueAsyncClient))
      .flatMap {
        pollTransactionForWantedStatus(
          viewRepository = viewRepository,
          wantedStatus = TransactionStatusDto.REFUNDED,
          transactionId = testTransactionId)
      }
      .flatMap {
        eventStoreRepository
          .findByTransactionIdAndEventCode(
            testTransactionId.value(),
            TransactionEventCode.TRANSACTION_CLOSURE_ERROR_EVENT.toString())
          .single()
          .doOnNext {
            val closureErrorData = it.data as ClosureErrorData
            assertEquals(HttpStatus.valueOf(expectedNodoErrorCode), closureErrorData.httpErrorCode)
            assertEquals(
              ClosureErrorData.ErrorType.KO_RESPONSE_RECEIVED, closureErrorData.errorType)
            assertEquals(expectedNodoErrorDescription, closureErrorData.errorDescription)
          }
      }
      .block(Duration.ofMinutes(1))
  }

  @ParameterizedTest
  @MethodSource("Node close payment error responses that should trigger DLQ event writing")
  fun `Should not perform refund for specific Nodo close payment error response codes and description writing events to DLQ`(
    nodoMockPaymentToken: String,
    expectedNodoErrorCode: Int,
    expectedNodoErrorDescription: String
  ) {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val npgActivationData = TransactionTestUtils.npgTransactionGatewayActivationData()
    (npgActivationData as NpgTransactionGatewayActivationData).correlationId =
      UUID.randomUUID().toString()
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    transactionActivatedEvent.data.paymentNotices[0].paymentToken = nodoMockPaymentToken
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    val transactionAuthCompletedEvent =
      TransactionTestUtils.transactionAuthorizationCompletedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationData(OperationResultDto.EXECUTED))
    transactionAuthRequestedEvent.data.pspId = npgPaymentConf.pspId
    transactionAuthRequestedEvent.data.paymentTypeCode = npgPaymentConf.paymentTypeCode
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
        integrationTestData = transactionTestData,
        deadLetterQueueRepository = deadLetterQueueRepository)
      .then(
        sendEventToQueue(
          event = transactionClosureRequestedEvent,
          queueAsyncClient = closePaymentQueueAsyncClient))
      .flatMap {
        pollTransactionForWantedStatus(
          viewRepository = viewRepository,
          wantedStatus = TransactionStatusDto.CLOSURE_ERROR,
          transactionId = testTransactionId)
      }
      .flatMap {
        pollFromDeadLetterQueueCollection(
            deadLetterQueueRepository = deadLetterQueueRepository,
            typeReference = object : TypeReference<QueueEvent<TransactionEvent<Any>>>() {},
            transactionId = testTransactionId)
          .doOnNext {
            assertEquals(
              TransactionEventCode.TRANSACTION_CLOSURE_REQUESTED_EVENT.toString(), it.eventCode)
          }
      }
      .flatMap { it ->
        eventStoreRepository
          .findByTransactionIdAndEventCode(
            testTransactionId.value(),
            TransactionEventCode.TRANSACTION_CLOSURE_ERROR_EVENT.toString())
          .single()
          .doOnNext {
            val closureErrorData = it.data as ClosureErrorData
            assertEquals(HttpStatus.valueOf(expectedNodoErrorCode), closureErrorData.httpErrorCode)
            assertEquals(
              ClosureErrorData.ErrorType.KO_RESPONSE_RECEIVED, closureErrorData.errorType)
            assertEquals(expectedNodoErrorDescription, closureErrorData.errorDescription)
          }
      }
      .block(Duration.ofMinutes(1))
  }

  @Test
  fun `Should not perform refund for timeout receiving Nodo close payment response`() {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val npgActivationData = TransactionTestUtils.npgTransactionGatewayActivationData()
    (npgActivationData as NpgTransactionGatewayActivationData).correlationId =
      UUID.randomUUID().toString()
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    transactionActivatedEvent.data.paymentNotices[0].paymentToken =
      "00000000000000000000000000000006" // close payment timeout (20 sec delayed response)
    val transactionAuthRequestedEvent =
      TransactionTestUtils.transactionAuthorizationRequestedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationRequestedData())
    val transactionAuthCompletedEvent =
      TransactionTestUtils.transactionAuthorizationCompletedEvent(
        TransactionTestUtils.npgTransactionGatewayAuthorizationData(OperationResultDto.EXECUTED))
    transactionAuthRequestedEvent.data.pspId = npgPaymentConf.pspId
    transactionAuthRequestedEvent.data.paymentTypeCode = npgPaymentConf.paymentTypeCode
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
        integrationTestData = transactionTestData,
        deadLetterQueueRepository = deadLetterQueueRepository)
      .then(
        sendEventToQueue(
          event = transactionClosureRequestedEvent,
          queueAsyncClient = closePaymentQueueAsyncClient))
      .flatMap {
        pollTransactionForWantedStatus(
          viewRepository = viewRepository,
          wantedStatus = TransactionStatusDto.CLOSURE_ERROR,
          transactionId = testTransactionId)
      }
      .flatMap {
        pollFromDeadLetterQueueCollection(
            deadLetterQueueRepository = deadLetterQueueRepository,
            typeReference = object : TypeReference<QueueEvent<TransactionEvent<Any>>>() {},
            transactionId = testTransactionId)
          .doOnNext {
            assertEquals(
              TransactionEventCode.TRANSACTION_CLOSURE_REQUESTED_EVENT.toString(), it.eventCode)
          }
      }
      .flatMap {
        eventStoreRepository
          .findByTransactionIdAndEventCode(
            testTransactionId.value(),
            TransactionEventCode.TRANSACTION_CLOSURE_ERROR_EVENT.toString())
          .single()
          .doOnNext {
            val closureErrorData = it.data as ClosureErrorData
            assertEquals(ClosureErrorData.ErrorType.COMMUNICATION_ERROR, closureErrorData.errorType)
          }
      }
      .block(Duration.ofMinutes(1))
  }
}
