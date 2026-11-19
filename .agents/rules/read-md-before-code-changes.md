---
description: Read corresponding feature markdown before changing code
trigger: always_on
alwaysApply: true
---

# Read feature markdown before code changes

Khi yêu cầu liên quan đến sửa code: trước khi sửa, tìm và đọc file markdown mô tả feature/module tương ứng (nếu có).

- Nơi tìm: `context/*.md` (ưu tiên nếu repo có `context/`; template thường là `context/feature_context_template.md`), docs của feature, README của module. Bỏ vendor, node_modules, third-party README.
- Ví dụ: Exam Creation → `context/exam_creation.md`.
- Đọc MD trước để nắm logic, ranh giới, file map, invariant hiện tại. Rồi đối chiếu với source. Markdown lệch source đã đọc: source thắng ở phần đang sửa; cập nhật doc theo rule cập nhật markdown, chỉ phần vừa đụng.
- Chỉ sửa đúng phạm vi đã xác nhận. Không bịa flow, field, endpoint, business rule. Không lan man sang file ngoài phạm vi, trừ khi MD/source chỉ ra dependency bắt buộc.
- Không có MD tương ứng: đọc source của feature rồi mới sửa; không tự tạo MD/`context/` mới trừ khi user yêu cầu.
