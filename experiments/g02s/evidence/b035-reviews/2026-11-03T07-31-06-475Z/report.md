# B035 local operations and proxy errors

5/5 HTTP groups;1/1 targeted proxy-error group; strict API TypeScript exit0 in both. UTC error envelopes/status/requestId/no-store/nosniff match. Existing primary contracts unchanged;5newDTOs/OpenAPI generated.

- 5HTTPgroups and1proxyerrorgroup across separate runs; no cleancombinedrun.
- Historical no-fallback Nginx case07-12-04 passed before ops DTOvalidation; not claimed current-source-equivalent.
- 503 Nginx status injected;504 actual hanging loopback upstream;502 actual refused upstream;413 actual oversized body.
- Loopback authenticated helper required. Helper-failure fallback/production resilience not verified.
- Readiness directoryaccess only; no persistence/capacity/releasewindow/migration execution proof.
- B032/B033/B034 remain partial; full G02S not accepted.
