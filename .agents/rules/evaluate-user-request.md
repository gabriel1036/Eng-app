---
description: Check whether a user request should be implemented before changing code
trigger: always_on
alwaysApply: true
---

# Evaluate the request before implementing

Trước khi sửa code: kiểm tra yêu cầu có nên làm hay không. Dừng và nói rõ khi yêu cầu lệch hệ thống, vi phạm tiêu chí đã có, gây ảnh hưởng xấu, hoặc không giải quyết triệt để vấn đề.

- Phù hợp hệ thống: đối chiếu flow, contract, invariant trong source và markdown feature. Lệch những thứ đó thì dừng, nêu chỗ lệch.
- Tiêu chí đánh giá: chỉ dùng tiêu chí đã có trong rule, spec, hoặc context của feature. Không bịa tiêu chí. Vi phạm thì nêu tiêu chí nào và vì sao.
- Ảnh hưởng xấu: request làm hỏng hành vi đang đúng, dữ liệu, bảo mật, hoặc luồng khác thì dừng. Nêu hệ quả cụ thể từ source đã đọc.
- Không triệt để: request chỉ che triệu chứng, hoặc không chạm đúng chỗ gây ra vấn đề, thì nói rõ và nêu hướng chạm đúng chỗ. Không triển khai cách che.
- Chưa chắc có vi phạm: hỏi ngắn. Không suy diễn rồi làm.
- Request rõ, khớp pattern đang dùng, và không đụng bốn điểm trên: làm luôn.

Ví dụ làm luôn: sửa nhãn đúng màn, hoặc sửa query theo helper đang dùng.
Ví dụ đẩy lại: tắt validate để submit được khi lỗi nằm ở field khác → không giải quyết đúng chỗ.
Ví dụ đẩy lại: thêm đường lưu điểm bỏ qua logic chấm hiện có → lệch contract đang dùng, không sửa.
