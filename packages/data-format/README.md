# Data-format

Pure ESM browser/Node, không Node built-in/DB dependency trong runtime. Dùng cùng contracts generated validators, canonicalize5.1.0, WebCrypto.

- table-jsonl-v1: UTF8/LF, whole-record chunks, typed strings/null, stable IDs và byte hashes.
- csr-v1: uint32 LE index buffers, float64 LE data, nnz/shape/refs/hash; không densify.
- lineage-jsonl-v1: nguồn dataset/version/row có role/order, không thực thi join.
- Business hash có thuật toán/version trong CONTRACT_VERSION và FORMAT_VERSION; source byte hash luôn riêng.

Resource estimator/cấp phát toàn pipeline ở B023; helper không hứa browser peak RAM. No arbitrary raw JSON integer/surrogate/coercion. Internal chunk target không đồng nghĩa giới hạn upload transport.
