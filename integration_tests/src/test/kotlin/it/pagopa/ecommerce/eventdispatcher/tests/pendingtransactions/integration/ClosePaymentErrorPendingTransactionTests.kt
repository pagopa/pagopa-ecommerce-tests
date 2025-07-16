package it.pagopa.ecommerce.eventdispatcher.tests.pendingtransactions.integration

import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.commons.documents.v2.ClosureErrorData
import it.pagopa.ecommerce.commons.documents.v2.activation.NpgTransactionGatewayActivationData
import it.pagopa.ecommerce.commons.domain.Confidential
import it.pagopa.ecommerce.commons.domain.v2.TransactionEventCode
import it.pagopa.ecommerce.commons.generated.npg.v1.dto.OperationResultDto
import it.pagopa.ecommerce.commons.generated.server.model.TransactionStatusDto
import it.pagopa.ecommerce.commons.v2.TransactionTestUtils
import it.pagopa.ecommerce.eventdispatcher.tests.configs.testdata.TransactionConf
import it.pagopa.ecommerce.eventdispatcher.tests.configs.testdata.gateway.NpgPaymentConf
import it.pagopa.ecommerce.eventdispatcher.tests.repository.DeadLetterQueueRepository
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
import org.springframework.http.HttpStatus

@SpringBootTest
class ClosePaymentErrorPendingTransactionTests(
  @param:Autowired val eventStoreRepository: TransactionsEventStoreRepository,
  @param:Autowired val viewRepository: TransactionsViewRepository,
  @param:Autowired val closePaymentQueueAsyncClient: QueueAsyncClient,
  @param:Autowired val deadLetterQueueRepository: DeadLetterQueueRepository,
  @param:Autowired val npgPaymentConf: NpgPaymentConf,
  @param:Autowired val transactionConf: TransactionConf
) {

  @Test
  fun `Should perform refund for specific Nodo close payment 404 error response`() {
    // pre-conditions
    val testTransactionId = getProgressiveTransactionId()
    val npgActivationData = TransactionTestUtils.npgTransactionGatewayActivationData()
    (npgActivationData as NpgTransactionGatewayActivationData).correlationId =
      UUID.randomUUID().toString()
    val transactionActivatedEvent = TransactionTestUtils.transactionActivateEvent(npgActivationData)
    transactionActivatedEvent.data.email =
      Confidential(transactionConf.userMailPdvToken) // use pdv token taken from env variables
    transactionActivatedEvent.data.userId =
      null // simulate a guest transaction where user id is null
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
          wantedStatus =
            TransactionStatusDto
              .REFUND_ERROR, // transaction is mocked, so refund operation will go in error state
          // gateway side
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
            assertEquals(HttpStatus.NOT_FOUND, closureErrorData.httpErrorCode)
            assertEquals(
              ClosureErrorData.ErrorType.KO_RESPONSE_RECEIVED, closureErrorData.errorType)
            assertEquals(
              "The indicated brokerPSP does not exist",
              closureErrorData.errorDescription) // error code returned by Nodo
          }
      }
      .block(Duration.ofMinutes(1))
  }
}
