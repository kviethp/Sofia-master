# Hướng dẫn đóng góp

Ngôn ngữ:
- [English](../../public/CONTRIBUTING.md)
- [Tiếng Việt](./CONTRIBUTING.md)

Bản tiếng Anh là nguồn chuẩn khi mở pull request hoặc tham gia phát triển.

## Luồng phát triển
1. fork repository
2. chạy `node scripts/bootstrap.mjs`
3. chạy `pnpm install`
4. chạy `doctor` và `smoke`
5. làm trên một slice rõ ràng
6. thêm test phù hợp
7. cập nhật tài liệu liên quan

## Điểm bắt đầu

Dùng [Quickstart tiếng Anh](../../28-quickstart.md) hoặc [chỉ mục tài liệu tiếng Việt](../../README.vi.md) làm điểm vào.

## Kỳ vọng cho pull request
- giải thích thay đổi
- nêu module bị ảnh hưởng
- kèm test
- nêu ảnh hưởng compatibility
- nêu ảnh hưởng migration nếu có
