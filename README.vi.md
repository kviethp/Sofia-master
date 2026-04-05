# Sofia Master

Ngôn ngữ:
- [English](./README.md)
- [Tiếng Việt](./README.vi.md)

Sofia Master là lớp điều phối và vận hành self-host cho phát triển sản phẩm AI.

Hệ thống được thiết kế để chạy phía trên:
- **OpenClaw** cho agent execution
- **9Router** cho model routing, fallback và abstraction nhà cung cấp

Sofia bổ sung:
- quản lý vòng đời task và run
- chọn model theo policy
- workflow nhiều pha như `planner -> builder -> verifier`
- approval gate cho tác vụ rủi ro
- artifact, decision, usage evidence và audit trail
- recovery, replay và tooling vận hành cho runtime self-host

Xem [PRODUCT-OVERVIEW.vi.md](./docs/vi/public/PRODUCT-OVERVIEW.md) để đọc bản giới thiệu sản phẩm bằng tiếng Việt.

## Điểm nổi bật

- ưu tiên self-host
- runtime stack trung lập nhà cung cấp
- có thể deploy trên một VPS
- có backup, restore, release, rollback và diagnostics tích hợp
- hỗ trợ tách `staging` và `production` trên cùng một máy

## Cấu trúc repository

- `apps/` API, worker, web và admin
- `packages/` policy, adapter, routing, shared contracts
- `docs/` tài liệu kiến trúc, cài đặt, release và vận hành
- `infra/` template Compose, Docker, systemd và Nginx
- `scripts/` doctor, smoke, conformance, release, backup, restore, diagnostics
- `sql/` schema PostgreSQL
- `openapi/` HTTP contract

## Cài đặt

### Yêu cầu

- Node.js 22+
- pnpm
- PostgreSQL
- Redis
- OpenClaw
- 9Router

Nếu bootstrap local bằng Compose, cần thêm Docker.

### Cài nhanh

#### Cách dễ nhất

Chạy flow setup hợp nhất:

```bash
node scripts/setup.mjs
```

Flow này hỗ trợ:
- quick mode cho người mới
- advanced mode để chỉnh port / execution mode / token
- khởi động core services ngay trong cùng window
- hoặc chỉ setup rồi in ra đúng lệnh để tự khởi động từng service riêng
- startup persistence: chạy ngay, tự khởi động khi boot máy, hoặc manual mode

#### Cách thủ công

1. Copy `.env.example` thành `.env`
2. Chạy `node scripts/bootstrap.mjs`
3. Chạy `pnpm install`
4. Khởi động stack:

```bash
docker compose -f infra/compose/docker-compose.yml up -d postgres redis api web admin
```

5. Khởi tạo runtime:

```bash
node apps/sofia-api/scripts/migrate.js
node apps/sofia-api/scripts/doctor.js
node apps/sofia-api/scripts/smoke.js
```

Chi tiết hơn ở [28-quickstart.md](./docs/28-quickstart.md) và [chỉ mục tài liệu tiếng Việt](./docs/README.vi.md).

## Bắt đầu nhanh

Mở:
- Web: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3001`
- API health: `http://127.0.0.1:8080/health`

Tạo task:

```bash
curl -X POST http://127.0.0.1:8080/v1/tasks \
  -H "content-type: application/json" \
  -d "{\"title\":\"Add a simple login page scaffold to a demo app\",\"templateId\":\"default\"}"
```

Sau đó kiểm tra:
- `/v1/tasks`
- `/v1/runs`
- `/v1/runtime/status`
- `.sofia/reports/`
- `.sofia/artifacts/`

## Triển khai

### Self-host một máy

Sử dụng:
- template systemd trong `infra/systemd/`
- template Nginx trong `infra/nginx/sofia.conf`
- các script release trong `scripts/`

Quy trình đề xuất:

```bash
node scripts/release-bundle.mjs
node scripts/release-acceptance.mjs
node scripts/self-host-acceptance.mjs
node scripts/final-readiness.mjs
```

Tài liệu vận hành:
- [31-vps-operations.md](./docs/31-vps-operations.md)
- [32-staging-prod-layout.md](./docs/32-staging-prod-layout.md)
- [25-backup-and-restore.md](./docs/25-backup-and-restore.md)
- [26-release-and-rollback-playbook.md](./docs/26-release-and-rollback-playbook.md)
- [27-incident-response-playbook.md](./docs/27-incident-response-playbook.md)

## Kiểm chứng runtime

Repository có các gate máy đọc được cho self-host readiness:

- `doctor`
- `smoke`
- `conformance`
- `release-readiness`
- `release-acceptance`
- `self-host-acceptance`
- `final-readiness`

Các script này dùng để chứng minh artifact deploy khỏe, không chỉ source tree.

## Trạng thái publish

Repository này đã được tổ chức theo hướng publish-ready như một self-host implementation pack và runnable Sofia Master scaffold.

Tài liệu chính:
- [PRODUCT-OVERVIEW.md](./docs/public/PRODUCT-OVERVIEW.md)
- [PRODUCT-OVERVIEW.vi.md](./docs/vi/public/PRODUCT-OVERVIEW.md)
- [Chỉ mục tài liệu tiếng Anh](./docs/README.md)
- [Chỉ mục tài liệu tiếng Việt](./docs/README.vi.md)
- [28-quickstart.md](./docs/28-quickstart.md)
- [31-vps-operations.md](./docs/31-vps-operations.md)
- [32-staging-prod-layout.md](./docs/32-staging-prod-layout.md)
- [33-github-publish-checklist.md](./docs/33-github-publish-checklist.md)
- [RELEASE-NOTES-v1.0.0.md](./docs/public/RELEASE-NOTES-v1.0.0.md)
- [RELEASE-NOTES-v1.0.0.vi.md](./docs/vi/public/RELEASE-NOTES-v1.0.0.md)

Tài liệu public bổ sung:
- [CHANGELOG.md](./docs/public/CHANGELOG.md)
- [CHANGELOG.vi.md](./docs/vi/public/CHANGELOG.md)
- [CONTRIBUTING.md](./docs/public/CONTRIBUTING.md)
- [CONTRIBUTING.vi.md](./docs/vi/public/CONTRIBUTING.md)
- [COMPATIBILITY.md](./docs/public/COMPATIBILITY.md)
- [COMPATIBILITY.vi.md](./docs/vi/public/COMPATIBILITY.md)
- [MODEL-POLICY.md](./docs/public/MODEL-POLICY.md)
- [MODEL-POLICY.vi.md](./docs/vi/public/MODEL-POLICY.md)
- [SECURITY.md](./docs/public/SECURITY.md)
- [SECURITY.vi.md](./docs/vi/public/SECURITY.md)
- [SUPPORT.md](./docs/public/SUPPORT.md)
- [SUPPORT.vi.md](./docs/vi/public/SUPPORT.md)
