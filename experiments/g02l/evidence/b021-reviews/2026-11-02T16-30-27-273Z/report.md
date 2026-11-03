# B021 — local store foundation passed

Accepted owner decision A recorded in docs/adr/ADR-B021-01-version-head.md; C11 coordinated, P unchanged. Primary S08 separates expectedLocalHead and server expectedHead; typed S11 guard checks entity baseRevision0, branch/dependency binding. Hash algorithm unchanged.

26current browser cases passed (22kernel,4real browser crash),13Node contract/regression tests and strict TypeScript pass. 22 historical failed observations retained. Selected product-source hashes match current source; raw manifest verification passed.

Initial fixture omitted required columnIds, all cases stopped at shape validation. Later reopen mistakenly passed stored metadata extras into strict DTO; native abort initially obscured original ConstraintError. Fixed implementation/harness and reran because transaction/read path changed. Branch descriptor now preserves original fork/reason on continuation; byte reads traverse only required graph. Final source replay verified.

Evidence:
- experiments\g02l\evidence\b021\2026-11-02T15-15-56-845Z: {"passed":0,"failed":18,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021\2026-11-02T15-16-15-789Z: {"passed":14,"failed":4,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021\2026-11-02T15-16-39-660Z: {"passed":18,"failed":0,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021-crash\2026-11-02T15-18-07-138Z: {"passed":4,"failed":0,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021\2026-11-02T15-20-29-808Z: {"passed":22,"failed":0,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021-crash\2026-11-02T15-20-34-983Z: {"passed":4,"failed":0,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021\2026-11-02T15-37-32-636Z: {"passed":22,"failed":0,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021-crash\2026-11-02T15-37-37-743Z: {"passed":4,"failed":0,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021\2026-11-02T16-29-49-076Z: {"passed":22,"failed":0,"blocked":0,"inconclusive":0}
- experiments\g02l\evidence\b021-crash\2026-11-02T16-30-04-278Z: {"passed":4,"failed":0,"blocked":0,"inconclusive":0}

Limits:
- Tests use synthetic small table/lineage; not import or actual operation execution.
- Native quota uses isolated StorageBucket1MiB, not a physical disk full test.
- Missing-byte test is read visibility injection, not actual eviction/deletion.
- Browser process crash proof is not system power-loss/disk durability guarantee.
- B022 owns actual WebLock/account gate/worker lifecycle; B024 owns ACK/sync gate/snapshot.
- No production migration; S08 draft completed before local database schema1 was introduced.
- Server receipt resolution/conflict/reconcile must be implemented and tested in B031/B033; local tests do not claim server implementation.
- Old failed artifacts retained. Current provenance is per-case across kernel22 and crash4 cases; not a single run.

Next: B022 actual writer/account/worker protocol, then B023 budget/preview and B024 sync gate/outbox snapshots according to backlog. B030 local auth already has independent evidence; B031 may start with accepted A when its own dependencies/scope are re-read. No need to rerun X04.
