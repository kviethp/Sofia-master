# Ma trận vai trò và kỹ năng

Bản tiếng Việt cho tài liệu [gốc tiếng Anh](../34-role-skill-matrix.md).

## Mục đích

Ánh xạ từng vai trò agent với prompt chính, path sở hữu, nhóm kỹ năng khuyến nghị và loại bằng chứng cần có.

Tài liệu này nên được dùng cùng:

- [../21-implementation-truth-map.md](../21-implementation-truth-map.md)
- [../22-agent-ownership-map.md](../22-agent-ownership-map.md)
- [../23-current-status-matrix.md](../23-current-status-matrix.md)
- [../24-multi-agent-operating-model.md](../24-multi-agent-operating-model.md)

## Tóm tắt

- Mỗi vai trò phải có prompt rõ ràng.
- Mỗi checkpoint phải có ownership theo path.
- Kỹ năng hiện tại đã có compile layer cơ bản và có thể xuất thành JSON artifact.
- Phần chưa hoàn thiện là trust enforcement end-to-end trong runtime.
- Nếu role chưa có prompt, cần bổ sung prompt hoặc đổi ownership rõ ràng trước khi chạy song song.

## Điểm chính

- Đã có prompt riêng cho:
  - Main Orchestrator
  - Implementation
  - QA Reviewer
  - Runtime Audit and Reconciliation
  - Core Platform
  - Integrations
  - UI and Operator Experience
  - OSS and Release
- Các nhóm skill nên ưu tiên:
  - `runtime-ops`
  - `openclaw-9router`
  - `postgres-redis-runtime`
  - `conformance`
  - `release-deploy`
  - `docs-bilingual`
  - `secret-scan`
  - `ui-operator-flows`

## Tài liệu gốc

- [../34-role-skill-matrix.md](../34-role-skill-matrix.md)
