package it.pagopa.ecommerce.eventdispatcher.integrationtests.repository

import it.pagopa.ecommerce.commons.documents.v2.Transaction
import org.springframework.data.repository.reactive.ReactiveCrudRepository
import reactor.core.publisher.Mono

interface TransactionsViewRepository : ReactiveCrudRepository<Transaction, String> {
  fun findByTransactionId(transactionId: String?): Mono<Transaction>
}
