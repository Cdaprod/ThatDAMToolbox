# Control Plane Bootstrapping and Environment Reconcile

Goal: Any node can boot the same stack. Discovery and Supervisor determine roles and apply the desired environment without hard dependencies on external services. Everything is idempotent.

## 1. Boot Order and Roles

1) Discovery starts first on every node.
2) Discovery locates or self elects control plane.
   - Try mdns leader
   - Try cloud control url if set
   - Else self elect leader
3) Discovery registers with Supervisor and requests a plan.
4) Supervisor replies with role and service set.
   - leader or worker or proxy
   - control plane url and gateway url
   - ttl seconds and epoch
5) Discovery writes cluster json and starts or stops local services to match plan.
6) Discovery heartbeats at ttl thirds and re polls plan when notified.

## 2. Desired State Model

Supervisor publishes two read only documents:

- Cluster Plan: what services should run where and versions to target.
- Environment Profile: storage buckets, broker exchanges queues bindings, vector schema.

Agents and Discovery only apply what is relevant for their node.

## 3. Idempotent Reconcilers

Run in this order and safe to repeat:

A) Storage reconcile
- Ensure bucket exists
- Ensure versioning flag
- Merge add lifecycle rules by id
- Merge update managed tags
- Never delete by default

B) Broker reconcile
- Declare exchange durable
- Declare queue durable
- Bind queue to exchange with key
- Enable confirms for publish
- Never delete by default

C) Vector index reconcile
- Ensure class
- Add missing properties
- Log and skip incompatible type changes
- Never drop objects by default

Each reconciler reads desired, reads actual, computes diff, applies only additions or safe updates, emits overlay bootstrap events with generation hash.

## 4. Adapters and Defaults

Use ports and adapters pattern.

- ObjectStorage port: default file system adapter; optional MinIO adapter
- EventBus port: default in process pub sub; optional RabbitMQ adapter
- VectorIndex port: default in memory index; optional Weaviate adapter

Adapter selection is runtime based on env:

- MINIO endpoint present then use minio else fs
- AMQP url present then use rabbitmq else in proc
- WEAVIATE url present then use weaviate else in mem

All services can run with only defaults on a single node. When externals appear, reconcilers fall forward and sync.

## 5. Air Gapped and Offline

- Supervisor and or local object store serve all artifacts and profiles on the lan.
- Nodes cache last good desired and continue running when offline.
- On reconnect they reconcile to latest desired.

## 6. Safety and Observability

- Non destructive by default. Destructive operations require explicit intent and dry run diff.
- Idempotency key is sha256 of node id plus component plus generation plus desired hash.
- Logs include component action attempt idempotent generation duration ms.
- Health endpoint exposes last apply status per component.

## 7. Failure and Recovery

- 401 or 403 plan or heartbeat then re register
- 404 plan then re register and retry
- No supervisor found then self elect leader and advertise mdns
- Re locate control plane periodically
- If leader stale beyond ttl then next claimant wins via cas

