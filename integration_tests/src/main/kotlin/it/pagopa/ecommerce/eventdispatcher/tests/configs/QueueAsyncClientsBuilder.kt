package it.pagopa.ecommerce.eventdispatcher.tests.configs

import com.azure.core.http.netty.NettyAsyncHttpClientBuilder
import com.azure.storage.queue.QueueAsyncClient
import com.azure.storage.queue.QueueClientBuilder
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import reactor.netty.http.client.HttpClient

@Configuration
class QueueAsyncClientsBuilder {

  @Bean
  fun refundQueueAsyncClient(
    @Value("\${azurestorage.transient.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.transactionsrefund.name}") queueEventInitName: String,
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  @Bean
  fun refundRetryQueueAsyncClient(
    @Value("\${azurestorage.transient.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.transactionrefundretry.name}") queueEventInitName: String,
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  @Bean
  fun closureRetryQueueAsyncClient(
    @Value("\${azurestorage.transient.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.transactionclosepaymentretry.name}") queueEventInitName: String
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  @Bean
  fun closePaymentQueueAsyncClient(
    @Value("\${azurestorage.transient.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.transactionclosepayment.name}") queueEventInitName: String
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  @Bean
  fun notificationRetryQueueAsyncClient(
    @Value("\${azurestorage.transient.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.transactionnotificationretry.name}") queueEventInitName: String,
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  @Bean
  fun deadLetterQueueAsyncClient(
    @Value("\${azurestorage.deadletter.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.deadletter.name}") queueEventInitName: String,
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  @Bean
  fun expirationQueueAsyncClient(
    @Value("\${azurestorage.transient.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.transactionexpiration.name}") queueEventInitName: String,
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  @Bean
  fun authRequestedQueueAsyncClient(
    @Value("\${azurestorage.transient.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.transactionauthorizationrequested.name}")
    queueEventInitName: String,
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  @Bean
  fun authRequestedOutcomeWaitingQueueAsyncClient(
    @Value("\${azurestorage.transient.connectionstring}") storageConnectionString: String,
    @Value("\${azurestorage.queues.transactionauthorizationoutcomewaiting.name}")
    queueEventInitName: String,
  ): QueueAsyncClient {
    return buildQueueAsyncClient(storageConnectionString, queueEventInitName)
  }

  private fun buildQueueAsyncClient(
    storageConnectionString: String,
    queueName: String
  ): QueueAsyncClient {
    val queueClient =
      QueueClientBuilder()
        .connectionString(storageConnectionString)
        .queueName(queueName)
        .httpClient(
          NettyAsyncHttpClientBuilder(HttpClient.create().resolver { it.ndots(1) }).build())
        .buildAsyncClient()
    queueClient.clearMessages().block() // clear queue
    return queueClient
  }
}
