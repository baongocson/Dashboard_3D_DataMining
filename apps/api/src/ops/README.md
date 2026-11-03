# Local operations foundation

Explicit createApp localOps injection only. Default routes stay absent and services must share AuthService. Liveness proves handler availability; readiness probes Mongo ping, current generation/maintenance and private directory R/W access. It explicitly does not prove durable writes, disk capacity, backup/restore or full G02S readiness.

Capabilities project published limits without per-account limits; operations paginate the existing authoritative registry without enabling anything. Compatibility requires an authenticated session, returns actual control generation and explicitly reports releaseWindowVerified=false. No current/previous build retention or migration execution is claimed. No mutation, deployment or public auth is enabled.

Five primary ops DTOs and ops.local.v1.json now document and validate this local scope. The explicit loopback Node proxy-error helper returns actual UTC envelopes for allowlisted statuses, guarded by a per-process credential. Nginx 413/refused-upstream502/hanging-upstream504 and injected503 pass. Full compatibility/release-window/migration and helper-failure production resilience remain unverified; B035 full acceptance is partial. Failed configurations/responses and all logs remain retained. Do not deploy this dev fixture.

