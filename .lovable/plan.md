

## เพิ่ม Slide Animation ตามทิศทางแท็บ

### แนวทาง
ใช้ `AnimatePresence` + `motion.div` หุ้มเนื้อหาฟีด โดยคำนวณทิศทาง (ซ้าย/ขวา) จาก index ของแท็บเก่า vs แท็บใหม่

### การแก้ไข

**1. `src/pages/HomeFeed.tsx`**
- เพิ่ม `useRef` เก็บ index ของแท็บก่อนหน้า
- ใน `handleTabChange`: คำนวณ `direction` = new index > old index ? 1 : -1
- เก็บ `direction` ใน state
- หุ้มเนื้อหาใน scrollable area (บรรทัด ~681-780) ด้วย `AnimatePresence mode="wait"` + `motion.div` ที่มี:
  - `key={activeTab}`
  - `initial={{ x: direction * 60, opacity: 0 }}`
  - `animate={{ x: 0, opacity: 1 }}`
  - `exit={{ x: direction * -60, opacity: 0 }}`
  - `transition={{ duration: 0.25, ease: "easeInOut" }}`

### ผลลัพธ์
- กดแท็บขวา → เนื้อหาเลื่อนเข้าจากขวา เนื้อหาเก่าออกทางซ้าย
- กดแท็บซ้าย → เนื้อหาเลื่อนเข้าจากซ้าย เนื้อหาเก่าออกทางขวา

