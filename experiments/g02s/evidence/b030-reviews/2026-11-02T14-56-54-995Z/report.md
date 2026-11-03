# B030 — local server auth/session foundation

Status: localServerFoundationPassed; public auth OFF. 21 current executed cases passed; 2 failed observations retained. Selected product-source hashes match current; validators 184 schemas; strict TypeScript and10 B020 regression cases pass.

## Evidence and corrections

- experiments\g02s\evidence\b030\2026-11-02T14-48-53-157Z: {"passed":15,"failed":1,"blocked":0,"inconclusive":1}
- experiments\g02s\evidence\b030\2026-11-02T14-49-09-742Z: {"passed":1,"failed":0,"blocked":0,"inconclusive":0}
- experiments\g02s\evidence\b030\2026-11-02T14-51-06-174Z: {"passed":16,"failed":0,"blocked":0,"inconclusive":1}
- experiments\g02s\evidence\b030-browser\2026-11-02T14-51-16-796Z: {"passed":2,"failed":0,"inconclusive":0,"blocked":0}
- experiments\g02s\evidence\b030\2026-11-02T14-53-41-301Z: {"passed":2,"failed":1,"blocked":0,"inconclusive":0}
- experiments\g02s\evidence\b030\2026-11-02T14-54-05-492Z: {"passed":1,"failed":0,"blocked":0,"inconclusive":0}

First N-CSRF failure was an undefined-header harness assertion; targeted rerun passed. C18 implementation omission corrected: success/error serverNow is required, shared helper supplies UTC and B030 uses the controlled server clock. This fixes implementation to existing C18, not a P or contract decision change. Historical B020 evidence remains valid for its earlier scoped generation; current validators rebuilt and regression rerun. OpenAPI initially embedded local #/$defs refs without component scope; corrected builder and reran endpoint/ref case,164refs resolve locally. No run data overwritten.

## Delivered

TypeScript Fastify factory13O01/O02 routes;18S09primaryschemas; local OpenAPI3.1/23components; Mongo M01-M04/indexes; real Argon2id PHC bounded2active/8queued; HMAC OTP; atomic activation counter, reset/password generation and session fence; deferred old-session handle; safe envelopes/no-store/CSRF. Fake adapter onlyRAM/noSMTP/debugOTPHTTP. Disposable Chrome/Edge HTTPS transport passed, screenshots inspected with engine/version/run labels and no credentials. Two screenshots are intentionally distinguishable.

## Criteria and limits

- I01: API/bootstrap passed, form UI deferred B040
- I02: actual99-to-100 race passed
- I03: server boundaries/concurrent attempts passed
- I04: notTested full owner/offline account gate: B022/B043 dependency blocked
- I21: actual synthetic-commit/login/logout fence passed; real sync/upload/reset/client integration deferred B033/B043
- I22: server old deferred handle passed; offline queue/UI deferred B043

- Composite latest per-case evidence, not one full green run. Old failures and placeholder inconclusive retained.
- Native local Mongo single member, no production replica/availability proof.
- Browser test trusts self-signed cert only in disposable context; X07 separately tested explicit CA/Nginx.
- Argon2 RSS before/after is not peak or capacity guarantee; dev300IP/20login tuning not release policy.
- Fake mail/unknown reset decoy public-shape equality does not prove timing-side-channel immunity or real deliverability.
- B030 does not implement frontend dirty/logout/account gate, real upload/sync fence, AI RAM context cleanup, migration/restore gate or production secret lifecycle.
- Original prompt/v2 and backlog untouched; PROGRESS is execution-state authority with scoped criteria.

## Next dependency

Await owner decision in experiments/g02l/evidence/ADR-B021-head-revision-proposal.md. Do not implement local version/head/outbox, enable sparse/product engine, or silently choose between C02/C10 and C11. G02L B022+ depends B021; G02S B031 version/head and downstream sync requires the same decision. No independent full backlog task remains ready after this local auth foundation; unfinished public mail/hosting/AI requires explicit resources/authorization.
