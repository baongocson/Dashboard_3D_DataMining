// Synthetic identities only; passwords are not user data or environment secrets.
export const password='  Mật khẩu tổng hợp 🧪 123  ';
export const nextPassword='  Mật khẩu tổng hợp 🧪 456  ';
export const cases=[
 ['B030-N-CSRF','No existing session needed for auth/bootstrap; private routes reject; Origin/CSRF and strict JSON reject before auth work'],
 ['B030-policy','Unicode code points, exact password bytes, email IDNA/lowercase/+tag/dots, profile allowlist'],
 ['B030-activation-100','99 actual activated users plus two concurrent valid verifications reach exactly100, one rejection, consumed only once'],
 ['B030-OTP-attempts','Five concurrent wrong verifications commit five failed attempts; correct code cannot bypass exhaustion'],
 ['B030-OTP-generation','Cooldown60000 exact, resend invalidates old generation/purpose and correct current code consumes once'],
 ['B030-OTP-expiry','OTP invalid at300000; pending at24h and consumed challenge cannot resend; TTL does not provide authority'],
 ['B030-OTP-quota','Initial send plus resends total5/email/purpose/hour atomically; independent purposes; hour boundary'],
 ['B030-existing-user','A second pending registration/resend cannot overwrite an existing active user or old pending credentials'],
 ['B030-mail-status','Accepted/failed/unknown are truthful adapter outcomes and never activate automatically'],
 ['B030-single-session','Login B revokes A, introspection omits raw token/handle; profile is owner-scoped and immutable email'],
 ['B030-reset-grant','OTP reset purpose, one-use300s grant/password generation, epoch and password atomic, no auto-login or local clearing'],
 ['B030-deferred','Old-session handle without session is idempotent and cannot revoke new login; random handle has no authority'],
 ['B030-fence-order','Actual Mongo transaction fence serializes pre-revoke commit and login; old-session post-revoke commit is rejected'],
 ['B030-durable-secrets','Mongo has only password PHC/HMAC/token+grant digests, never plaintext; validators/error envelopes remain shared'],
 ['B030-argon2-cost','Real Argon2id roundtrip/PHC parameters, distinct salts, exact Unicode password; bounded concurrency and queue'],
 ['B030-session-expiry','Absolute7day expiry checked despite retained DB document; no Clear-Site-Data'],
 ['B030-O01-O02','All13auth/profile endpoint contracts exercised with shared success/error schemas; reset, deferred handle and no auto-login'],
 ['B030-reset-generation','A second pre-reset grant/challenge cannot change a newer password generation; known/unknown public shape matches'],
 ['B030-rate-guards','Atomic login/IP limits, fake-production/origin guard and OTP six-digit HMAC binding'],
 ['B030-HTTPS-browser','Chrome/Edge actual HTTPS cookie flags/shared-tab session and cross-origin refusal; no outside requests'],
];
