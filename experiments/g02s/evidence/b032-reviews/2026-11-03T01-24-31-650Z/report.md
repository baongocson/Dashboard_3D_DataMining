# B032 — retained storage and inventory pagination verified; physical cleanup unverified

Status: partial.15current Mongo/realHTTP/process groups passed,33Node contract/regression checks and strictAPI/webTS passed.219generated schemas match primary source. O05 has6endpoints/12components/94resolved refs. Current raw/source hashes and all historical manifests verified. No prior artifact overwritten.

The resumed goal exposed an authorized safe fix: cleanupPlan previously reported hasMore without accepting a continuation cursor, so items beyond its first100 could not be inventoried. A targeted test failed before the fix. The final implementation uses strict bounded options, minimal projection, opaque owner/project/generation-bound cursors with30min expiry, and fenced checks around the live scan.3pages/5items are complete and unique; wrong scope/owner/expired/generation cursors reject. Inventory remains advisory and never authorizes deletion.

Existing actual private byte/hash/assembly, ref-ready atomicity, table/lineage/source rows, private streaming/413/validation, logout/cancel/leases and Node+Mongo restart regressions all pass after the shared schema/service change. No X01–X04 rerun.

Owner decision is explicit: keep all data, leave physical cleanup unverified, and do not ask again for the12B exception. The historical proposed byte file is still present with its matching hash. Earlier reviews saying awaitingUser are historical; this review records noDeletionConfirmed. No dependency waiver is inferred. B033/downstream remain unopened until B032 acceptance/dependency scope is resolved by a new instruction.

Raw runs:
- experiments/g02s/evidence/b032/2026-11-02T19-24-23-878Z: {"passed":11,"failed":0}
- experiments/g02s/evidence/b032/2026-11-02T19-26-18-706Z: {"passed":12,"failed":0}
- experiments/g02s/evidence/b032/2026-11-02T19-29-31-772Z: {"passed":1,"failed":0}
- experiments/g02s/evidence/b032/2026-11-02T19-30-51-473Z: {"passed":14,"failed":0}
- experiments/g02s/evidence/b032/2026-11-02T19-34-35-838Z: {"passed":14,"failed":0}
- experiments/g02s/evidence/b032/2026-11-03T01-18-05-559Z: {"passed":0,"failed":1}
- experiments/g02s/evidence/b032/2026-11-03T01-19-01-865Z: {"passed":3,"failed":0}
- experiments/g02s/evidence/b032/2026-11-03T01-20-19-854Z: {"passed":15,"failed":0}

Limits:
- B032 remains partial: the owner explicitly chose to keep all data and leave physical cleanup unverified. No exception is pending; do not ask the same question again. The historical12B proposal remains untouched.
- Do not open dependent B033/B034/B035/G03 by treating live inventory as physical cleanup proof or a dependency waiver. No deletion or product cleanup is authorized.
- Inventory pagination now has a usable opaque continuation cursor, owner/project/generation/30min binding and limit1..100. It is a live advisory list, not an atomic deletion plan or consistent offline snapshot.
- Actual source uploads19999999/20000000B and output25165824B verified by whole hash.256MiB boundary was declaration/guard only, not an actual256MiB upload or peakRAM benchmark.
- Typed table/row lineage/source rows checked against real ready bytes; server does not recompute parser/import/join/model numerical output. Other typed product artifact kinds and sparse remain unavailable.
- Operation concurrency2account/8instance tested with held real streams/DB leases. Not100-user traffic, throughput or infinite-scale proof.
- Private stream tests use actual loopback HTTP with manually supplied test cookies; no browser Secure-cookie, public TLS, Nginx/platform deployment or cloud proof.
- Node child+Mongo stop/start preserves hash/ref/bytes. In the current run an owned Mongo child hit the10s SIGINT timeout and its manager used SIGKILL; do not label the run wholly graceful or intentional crash proof. Not power loss/cloud redeploy/backup/restore proof.
- ENOSPC and missing-key metadata faults are injected, not actual full disk/eviction/bitrot. Native actual disk exhaustion was not attempted.
- Byte receive/hash/assembly/format preflight are outside metadata transaction. Sealed files are immutable and retained; external tampering after preflight is not prevented by a Mongo transaction.
- No product adapter/auth public/mail/AI/cloud/hosting, filesystem deletion, git add/commit/push/deploy.
