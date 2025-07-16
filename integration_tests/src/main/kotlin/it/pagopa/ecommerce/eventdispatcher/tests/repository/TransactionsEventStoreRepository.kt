package it.pagopa.ecommerce.eventdispatcher.tests.repository

import it.pagopa.ecommerce.commons.documents.v2.TransactionEvent
import org.springframework.data.repository.reactive.ReactiveCrudRepository
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono

interface TransactionsEventStoreRepository :
  ReactiveCrudRepository<TransactionEvent<out Any>, String> {
  fun findByTransactionIdOrderByCreationDateAsc(transactionId: String): Flux<TransactionEvent<Any>>

  fun deleteByTransactionId(transactionId: String): Mono<Long>

  fun findByTransactionIdAndEventCode(
    transactionId: String,
    eventCode: String
  ): Flux<TransactionEvent<Any>>
}
