Seed entries to guide future changes:
•v1.1 candidate: add storage.object_lock (bool), queue.max_delivery_attempts.
•v2 (breaking): split servers into pools[] with independent EC sets; introduce latency_class in ClusterState to bias pool sizing.
