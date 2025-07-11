package it.pagopa.ecommerce.eventdispatcher.integrationtests.repository

import it.pagopa.ecommerce.commons.documents.v2.TransactionEvent
import org.springframework.data.repository.reactive.ReactiveCrudRepository
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono

interface TransactionsEventStoreRepository : ReactiveCrudRepository<TransactionEvent<Any>, String> {
  fun findByTransactionIdOrderByCreationDateAsc(idTransaction: String): Flux<TransactionEvent<Any>>

  fun deleteByTransactionId(transactionId: String): Mono<Long>
}
