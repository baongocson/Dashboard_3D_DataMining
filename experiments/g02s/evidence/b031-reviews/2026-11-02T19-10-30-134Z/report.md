# B031 — local-dev metadata/version foundation passed

14 current Mongo/private-API groups passed in one final run;29Node contracts/regression checks and strictAPI/web TypeScript passed.212primary/generated schemas agree. O03/O04 metadata subset:8endpoints/19schema components/209resolved local refs. Raw/source hashes verified; original evidence retained.

Project create/replay/concurrent replay/rename CAS, private owner/project scope, import intent grant/expiry/renew/config/logical-ID binding, actual V0→V1→V2 and branchV3 fromV1, two-source derived lineage, hash/immutability, parent/self-cycle/secondV0 guards, generation/tombstone/revocation ordering, opaque paging and auth-only factory regression covered. Prepared mutation handles keep hashing outside transaction and permit multi-mutation rollback of data+identity in one fenced transaction. No HTTP batch/ACK proof is claimed.

B031 source/API scope and defaults keep artifact writes fail-closed. Source bytes/manifest formats and true ready storage must be supplied and verified in B032. Stale head rejects here; stable conflict preservation is B033, not an silently accepted overwrite.

Runs:
- experiments/g02s/evidence/b031/2026-11-02T19-02-06-310Z: {"passed":6,"failed":3}
- experiments/g02s/evidence/b031/2026-11-02T19-03-34-770Z: {"passed":11,"failed":0}
- experiments/g02s/evidence/b031/2026-11-02T19-06-31-769Z: {"passed":12,"failed":0}
- experiments/g02s/evidence/b031/2026-11-02T19-08-18-839Z: {"passed":14,"failed":0}
- experiments/g02s/evidence/b031/2026-11-02T19-09-25-741Z: {"passed":14,"failed":0}

Limits:
- Metadata/session/transaction foundation only. Dataset/version tests inject an explicitly synthetic artifact metadata authority. No real storage/byte/format verification claim; default authority is absent and the complete metadata transaction rolls back.
- No HTTP dataset/version writer or batch endpoint: future B033 composes opaque prepared handles inside one auth.withFence transaction. B033 still owns actual batch/ACK, stable conflict copies/branches, receipt expiry and reconciliation.
- No product parsing/concat/join/ML operation enabled. Synthetic operation config is stored as provenance; it is not numerical output verification.
- Pagination is live ID keyset metadata, not a consistent B080 offline snapshot. Scope/owner/expiry and bounded reads tested; huge graph/physical peakRAM/100user capacity unmeasured.
- Version commit before/after revocation ordering tested against actual Mongo transaction. This run does not claim an actual concurrent revoke race; shared B030 fence mechanism retained.
- B034 owns resources/runs beyond dataset/version; B041/B043 own product import/undo/current-pointer/reopen integration. No dataset.head.select semantics enabled here.
- First exploratory run predates source-at-start guarding: preserve its3failed observations as historical diagnostics only, not current acceptance. All current evidence has source-at-start snapshot and end hash equality.
- Local test/development factory only; no public auth, real mail/AI/cloud/hosting, data deletion, git add/commit/push/deploy.

Next dependency: B032 depends B031 and B010, both foundation evidence available; read C03/C10/C18/C20–C21,S12/O05/M14–M15,F12/F14 before defining storage scope. B033 follows B032/B030. B034/B035 then G03 still have dependencies; no product enablement implied.
