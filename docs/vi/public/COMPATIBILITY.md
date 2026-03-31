# Tương thích

Ngôn ngữ:
- [English](../../public/COMPATIBILITY.md)
- [Tiếng Việt](./COMPATIBILITY.md)

Bản tiếng Anh là nguồn chuẩn cho chi tiết kỹ thuật.

## Phạm vi tương thích

Sofia Master nhắm tới một cửa sổ tương thích đã kiểm chứng giữa:
- Node.js
- OpenClaw
- 9Router
- các hợp đồng provider được hỗ trợ

Xem release notes để biết phiên bản pin cụ thể.

## Snapshot tương thích

Sinh snapshot tương thích runtime hiện tại bằng:

```bash
node apps/sofia-api/scripts/compatibility-snapshot.js
```

Lệnh này sẽ ghi:

- `.sofia/reports/compatibility-snapshot.json`
