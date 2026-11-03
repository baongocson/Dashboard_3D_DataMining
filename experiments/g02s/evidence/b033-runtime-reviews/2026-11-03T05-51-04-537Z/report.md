# B033 registered-Sync changefeed — registeredSyncChangefeedVerified

57/57 actual Mongo/private-byte groups (49 previous +8 changefeed groups);38/38 B033 contracts;33/33 affected shared regressions; strict API/web TS exit0/0. Primary/generated232schemas and catalog match. Current targeted B0312/2 regression verifies default hash/head/DAG behavior with the changed metadata marker; source unchanged=true.

Actual manifest anchors bind sequence plus private metadataRevision. Opaque owner/project/generation-bound feed cursors freeze ranges and page contiguously; later writes wait for explicit resume. MetadataRevision increments once per fresh actual transaction and replay changes neither marker nor journal. Direct legacy metadata writes after an anchor fail closed through delta divergence, requiring a fresh manifest rather than fabricated events. This is registered-Sync coverage with legacy divergence detection.

Actual identity/receipt/event equivalence, real version-conflict event projection, checksum, no private leakage, no domain writes, counter rollback/overflow, owner/captured-input/session/generation/deleted fences and corruption/gap checks passed. Injected logical clock establishes exact90day cursor/event boundaries, not wall-clock endurance. Manifest mint remains30minutes; feed range/page expiry follows its90day source checkpoint. The earlier30minute range-policy failure is retained separately. Metadata fault injection never removes physical records or bytes.

Full registered metadata manifest49group baseline remains covered including1006actual versions/4030rows and snapshot readConcern/atClusterTime consistency. Manifest bytes/reference closure/offline readiness remain false; reconciliation still covers submitted summaries independently. Feed acknowledgesOutbox=false/mutationsApplied=false. Full B033/B080 not accepted; localHTTP/product routes and client gate integration remain incomplete.

Raw evidence: experiments/g02s/evidence/b033-runtime/2026-11-03T05-48-18-696Z. Evidence/source hashes checked; executable/schema/dependency drift0. Clean integration justified by shared MetadataService counter/identity.kind, manifest hash, feed indexes and4new primary/generated schemas. Only2affected B031 cases rerun; no X01–X04/browser/ML/full old B031/B032 IO rerun. Metadata OpenAPI 19components/210refs match primary; no route registration.

Graceful Mongo shutdown proof=false. Any captured SIGINT timeout/SIGKILL warnings are not graceful restart, intentional crash or power-loss proof. All data/evidence retained.

- Actual owned loopback Mongo replica-set transactions and actual retained private bytes; synthetic data only.
- Auth mail is in-memory fake only; no real email/cloud/provider or HTTP/product registration.
- Actual declaration/atomic commit/receipt/version-conflict stage; Registered project metadata manifest is implemented; byte/reference closure/offline readiness, changefeed/client gate/product HTTP and later resource-copy kinds remain unaccepted. Reconciliation action snapshots cover submitted summaries.
- Faults/race interleavings explicitly injected, not actual disk deletion/bitrot/power-loss proof.
- B032 remains partial; cleanup and cleanup-worker races remain unverified.
- Clock advanced to logical90-day expiry; not90days of actual wall-clock endurance.
- New-transport and response-drop tests are local service/DB tests; not browser HTTP end-to-end integration.
- Registered-foundation project metadata manifest and registered-Sync changefeed are verified. Binding full manifest to reconciliation actions, client gate/localHTTP and future resource kinds remain unfinished. No byte/offline readiness or automatic client ACK/gate change.
