# QuickNotes Architecture

## Requirements

### Functional

- Users can authenticate and create, read, update, and delete their own notes.
- Users can list notes newest first with pagination and attach tags.
- Every note and tag is scoped to its owner; users cannot read or modify another user's data.
- The API validates input and returns consistent success and error responses.

### Non-functional

- Scale to 1 million registered users with horizontal application capacity.
- Keep common note-list reads responsive and isolate one user's data from another's.
- Preserve committed notes through process, host, and availability-zone failures.
- Protect traffic and stored data, monitor request latency/errors, and recover from failed background jobs.

## Load estimate

Assumptions for a planning baseline:

- 1,000,000 registered users; 10% (100,000) are active each day.
- Each daily active user reads 50 note-list pages and creates 1 note per day; update/delete traffic is excluded.
- One stored note averages 1 KB including its title, body, and basic row metadata; indexes, replicas, logs, and backups are excluded from the raw storage estimate.
- One day has 86,400 seconds and one year has 365 days.

```text
Daily active users = 1,000,000 x 10% = 100,000
Reads/day          = 100,000 x 50 = 5,000,000
Average reads/sec  = 5,000,000 / 86,400 = 57.87 (about 58)
Writes/day         = 100,000 x 1 = 100,000 note creations
Average writes/sec = 100,000 / 86,400 = 1.16
Storage/year       = 100,000 x 1 KB x 365 = 36,500,000 KB = 36.5 GB
```

This is an average-rate baseline, not a peak capacity target; real storage needs are higher after indexes, replication, backups, revisions, and uneven request bursts. The workload is read-heavy at about 50 list reads per new note, so feed/list traffic should be cacheable and scalable independently from writes.

## Architecture diagram

```text
                                  +----------------------+
                                  |   DNS (health-aware)  |
                                  +----------+-----------+
                                             |
                                             v
+--------------+    static assets    +------+-------+    API traffic    +----------------+
| Web / Mobile | ------------------> | CDN / Edge   | ----------------> | Load Balancer  |
| Clients      | <------------------ | cache        | <---------------- | multi-zone     |
+------+-------+   cached responses  +--------------+                   +-------+--------+
       |                                                                        |
       | GET /notes, POST /notes, PATCH, DELETE                                  v
       |                                                               +--------+--------+
       |                                                               |                 |
       |                                                         +-----v-----+     +-----v-----+
       |                                                         | App Srv A |     | App Srv B |
       |                                                         | stateless |     | stateless |
       |                                                         +--+-----+--+     +--+-----+--+
       |                                                            |     |           |     |
       |                                      cache hit/miss         |     |           |     |
       |                                    +------------------------+     +-----------+     |
       |                                    v                                              v
       |                              +-----+------+                              +------+------+
       |                              | Cache      |                              | Queue       |
       |                              | cluster    |                              | replicated  |
       |                              +-----+------+                              +------+------+
       |                                    |                                              |
       |                                    | cache miss                                   v
       |                                    v                                      +-------+------+
       |                              +-----+--------+   replication   +----------+ Worker pool  |
       |                              | Primary DB   | --------------> | Read Replica(s)      |
       |                              | multi-AZ HA  |                 +-----------------------+
       |                              +--------------+
       |                                    |
       |                                    +--> transactional outbox / background job enqueue
       +<------------------------- JSON response
```

## Component responsibilities

- **Client:** Provides the user interface and sends authenticated API requests without owning authoritative note state.
- **DNS:** Resolves the service name and routes clients to healthy regional entry points.
- **CDN:** Caches static application assets and cacheable public responses near users to reduce latency and origin traffic.
- **Load balancer:** Distributes API requests across healthy app servers and removes unhealthy instances from rotation.
- **App servers:** Validate and authorize requests, implement API behavior, and remain stateless so more instances can be added horizontally.
- **Cache:** Serves hot, user-scoped note-list results quickly and reduces repeated database reads.
- **Primary database:** Stores authoritative users, notes, tags, and relationships and commits writes transactionally.
- **Read replica:** Serves eligible list/read queries so read traffic does not compete with primary writes.
- **Queue:** Durably buffers asynchronous work so request handling is not blocked by background processing.
- **Worker:** Processes queued jobs such as search indexing, notification delivery, and retryable maintenance tasks independently of API traffic.

## GET /notes flow

1. The client resolves the API hostname through DNS and sends `GET /v1/notes?limit=20` with its access token.
2. The CDN serves cacheable static assets; the API request proceeds to the load balancer, which selects a healthy app server.
3. The app server authenticates the token and scopes the query to the user's ID from that token.
4. The app checks a cache key that includes the user and query parameters; on a miss, it reads the user's page from a read replica.
5. The app caches the result for a short TTL and returns JSON with notes and a pagination cursor; a read-after-write request can be routed to the primary to avoid replica lag.

## POST /notes flow

1. The client sends `POST /v1/notes` with a bearer token and JSON title/body through DNS, CDN edge, load balancer, and a healthy app server.
2. The app authenticates the user, validates the title and payload, and derives the owner ID from the token rather than trusting a client-supplied owner.
3. In one primary-database transaction, the app inserts the note and an outbox job for asynchronous work; it commits before acknowledging success.
4. The app invalidates or versions the relevant user-scoped list cache and returns `201 Created` with the saved note.
5. An outbox publisher places the job on the replicated queue; a worker processes it idempotently, retries transient failures, and records completion without delaying the POST response.

## Trade-offs and failure handling

- **Read replicas vs. immediate consistency:** Replicas increase read capacity but can lag behind the primary; route read-after-write requests to the primary or include a consistency token, while ordinary list reads use replicas.
- **Caching vs. freshness and privacy:** Cache hits reduce latency and database load, but cached lists can be stale; use short TTLs, versioned invalidation, and user-specific cache keys to prevent cross-user leakage.
- **Asynchronous work vs. completion latency:** Queues keep API requests fast and absorb bursts, but jobs complete later; expose processing state where needed and use idempotent consumers, bounded retries, and a dead-letter queue.

No single component is intended to be a single point of failure: DNS and the load balancer span redundant endpoints/zones, app servers and workers run as replicated pools, the CDN has multiple edge locations, cache and queue use clustered/replicated nodes, and the database has automated primary failover to a replica plus tested backups. Health checks remove failed instances, and monitoring/alerts cover queue age, error rates, replication lag, and capacity.
