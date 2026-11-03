# B030 — local-dev auth/session

Dependencies: B020 shared foundation; B012/X03 MongoDB transaction/fence; B016/X07 local Nginx/Mongo profile. All have scoped evidence in PROGRESS. Real mail B017 remains blocked; no public auth or Internet deployment.

Scope: apps/api auth/config/routes/database components, S09 JSON Schemas/OpenAPI in packages/contracts, synthetic fixtures/tests and experiments/g02s, PROGRESS. No project/version/head/outbox logic, browser UI, root workspace, prompt/v2 or original evidence changes.

T implementation: Fastify 5.12.8 and cookie 11.1.5 (MIT), Mongo driver 7.8.0 (Apache-2.0), @node-rs/argon2 2.2.2 (MIT) local packages. Argon2id PHC library avoids relying on experimental Node crypto.argon2 or inventing PHC parsing; replacing it requires password-hash compatibility and cost/concurrency regression. Initial parameters m=19456 KiB, t=2, p=1, hash32/salt16, maximum 2 concurrent hashes and bounded queue; measure actual dev cost, not production capacity.

Primary sources: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/ ; https://github.com/fastify/fastify-cookie ; https://github.com/napi-rs/node-rs/tree/main/packages/argon2 ; https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html .

Use primary draft2020-12 S09 compiled validators; strict JSON parser and safe error envelope, no separate coercing validation. Explicit test/development fake-mail configuration; no SMTP implementation or debug HTTP OTP endpoint. MongoDB real single-node replica set from existing project binary; create fresh run data, retain DB, stop only owned process. No Docker/service installation.

Verify O01/O02 without preexisting session, Origin+bootstrap CSRF; Unicode/password/email policy; OTP boundaries/races/quota/generation/purpose; 99-to-100 atomic activation; login/reset/logout/session fence order; old deferred handle cannot revoke new session; profile allowlist/owner scope; password/OTP/token absent from durable records/logs. Fixture clock controlled, crypto real. Separate local API/inject proof from browser cookie transport and real mail proof. Missing evidence stays inconclusive; B030 not closed merely because a subset passes.
