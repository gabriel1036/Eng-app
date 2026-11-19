---
description: Update corresponding feature markdown after changing code
trigger: always_on
alwaysApply: true
---

# Update feature markdown after code changes

Khi đã sửa code: tìm file markdown feature/module tương ứng (nếu có) và cập nhật cho khớp code mới, để session sau không miss logic.

- Cùng nơi tìm như khi đọc trước: `context/*.md`, docs của feature, README của module. Bỏ vendor/third-party README.
- Cập nhật đúng phần đã đổi: flow, file map, contract, invariant, change guide. Xóa hoặc sửa câu đã lỗi thời.
- Markdown lệch source đã đọc: sửa doc cho khớp source đó, chỉ trong phần vừa đụng.
- Chỉ ghi fact đã xác nhận từ source. Chỗ chưa chắc: `UNKNOWN` hoặc `NEEDS CONFIRMATION`. Không bịa logic vào MD.
- Không tạo MD/`context/` mới trừ khi user yêu cầu. Không cập nhật nếu không tìm thấy MD tương ứng.

Ví dụ: vừa đổi contract lưu draft trong code thì cập nhật mục contract trong `context/<feature>.md`. Không viết lại cả file, không sửa mục không liên quan.
