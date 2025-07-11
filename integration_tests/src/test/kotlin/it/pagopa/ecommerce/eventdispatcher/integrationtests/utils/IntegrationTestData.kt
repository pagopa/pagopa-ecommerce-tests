package it.pagopa.ecommerce.eventdispatcher.integrationtests.utils

import it.pagopa.ecommerce.commons.documents.v2.Transaction
import it.pagopa.ecommerce.commons.documents.v2.TransactionEvent
import it.pagopa.ecommerce.commons.domain.v2.TransactionId
import java.time.Duration
import java.time.ZonedDateTime

data class IntegrationTestData(
  val events: List<TransactionEvent<Any>>,
  val view: Transaction,
  val testTransactionId: TransactionId
) {

  init {
    // ensure all events have the input test transaction id and that are creation date ordered
    // (simulate event temporal sequence)
    val now = ZonedDateTime.now()
    events.forEachIndexed { idx, event ->
      event.transactionId = testTransactionId.value()
      event.creationDate = now.plus(Duration.ofSeconds(idx.toLong())).toString()
    }
    view.transactionId = testTransactionId.value()
    view.creationDate = now.toString()
  }
}
