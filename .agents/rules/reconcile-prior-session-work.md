---
description: Reconcile new requests with prior work in the same session
trigger: always_on
alwaysApply: true
---

# Reconcile new requests with prior session work

Luôn so sánh request mới với những request cũ trong cùng 1 session để kiểm tra request mới có đảo ngược, thay đổi, hay ảnh hưởng đến request cũ hay không.

- Chỉ gỡ phần đã làm khi request mới đảo hướng đã rõ. Gỡ trước (hoặc cùng lúc), rồi mới triển khai theo request mới.
- Chưa chắc request mới là thay thế hay bổ sung thì hỏi ngắn trước khi sửa.
- Request mới chỉ bổ sung và không mâu thuẫn: giữ phần cũ, chỉ làm phần mới.
- Không gỡ commit đã có. Không sửa file ngoài phạm vi request mới.
- Không chồng thêm thay đổi lên code đã sai hướng khi hướng đảo đã rõ.

Ví dụ đảo hướng: request sau bảo bỏ auto-save vừa thêm → gỡ auto-save, rồi làm theo request mới.
Ví dụ bổ sung: request sau bảo thêm nút hủy bên cạnh auto-save → giữ auto-save, chỉ thêm nút hủy.
