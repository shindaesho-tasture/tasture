

## Plan: สแกนเมนูต่างประเทศ → แปลเป็นการ์ดภาษาไทย พร้อมเทคเจอร์และคำอธิบาย

### สิ่งที่จะทำ

เปลี่ยน scan-menu edge function ให้รองรับเมนูทุกภาษา โดย AI จะ:
1. ตรวจจับภาษาต้นฉบับ
2. แปลชื่อเมนูเป็นภาษาไทย (เก็บชื่อต้นฉบับไว้ด้วย)
3. วิเคราะห์เทคเจอร์หลักของแต่ละจาน (เช่น กรอบ, นุ่ม, เหนียว, ฉ่ำ)
4. สร้างคำอธิบายเบื้องต้นสั้นๆ เป็นภาษาไทย

### รายละเอียดการเปลี่ยนแปลง

**1. อัปเดต `MenuItem` type (`src/lib/menu-types.ts`)**
- เพิ่ม `original_name?: string` — ชื่อภาษาต้นฉบับ
- เพิ่ม `description?: string` — คำอธิบายเบื้องต้นภาษาไทย
- เพิ่ม `textures?: string[]` — เทคเจอร์หลักของจาน (เช่น ["กรอบ", "ฉ่ำ"])

**2. อัปเดต `scan-menu` edge function**
- เปลี่ยน system prompt จาก "Thai menu OCR expert" เป็น "Multilingual menu OCR expert" ที่รองรับทุกภาษา
- สั่งให้ AI แปลชื่อเมนูเป็นไทยเสมอ โดยเก็บชื่อต้นฉบับไว้ใน `original_name`
- เพิ่ม field ใน tool schema:
  - `original_name` (string) — ชื่อตามเมนูจริง
  - `description` (string) — คำอธิบายสั้นๆ ภาษาไทย (ส่วนผสมหลัก, วิธีปรุง)
  - `textures` (array of string) — เทคเจอร์หลัก เช่น กรอบ, นุ่ม, เหนียว, ซอสเข้มข้น

**3. อัปเดต UI การ์ดเมนูใน `MenuCardList` / Card components**
- แสดง `original_name` เป็นข้อความรองใต้ชื่อไทย (ถ้ามี)
- แสดง `description` เป็นบรรทัดสั้นใต้ราคา
- แสดง `textures` เป็น pill tags สีกลางบนการ์ด

**4. อัปเดต `StoreRegistration.tsx`**
- ส่ง `original_name`, `description`, `textures` จาก AI response เข้า MenuItem state
- บันทึกลง `menu_items` table (ต้องเพิ่ม columns)

**5. Database migration**
- เพิ่ม columns ใน `menu_items`:
  - `original_name TEXT` (nullable)
  - `description TEXT` (nullable)  
  - `textures TEXT[]` (nullable, default '{}')

### ตัวอย่าง AI Output

เมนูญี่ปุ่น "とんかつ定食 ¥1200" จะถูกแปลงเป็น:
```text
name: "ทงคัตสึเซ็ต"
original_name: "とんかつ定食"
price: 1200
description: "หมูชุบเกล็ดขนมปังทอด เสิร์ฟพร้อมข้าว ซุปมิโสะ และสลัดกะหล่ำ"
textures: ["กรอบ", "ฉ่ำ", "นุ่ม"]
type: "standard"
```

