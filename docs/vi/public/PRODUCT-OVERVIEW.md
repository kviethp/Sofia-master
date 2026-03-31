# Sofia Master

Ngôn ngữ:
- [English](../../public/PRODUCT-OVERVIEW.md)
- [Tiếng Việt](./PRODUCT-OVERVIEW.md)

Sofia Master là lớp orchestration self-host dành cho các nhóm phát triển sản phẩm AI.

Nó nằm phía trên:
- **OpenClaw** cho agent runtime và execution
- **9Router** cho model routing, provider abstraction, fallback và quota strategy

## Sofia bổ sung gì

Sofia là control plane còn thiếu nếu chỉ dùng runtime agent thuần.

Khả năng chính:
- quản lý task lifecycle
- chọn model theo policy
- workflow nhiều pha như `planner -> builder -> verifier`
- approval gate cho việc rủi ro
- audit trail, artifact và usage evidence
- dead-letter handling, replay và recovery
- tooling self-host cho backup, restore, release và rollback

## Vì sao cần Sofia

Chạy agent là một việc. Chạy agent có kỷ luật là việc khác.

Sofia giải quyết:
- khi nào nên nâng lên model mạnh hơn
- cách lưu bằng chứng, artifact và decision
- cách tách fast path khỏi high-risk work
- cách recover khi worker lỗi hoặc run bị kẹt
- cách cung cấp bề mặt vận hành rõ ràng cho runtime, approvals và queue state

## Ưu điểm nổi bật

1. **Trung lập nhà cung cấp**
- làm việc với OpenClaw và 9Router thay vì khóa vào một provider

2. **Thiên về vận hành**
- có doctor, smoke, conformance, self-host acceptance và final readiness

3. **Tập trung self-host**
- tối ưu cho mô hình VPS một máy trước, rồi mới mở rộng

4. **Nhận thức policy**
- model profile routing, denylist guardrail, token budget và approval flow là phần lõi của runtime

5. **Sẵn để deploy**
- có release bundle, systemd template, reverse proxy template, backup automation và staging/prod split

## Đối tượng phù hợp

- builder cá nhân vận hành agent system trên VPS
- nhóm AI nhỏ cần control plane phía trên agent runtime
- nhóm muốn có kỷ luật `staging/prod` mà chưa cần platform quá lớn

## Trạng thái sản phẩm hiện tại

Repository này đã ở mức publishable như một self-host implementation pack và runnable product scaffold.

Bao gồm:
- product docs
- tài liệu cài đặt và triển khai
- dịch vụ runnable
- playbook vận hành
- tooling release và validation

Điểm vào khuyến nghị:
- [README.md](../../../README.md)
- [README.vi.md](../../../README.vi.md)
- [docs/README.md](../../README.md)
- [docs/README.vi.md](../../README.vi.md)
- [docs/28-quickstart.md](../../28-quickstart.md)
- [docs/31-vps-operations.md](../../31-vps-operations.md)
- [docs/32-staging-prod-layout.md](../../32-staging-prod-layout.md)
