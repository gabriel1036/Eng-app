---
description: Keep each diff limited to the request and match existing style
trigger: always_on
alwaysApply: true
---

# Surgical changes

Khi sửa code: chỉ đụng những dòng cần cho đúng yêu cầu. Mỗi dòng đổi phải truy được về request.

- Không chỉnh code, comment, hay format ở chỗ bên cạnh.
- Không refactor phần chưa hỏng.
- Giữ style hiện có của file, kể cả khi cách khác sạch hơn.
- Code chết có sẵn và không liên quan request: nhắc trong câu trả lời, không xóa.
- Import, biến, hoặc hàm trở thành không dùng vì chính thay đổi này: xóa chúng.
- Không xóa code chết có từ trước, trừ khi user yêu cầu.

Ví dụ: sửa một nhãn trong view thì không format lại cả file và không đổi helper bên cạnh. Lệnh gọi nào chính sửa này làm thành không dùng nữa thì xóa lệnh gọi đó.
