

## เพิ่ม Scroll Shadow ให้ Header

### แนวทาง
ใช้ scroll event listener ตรวจจับว่าเลื่อนลงแล้วหรือยัง แล้วเพิ่ม `shadow-md` + transition ให้ sticky header div

### การแก้ไข: `src/pages/HomeFeed.tsx`

1. เพิ่ม state `scrolled` (boolean) ที่เป็น `true` เมื่อ `scrollTop > 10`
2. ใช้ `useEffect` ฟัง scroll event จาก `containerRef`
3. เพิ่ม class แบบ conditional ให้ sticky header div (บรรทัด 638):
   - `transition-shadow duration-300`
   - เมื่อ `scrolled`: เพิ่ม `shadow-md`
4. ทำเช่นเดียวกันกับ sticky tabs div (บรรทัด 665) — เพิ่ม shadow เล็กน้อยเมื่อ scrolled

ผลลัพธ์: Header และ tabs จะมี shadow ปรากฏอย่างนุ่มนวลเมื่อเลื่อนลง แยก layer ชัดเจน

