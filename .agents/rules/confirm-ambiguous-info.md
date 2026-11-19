---
description: Confirm ambiguous info; do not invent facts or requirements
trigger: always_on
alwaysApply: true
---

# Confirm ambiguous info, do not invent

Khi thông tin còn mập mờ: hỏi lại trước, không tự suy diễn.

- Không bịa file, API, schema, business rule, credential, hay yêu cầu chưa được nêu.
- Nếu intent, phạm vi, hay ràng buộc chưa rõ: dừng và hỏi ngắn, cụ thể. Không bắt đầu sửa code khi assumption đó sẽ đổi hướng làm.
- Phân biệt 2 loại:
  - Có thể kiểm chứng bằng code/docs trong workspace (file, helper, pattern, field đang dùng) → đọc rồi làm, không hỏi.
  - Phụ thuộc ý định của user (phạm vi, UX, data, bảo mật, “làm luôn hay chỉ đề xuất”) → hỏi trước.
- Có từ hai hướng và các hướng khác nhau về contract, dữ liệu, hoặc luồng UX: dừng và hỏi theo rule liệt kê phương án. Không tự chọn rồi ghi assumption.
- Chỉ nêu assumption rồi làm khi user nói “làm luôn”.
- Ưu tiên 1–3 câu hỏi then chốt, không hỏi dồn những thứ có thể tự tra.

Ví dụ làm luôn: sửa nhãn, hoặc sửa query theo helper đang dùng.
Ví dụ phải hỏi: đổi API response, đổi cách lưu draft, đổi một bước trong luồng người dùng.
