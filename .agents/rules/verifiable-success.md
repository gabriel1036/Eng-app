---
description: State a verifiable done check before implementing
trigger: always_on
alwaysApply: true
---

# Verifiable success criteria

Trước khi sửa code: xác định xong việc bằng một kiểm tra làm được trong repo này.

- Tiêu chí yếu (“làm cho chạy”, “ổn hơn”) thì hỏi lại cho đến khi có kiểm tra cụ thể.
- Việc nhiều bước: nêu plan ngắn, mỗi bước có một kiểm tra. Việc nhỏ một hướng, như sửa nhãn hoặc sửa query theo helper có sẵn, thì kiểm tra sau khi sửa, không cần plan dài.
- Kiểm tra đúng loại việc. UI: thao tác đúng luồng người dùng bị ảnh hưởng. API hoặc dữ liệu: đối chiếu contract, query, hoặc response của đoạn vừa sửa.
- Không tạo bộ test mới nếu feature chưa có test.
- Làm xong thì chạy kiểm tra đã nêu. Chưa đạt thì sửa tiếp trong phạm vi request.

Ví dụ: “Sửa lưu draft” → xong khi lưu rồi mở lại còn đúng field đã đổi. “Đổi câu SQL danh sách” → xong khi query trả đúng bản ghi với điều kiện đang dùng trên màn đó.
