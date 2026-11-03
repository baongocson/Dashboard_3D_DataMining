# B024 — durable sync gate / bounded outbox snapshot / ACK

Dependencies B021/B022 passed; C06/C09–C11,C18/C20; S08/S11,F13/F15,I17/I18. Scope apps/web/src/local (sync coordinator và indexed outbox access/IDB additive migration), primary schemas/build, fixtures/integration và experiments/g02l, PROGRESS. Không HTTP server, upload, real auth/cloud/email/AI, conflict UI hoặc auto-resync.

Shared packages/data-format cần typed collectVersionArtifacts: server/client tái dựng ordered descriptor graph theo version.tableManifest rồi ordered dependencies rồi lineage, không lấy cả global batch artifact list để hash từng mutation. B021 đã dùng chính thứ tự này; helper không đổi hash algorithm/outbox. Other kinds đợi owning typed schema/validator; không gửi arbitrary upsert.

T: account sync WebLock riêng, không project writer; snapshot có membership/hash/generation/gate revision bền. Chỉ đọc tối đa101candidate keys (không payload), mỗiatomicgroup tốiđa21record đểguard100batch/20group; dependency walk iterative, stack/visited ID budget theoC20 vàbody1MiB, không fixed business cap tổngversion. Chọn dependency trước, batch đầy thì giữ parent cho lượt sau, không chia nhómnguyên tử. Hash ngoàiIDBwrite transaction, recheck immutable content/membership trước lưu snapshot. Outbox giữ acknowledged records/receipt trongphase này; không cleanup/delete evidence/data.

IDB schema2 thêm index status/commitId cho outbox và migration journal trong cùng upgrade transaction, không sửa byte/payload/hash. Test legacyv1→v2 bảo toàn metadata/unsynced; oldreader failkhông xóaDB. Fullrelease/multibuild migration policy cònB081, không coi devtransition là production rollout.

awaitingUser ghi bền dùoutboxrỗng. Healthy/reauth không mởflagcũ; mail/AI503không đóngcoregate. Usertrigger khi S chụpsnapshot; autochỉkhigateauto vàpermissionvalid. Partial/error giữawaiting, không retryngầm. ACKexactID/hash/serverGeneration/các tậpdisjointđủmembership vàatomicgroupkhôngnửa. Newmutation sau snapshot khôngACK; allACKchỉmởauto nếukhônggate revisionfailuremới/authchange. Generation/accountclosing chặnlateACK.

ResourceDeleted→blockedDeleted, giữbytes/local IDs, khôngre-ID. Receipt/cursorexpired hoặcgenerationmismatch→reconciliationRequired, khôngcoilàmới. conflictPreservedACKđược nhưngkhôngautochuyểnpointer/ref; localreceipt giữkếtquảchờB033/B082.

Localtransportfake trảS11schema; khônggọiserver. ServerresolveexpectedHead/receipt/hash/transactions thuộcB031/B033; clientACKtests không chứngminhserverđãcommit. Kiểm multitablock, snapshotnewitem, lostACK/retry stablemutations, partial/invalid/lateACK, emptyawaitingrefresh/health/mailAI/auth, atomicgroups/bounds/deps/metadata, migration vàreopenrefs.
