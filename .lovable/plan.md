

## แผนทำ Sticky Header + Tabs บนหน้า Home Feed

### ปัญหา
ปัจจุบัน TastureHeader และ HomeFeedTabs อยู่ใน scroll flow เดียวกับโพส ทำให้เมื่อเลื่อนลงจะหายไป

### แนวทาง
ปรับ layout ของ `HomeFeed.tsx` ให้เป็น **fixed header + scrollable content**:

1. **TastureHeader** → `sticky top-0 z-40 bg-background` (คงที่ด้านบนเสมอ)
2. **ส่วน "ฟีด" title + HomeFeedTabs** → `sticky z-30` ติดอยู่ใต้ header เมื่อเลื่อนถึง
3. **โพสต์** → เลื่อนได้ตามปกติ

### การแก้ไขไฟล์

**`src/pages/HomeFeed.tsx`** (บรรทัด ~634-673)

- หุ้ม `TastureHeader` ด้วย `div` ที่มี `sticky top-0 z-40 bg-background`
- หุ้ม title "ฟีด" + `HomeFeedTabs` ด้วย `div` ที่มี `sticky top-[56px] z-30 bg-background` (56px = ความสูงโดยประมาณของ header)
- Pull-to-refresh indicator ยังอยู่ระหว่าง header กับ tabs ตามเดิม
- เพิ่ม subtle border-bottom หรือ shadow เล็กน้อยเมื่อ sticky เพื่อแยกชั้นชัดเจน

### ผลลัพธ์
- โลโก้ "tasture" คงที่ด้านบนตลอด
- แท็บ สำรวจ/ใกล้ฉัน/กำลังติดตาม/สำหรับคุณ จะติดอยู่ใต้โลโก้เมื่อเลื่อน
- เฉพาะโพสต์เท่านั้นที่เลื่อนได้

