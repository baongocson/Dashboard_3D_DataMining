# B022 — actual writer/account/worker control

Dependency B021 passed, review15-23-09-675Z; B020 shared contract và C05/C06/C07, G00 S06/S07/S08,F07/F08,I04/I14/I15. Scope apps/web/src/local (controllers và store primitives cần cho fence/generation), shared schemas/helper/build, fixtures/integration, experiments/g02l và PROGRESS. Không UI/operation executor/sync/logout cleanup/AI/provider.

T: Web Locks giữ suốt ownership account/project; BroadcastChannel chỉ gửi yêu cầu/thông báo. ifAvailable tab phụ chỉ xem; transfer chỉ khi writer cũ chấp thuận, stop commands/dispose worker/invalidate fence trước release; không steal/timeout lock. Tab chết browser tự release lock; writer mới tăng fence/recovery. Browser thiếu lock chỉ xem.

Account namespace/profile owner gate từ entitlement đã xác minh; owner khác không được vào active workspace trước quy trình logout B043. Critical account WebLock tuần tự START/commit và confirmed close-generation; IDB generation là fence bền vững. Online401/needsReauth chỉ chặn sync, không xóa local hay vô hiệu entitlement. Confirmed close đổi generation/mode rồi dừng writer/worker; cleanup/deferred logout policy đầy đủ vẫn B043, không xóa dữ liệu trong probe.

S06 START/CANCEL/DISPOSE, events version/task/run/step/generation/fence/sequence; RESULT chỉ refs/summary và chỉ success sau LocalStore.commit/oncomplete. Duplicate/old/wrong owner context events discarded; malformed/fake percentage no accept. Real dedicated synthetic worker chỉ tạo artifact fixture, không engine thực.

Kiểm actual Chrome/Edge multitab2projects, request transfer/decline/no simultaneous writer, cancel/lateRESULT, page crash/reacquire/fence, owner switch rejection/outbox giữ, accountclose vsresult. Các ca đã có B021 kernel không thay thế các ca controller mới; không dùng prototype/mock lock làm proof one writer.
