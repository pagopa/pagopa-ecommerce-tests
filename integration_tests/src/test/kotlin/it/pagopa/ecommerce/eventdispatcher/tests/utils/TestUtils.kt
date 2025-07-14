package it.pagopa.ecommerce.eventdispatcher.tests.utils

import com.azure.core.util.BinaryData
import com.azure.core.util.serializer.TypeReference
import com.azure.storage.queue.QueueAsyncClient
import it.pagopa.ecommerce.commons.documents.BaseTransactionEvent
import it.pagopa.ecommerce.commons.documents.v2.TransactionEvent
import it.pagopa.ecommerce.commons.domain.v2.TransactionEventCode
import it.pagopa.ecommerce.commons.domain.v2.TransactionId
import it.pagopa.ecommerce.commons.generated.server.model.TransactionStatusDto
import it.pagopa.ecommerce.commons.queues.QueueEvent
import it.pagopa.ecommerce.commons.queues.StrictJsonSerializerProvider
import it.pagopa.ecommerce.commons.queues.TracingInfoTest
import it.pagopa.ecommerce.commons.queues.mixin.serialization.v2.QueueEventMixInClassFieldDiscriminator
import it.pagopa.ecommerce.eventdispatcher.tests.exceptions.NoDlqEventFoundException
import it.pagopa.ecommerce.eventdispatcher.tests.repository.TransactionsEventStoreRepository
import it.pagopa.ecommerce.eventdispatcher.tests.repository.TransactionsViewRepository
import java.time.Duration
import java.util.concurrent.atomic.AtomicInteger
import java.util.stream.IntStream
import kotlin.streams.toList
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono

val logger: Logger = LoggerFactory.getLogger("TestUtils")

fun populateDbWithTestData(
  eventStoreRepository: TransactionsEventStoreRepository,
  viewRepository: TransactionsViewRepository,
  integrationTestData: IntegrationTestData
): Mono<Unit> {
  val transactionId = integrationTestData.testTransactionId.value()
  logger.info("Deleting events and view for test transaction with id: [{}]", transactionId)
  return eventStoreRepository
    .deleteByTransactionId(transactionId)
    .flatMap {
      logger.info("Deleted: [{}] events with transactionId: [{}]", it, transactionId)
      viewRepository.deleteById(transactionId).then(Mono.just(1))
    }
    .flatMap {
      logger.info("View with _id: [{}] deleted successfully", transactionId)
      viewRepository.save(integrationTestData.view)
    }
    .flatMapMany {
      logger.info("View saved successfully")
      eventStoreRepository.saveAll(integrationTestData.events)
    }
    .then(Mono.just(Unit))
}

val serializerProvider: StrictJsonSerializerProvider =
  StrictJsonSerializerProvider()
    .addMixIn(QueueEvent::class.java, QueueEventMixInClassFieldDiscriminator::class.java)

val eventToSendOnExpirationQueue =
  setOf(
    TransactionEventCode.TRANSACTION_ACTIVATED_EVENT.toString(),
    TransactionEventCode.TRANSACTION_EXPIRED_EVENT.toString())

fun sendExpirationEventToQueue(
  testData: IntegrationTestData,
  queueAsyncClient: QueueAsyncClient,
  visibilityTimeout: Duration = Duration.ofSeconds(0), // immediately visible on the queue
  timeToLive: Duration = Duration.ofSeconds(-1) // never expires
): Mono<Unit> {
  val eventToSend = testData.events.findLast { eventToSendOnExpirationQueue.contains(it.eventCode) }
  if (eventToSend == null) {
    throw RuntimeException(
      "Cannot find any event with code: $eventToSendOnExpirationQueue to send on expiration queue")
  }
  return sendEventToQueue(
    event = eventToSend,
    queueAsyncClient = queueAsyncClient,
    visibilityTimeout = visibilityTimeout,
    timeToLive = timeToLive)
}

fun sendEventToQueue(
  event: TransactionEvent<out Any>,
  queueAsyncClient: QueueAsyncClient,
  visibilityTimeout: Duration = Duration.ofSeconds(0), // immediately visible on the queue
  timeToLive: Duration = Duration.ofSeconds(-1) // never expires
): Mono<Unit> {
  val binaryData =
    BinaryData.fromObject(
      QueueEvent(event, TracingInfoTest.MOCK_TRACING_INFO), serializerProvider.createInstance())
  return queueAsyncClient
    .sendMessageWithResponse(binaryData, visibilityTimeout, timeToLive)
    .then(Mono.just(Unit))
}

fun <T : BaseTransactionEvent<*>> readEventFromQueue(
  queueAsyncClient: QueueAsyncClient,
  typeReference: TypeReference<QueueEvent<T>>,
  transactionId: TransactionId
): Mono<T> =
  queueAsyncClient
    .receiveMessages(1, Duration.ofSeconds(1))
    .filter { it.body.toString().contains(transactionId.value()) }
    .flatMap { queueAsyncClient.deleteMessage(it.messageId, it.popReceipt).thenReturn(it.body) }
    .flatMap { it.toObjectAsync(typeReference, serializerProvider.createInstance()) }
    .collectList()
    .filter { it.isNotEmpty() }
    .map { it[0].event }
    .repeatWhenEmpty {
      Flux.fromIterable(IntStream.range(0, 20).toList()).delayElements(Duration.ofSeconds(1))
    }
    .switchIfEmpty(
      Mono.error(
        NoDlqEventFoundException(
          "Cannot found DLQ event for transaction with id: [${transactionId.value()}]")))

fun pollTransactionForWantedStatus(
  viewRepository: TransactionsViewRepository,
  wantedStatus: TransactionStatusDto,
  transactionId: TransactionId,
  maxAttempts: Int = 20,
  queryRate: Duration = Duration.ofSeconds(1)
) =
  viewRepository
    .findByTransactionId(transactionId.value())
    .filter {
      logger.info(
        "Polling transaction with id: [{}], wanted status: [{}], actual status: [{}]",
        transactionId.value(),
        wantedStatus,
        it.status)
      it.status == wantedStatus
    }
    .repeatWhenEmpty {
      Flux.fromIterable(IntStream.range(0, maxAttempts).toList()).delayElements(queryRate)
    }
    .switchIfEmpty(
      Mono.error {
        RuntimeException(
          "Transaction with id: [${transactionId.value()}] do not reach wanted status: [$wantedStatus] after all retries")
      })

val trxIdCounter = AtomicInteger(0)

fun getProgressiveTransactionId(): TransactionId {
  val prefix = trxIdCounter.addAndGet(1).toString()
  val reminder = 32 - prefix.length
  return TransactionId(prefix + "0".repeat(reminder))
}
