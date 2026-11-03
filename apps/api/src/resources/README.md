# Resource foundation

ReferenceService is an unregistered local/dev read foundation. `incoming` lists only the three reference relations actually produced by MetadataService: source, sourceVersion and versionArtifact. Their strength is fixed to hard. Unknown or inconsistent stored relations fail closed instead of accepting a caller-selected strength. Future workflow/run/chart/dashboard/model/report writers need their own typed relation policies and authority before this coverage can expand.

The service authenticates through the existing AuthService fence and checks generation, owner/project, target and ancestor tombstones, each source entity/revision and relation integrity. Results are bounded live pages, not deletion snapshots or permission to delete. Opaque retained cursors bind scope/generation/page size and expire logically after30minutes; there is no TTL or deletion. Reads may write control/session fences and cursor records, never domain metadata, receipts, references or byte records.

No route, product adapter or resource mutation is registered. No physical cleanup/deletion job is opened. Full B034 typed resource/run/output foundation remains separate from this inventory capability.
