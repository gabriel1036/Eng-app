---
description: Optimize coding implementation by FE/BE layer
trigger: always_on
alwaysApply: true
---

# Optimize coding implementation by layer

Khi hướng đã chốt và request liên quan đến coding: viết phần code nhỏ nhất giải quyết đúng yêu cầu, trên pattern sẵn có. Không chọn giải pháp “chạy được là xong” nếu còn cách gọn hơn trong cùng pattern.

- FE (UI/client): trang đã có pattern loading, empty, hoặc lỗi thì dùng lại pattern đó khi thay đổi đụng các trạng thái này. Không thêm trạng thái, feedback, hay animation ngoài yêu cầu.
- BE (API/server/data): trong đoạn đang sửa, bỏ công việc thừa, query/I/O thừa, và bottleneck rõ. Không thiết kế lại tầng query ngoài phạm vi.
- Full-stack: thêm UX hoặc tối ưu hiệu năng chỉ khi request cần, hoặc khi trang/API đã có pattern đó.
- Không thêm abstraction cho code dùng một chỗ. Không thêm cấu hình chưa được yêu cầu. Không thêm xử lý lỗi cho tình huống không xảy ra.
- Diff lớn hơn nhiều so với việc cần làm thì thu nhỏ lại.

Ví dụ: trang đã dùng một component empty và request đụng trạng thái rỗng thì dùng component đó. Không tạo component mới. Không thêm empty state cho màn nằm ngoài yêu cầu.
