# B024 — local client foundation passed

36 current browser cases (34 Chrome/Edge protocol/multitab + 2 real owned-process crash/reopen), 26 Node contract/regression checks and strict web/API TypeScript passed. Node regressions include repeated existing criteria, not 26 additional product features. Current source hashes match executed browser bundles; all B024 historical manifests verified. No external requests in protocol runs.

Existing unlogged B024 draft and raw evidence were audited, not treated as accepted progress. Corrected current account serverGeneration recheck before ACK; coordinator disposal after queued lock wait; account sync state remains idle while a newer pending item exists. New browser tests reproduce these lifecycle boundaries. Original sandbox run failed due loopback/browser restrictions and is retained as environment evidence; subsequent loopback-only run passed outside sandbox.

Local commit remains durable independently of sync. Only exact snapshot ACK members become acknowledged; records/receipts/bytes retained. Conflict receipt does not move context. Deleted and expiry retain local identity and require the owning reconciliation flow. No claim of real server commit or delivery.

Raw runs:
- experiments/g02l/evidence/b024/2026-11-02T16-20-07-092Z: {"passed":24,"failed":0,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024/2026-11-02T16-22-24-898Z: {"passed":26,"failed":0,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024/2026-11-02T16-24-06-742Z: {"passed":28,"failed":0,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024/2026-11-02T16-25-12-541Z: {"passed":30,"failed":0,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024/2026-11-02T16-32-50-629Z: {"passed":30,"failed":0,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024/2026-11-02T16-38-09-475Z: {"passed":30,"failed":0,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024/2026-11-02T18-50-28-301Z: {"passed":0,"failed":2,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024/2026-11-02T18-50-53-678Z: {"passed":34,"failed":0,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024/2026-11-02T18-51-33-463Z: {"passed":34,"failed":0,"inconclusive":0,"blocked":0}
- experiments/g02l/evidence/b024-crash/2026-11-02T16-26-18-084Z: {"passed":2,"failed":0,"blocked":0,"inconclusive":0}
- experiments/g02l/evidence/b024-crash/2026-11-02T16-40-26-724Z: {"passed":2,"failed":0,"blocked":0,"inconclusive":0}
- experiments/g02l/evidence/b024-crash/2026-11-02T18-51-47-075Z: {"passed":2,"failed":0,"blocked":0,"inconclusive":0}

Limits:
- Client-only synthetic transport ACKs; no real server upload, transaction, deduplication, receipt resolution or generation adoption proof. B031/B032/B033 own those checks.
- I17 local durable gate/tab/crash boundary checked; full worker/UI/cold-start integration remains B041/B043/B083. I18 client snapshot and partial ACK checked; server atomicity remains B033.
- Reopen checks use local version/ref/byte integrity; device/server reopenState schema/merge/UI remain B043/B082. No arbitrary typed kind enabled beyond dataset.version.create.
- Migration v1→v2 is additive local-dev preservation, not production release/rollback/compatibility policy B081.
- 100 batch/20 atomic group/1MiB metadata boundaries tested. Dependency ID/frame memory is an estimate; physical peak RAM, huge project throughput and 100-user scale remain inconclusive.
- Actual crash affects owned synthetic browser processes/profiles only. Profiles/evidence retained; no app data, database or evidence cleanup.
- No cloud/mail/AI/hosting/product engine/sparse enabled; no git add/commit/push/deploy.

Dependency next: B031 depends B030 local server foundation (passed with limits). B032 follows B031; B033 follows B032/B030. B040 still waits B035; do not jump G03.
