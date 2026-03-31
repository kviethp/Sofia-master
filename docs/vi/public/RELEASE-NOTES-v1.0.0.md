# Sofia Master v1.0.0

Ngôn ngữ:
- [English](../../public/RELEASE-NOTES-v1.0.0.md)
- [Tiếng Việt](./RELEASE-NOTES-v1.0.0.md)

Bản tiếng Anh là nguồn chuẩn cho release notes.

## Tóm tắt

`v1.0.0` là bản phát hành đầu tiên của Sofia Master ở trạng thái publish-ready.

Bản này cung cấp một lớp orchestration self-host phía trên OpenClaw và 9Router, với triển khai một máy đã được kiểm chứng, tách staging/production và đầy đủ tooling vận hành cơ bản.

## Thành phần có trong bản phát hành

- runtime dựa trên PostgreSQL và Redis
- workflow nhiều pha `planner -> builder -> verifier`
- định tuyến model theo policy
- approval gates và approval polling
- run trace, artifact, usage evidence và decisions
- retry classification, stale-run recovery, dead-letter handling và replay
- giao diện Sofia Web và Sofia Admin
- release bundle, release acceptance, self-host acceptance và final readiness
- template systemd cho triển khai self-host một máy
- template Nginx reverse proxy
- công cụ backup và restore
- mô hình staging và production trên cùng một VPS

## Phạm vi vận hành

Mô hình triển khai đã kiểm chứng:

- self-host trên một VPS
- OpenClaw runtime
- 9Router model gateway
- PostgreSQL
- Redis
- Nginx reverse proxy
- các service do systemd quản lý

## Tài liệu chính

- [README tiếng Anh](../../../README.md)
- [README tiếng Việt](../../../README.vi.md)
- [Product Overview tiếng Anh](../../public/PRODUCT-OVERVIEW.md)
- [Product Overview tiếng Việt](./PRODUCT-OVERVIEW.md)
- [Chỉ mục tài liệu tiếng Anh](../../README.md)
- [Chỉ mục tài liệu tiếng Việt](../../README.vi.md)

## Kiểm chứng

Bộ bằng chứng release gồm:

- doctor
- smoke
- conformance
- release-readiness
- release-acceptance
- self-host-acceptance
- final-readiness

## Ghi chú

- bản phát hành này tập trung vào self-host
- cấu hình domain và HTTPS vẫn phụ thuộc môi trường triển khai cụ thể
- credential vận hành riêng và artifact runtime được giữ ngoài repository công khai
