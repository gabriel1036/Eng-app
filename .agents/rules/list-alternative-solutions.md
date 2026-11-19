---
description: List alternative solutions with trade-offs before implementing
trigger: always_on
alwaysApply: true
---

# List alternative solutions with trade-offs

Nếu có nhiều hơn 1 giải pháp hợp lệ để giải quyết yêu cầu: liệt kê các giải pháp trong phạm vi thực tế của codebase, mỗi giải pháp kèm ưu điểm và hạn chế, rồi để user lựa chọn trước khi triển khai.

- Chỉ liệt kê khi các hướng khác nhau về phạm vi file, dữ liệu, hoặc hành vi người dùng thấy. Repo đã có một pattern cho việc đó thì làm luôn theo pattern đó.
- Mỗi option: mô tả ngắn + ưu điểm + hạn chế (+ khi nào nên chọn, nếu hữu ích). Nêu hướng ít code hơn và vì sao nó đủ cho yêu cầu.
- Hướng đang làm phức tạp hơn mức cần: nói rõ và đề xuất hướng nhỏ hơn trước khi triển khai.
- Không bắt đầu implement một hướng khi chưa chọn, trừ khi user đã chỉ định rõ hoặc yêu cầu “làm luôn”.
- Giữ danh sách gọn (thường 2–4 options); tránh phân tích dài dòng không cần thiết.

Ví dụ làm luôn: sửa nhãn, sửa query theo helper đang dùng, thêm trạng thái empty bằng component có sẵn.
Ví dụ phải hỏi: đổi API response, đổi cách lưu draft, đổi một bước trong luồng người dùng.
Ví dụ đẩy lại: yêu cầu thêm lớp config cho một nhánh chỉ dùng một lần → đề xuất sửa trực tiếp chỗ đó.
