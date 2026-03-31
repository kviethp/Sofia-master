# Nhật ký thay đổi

Ngôn ngữ:
- [English](../../public/CHANGELOG.md)
- [Tiếng Việt](./CHANGELOG.md)

Bản tiếng Anh là nguồn chuẩn cho nội dung release. Bản tiếng Việt này dùng để đọc nhanh và điều hướng.

## 1.0.0

Bản phát hành Sofia Master đầu tiên ở trạng thái sẵn sàng publish.

### Đã thêm

- README hướng sản phẩm và file `PRODUCT-OVERVIEW`
- tài liệu cài đặt, triển khai và vận hành ở mức publish-ready
- template Nginx reverse proxy cho mô hình self-host một máy
- template systemd cho backup service và timer
- tài liệu tách staging và production
- checklist publish GitHub
- release notes cho `v1.0.0`

### Runtime

- runtime path với PostgreSQL và Redis
- tích hợp OpenClaw và 9Router
- workflow nhiều pha
- approval gates và approval polling
- run trace, artifact, usage và decision evidence
- phân loại retry, stale-run recovery, dead-letter handling và replay
- shell giao diện Sofia Web và Sofia Admin

### Kiểm chứng

- final readiness local: `pass`
- final readiness trên VPS deploy: `pass`
- conformance trên VPS deploy: `19/19 pass`

## 0.1.0

Mốc implementation pack runnable đầu tiên, đi từ alpha sang beta nội bộ.

### Đã thêm

- runtime path dùng PostgreSQL và Redis
- cầu nối execution với OpenClaw và 9Router
- hỗ trợ workflow nhiều pha
- approval gates và Telegram approval polling
- run trace, policy evidence, dead-letter replay và retry classification
- API surface cho runtime status, metrics, runs, approvals và project templates
- shell Web và Admin tối thiểu
- nền tảng cho backup, restore, compatibility snapshot, bootstrap và playbook vận hành
