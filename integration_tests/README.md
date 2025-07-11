# pagopa-ecommerce-event-dispatcher-service Integration tests repo

## What is this?

This repo contains integration tests for `pagopa-ecommerce-event-dispatcher-service` component.
Those tests populate target DB for simulate transaction in a given state and send events to queue triggering an action.
Finally perform checks against DB/queues to check that transaction is updated correctly and/or event is written to DLQ

Integration tests are written as junit kotlin tests. This allow pagopa-ecommerce-commons library re-use with events code
modifications that will be
reflected in those test too instead of hardcode it someway.

Spring boot SDK is used to configure queues and CosmosDB re-using what have been done for event-dispatcher-service

### Environment variables

These are all environment variables needed by the application:

| Variable name                                         | Description                                                                                                                                                | type    | default |
|-------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|---------|---------|
| MONGO_HOST                                            | Host where MongoDB instance used to persise events and view resides                                                                                        | string  |         |
| MONGO_USERNAME                                        | Username used for connecting to MongoDB instance                                                                                                           | string  |         |
| MONGO_PASSWORD                                        | Password used for connecting to MongoDB instance                                                                                                           | string  |         |
| MONGO_PORT                                            | Port used for connecting to MongoDB instance                                                                                                               | number  |         |
| MONGO_SSL_ENABLED                                     | Boolean value indicating if use SSL for connecting to MongoDB instance                                                                                     | boolean |         |
| MONGO_PORT                                            | Port used for connecting to MongoDB instance                                                                                                               | string  |         |
| MONGO_MIN_POOL_SIZE                                   | Min amount of connections to be retained into connection pool. See docs *                                                                                  | string  |         |
| MONGO_MAX_POOL_SIZE                                   | Max amount of connections to be retained into connection pool.See docs *                                                                                   | string  |         |
| MONGO_MAX_IDLE_TIMEOUT_MS                             | Max timeout after which an idle connection is killed in milliseconds. See docs *                                                                           | string  |         |
| MONGO_CONNECTION_TIMEOUT_MS                           | Max time to wait for a connection to be opened. See docs *                                                                                                 | string  |         |
| MONGO_SOCKET_TIMEOUT_MS                               | Max time to wait for a command send or receive before timing out. See docs *                                                                               | string  |         |
| MONGO_SERVER_SELECTION_TIMEOUT_MS                     | Max time to wait for a server to be selected while performing a communication with Mongo in milliseconds. See docs *                                       | string  |         |
| MONGO_WAITING_QUEUE_MS                                | Max time a thread has to wait for a connection to be available in milliseconds. See docs *                                                                 | string  |         |
| MONGO_HEARTBEAT_FREQUENCY_MS                          | Hearth beat frequency in milliseconds. This is an hello command that is sent periodically on each active connection to perform an health check. See docs * | string  |         |
| QUEUE_TRANSIENT_CONNECTION_STRING                     | eCommerce storage transient connection string                                                                                                              | string  |         |
| QUEUE_DEADLETTER_CONNECTION_STRING                    | eCommerce storage deadletter connection string                                                                                                             | string  |         |˙
| TRANSACTIONS_CLOSE_PAYMENT_RETRY_QUEUE_NAME           | Queue name for closure events scheduled for retries                                                                                                        | string  |         |
| TRANSACTIONS_CLOSE_PAYMENT_QUEUE_NAME                 | Queue name for closure events scheduled                                                                                                                    | string  |         |
| TRANSACTIONS_NOTIFICATIONS_RETRY_QUEUE_NAME           | Queue name for notification events scheduled for retries                                                                                                   | string  |         |
| TRANSACTIONS_NOTIFICATIONS_QUEUE_NAME                 | Queue name for notifications events scheduler                                                                                                              | string  |         |
| TRANSACTIONS_EXPIRATION_QUEUE_NAME                    | Queue name for all events scheduled for expiration                                                                                                         | string  |         |
| TRANSACTIONS_REFUND_QUEUE_NAME                        | Queue name for refund scheduled                                                                                                                            | string  |         |
| TRANSACTIONS_REFUND_RETRY_QUEUE_NAME                  | Queue name for refund scheduler for retries                                                                                                                | string  |         |
| TRANSACTIONS_DEAD_LETTER_QUEUE_NAME                   | Queue name were event that cannot be processed successfully are forwarded                                                                                  | string  |         |
| TRANSACTIONS_AUTHORIZATION_REQUESTED_QUEUE_NAME       | Queue name for payment gateway authorization requested transactions                                                                                        | string  |         |
| TRANSACTIONS_AUTHORIZATION_OUTCOME_WAITING_QUEUE_NAME | Queue name for payment gateway authorization requested retry transactions                                                                                  | string  |         |

An example configuration of these environment variables is in the `.env.local` file.

(*): for Mongo connection string options
see [docs](https://www.mongodb.com/docs/drivers/java/sync/v4.3/fundamentals/connection/connection-options/#connection-options)

## Run the application

Set environment variables locally on the terminal with:

```sh
export $(grep -v '^#' .env.example | xargs)
```

Then from current project directory run :

```sh
#install commons library locally in local M2 cache
./mvnw validate -PinstallCommons
#then execute tests
./mvnw test
```

## Code formatting

Code formatting checks are automatically performed during build phase.
If the code is not well formatted an error is raised blocking the maven build.

Helpful commands:

```sh
mvn spotless:check # --> used to perform format checks
mvn spotless:apply # --> used to format all misformatted files
```
