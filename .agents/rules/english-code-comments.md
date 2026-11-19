---
description: Only use English when adding or updating comments in code
trigger: always_on
alwaysApply: true
---

# English code comments

Khi cần comment trong code: chỉ dùng duy nhất tiếng Anh (English).

- Mọi comment trong source code (line comments, block comments, JSDoc, docstrings, TODOs) đều phải viết bằng tiếng Anh.
- Tuyệt đối không dùng tiếng Việt hoặc ngôn ngữ nào khác trong comment code.
- Giữ comment ngắn gọn, rõ nghĩa, dùng đúng thuật ngữ kỹ thuật.
- Không tự ý dịch lại hoặc sửa các comment tiếng Việt có sẵn từ trước nếu không thuộc phạm vi dòng cần thay đổi (tuân thủ rule surgical changes).
- Chỉ viết comment khi cần thiết để làm rõ logic phức tạp, không viết comment mô tả điều hiển nhiên.

Ví dụ: Dùng `// Validate session token before handling request` thay vì `// Kiểm tra token phiên trước khi xử lý request`.
