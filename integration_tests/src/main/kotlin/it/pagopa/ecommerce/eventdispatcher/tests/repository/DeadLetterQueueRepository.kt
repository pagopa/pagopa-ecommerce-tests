package it.pagopa.ecommerce.eventdispatcher.tests.repository

import it.pagopa.ecommerce.commons.documents.DeadLetterEvent
import org.springframework.data.mongodb.repository.Query
import org.springframework.data.repository.reactive.ReactiveCrudRepository
import reactor.core.publisher.Flux

interface DeadLetterQueueRepository : ReactiveCrudRepository<DeadLetterEvent, String> {

  @Query("{'data': {'\$regex': '?0'}}")
  fun findByDataContainsTransactionId(transactionId: String): Flux<DeadLetterEvent>
}
