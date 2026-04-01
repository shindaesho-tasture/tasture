

## แผน: จัดกลุ่มขั้นตอนรีวิวตามเมนู (Per-Item Flow)

### ปัญหาปัจจุบัน
ขั้นตอนรีวิวจัดแบบ **แยกตามประเภท**: Dish DNA ทุกเมนูก่อน → Sensory ทุกเมนู → Texture ทุกเมนู ทำให้ผู้ใช้ต้องสลับไปมาระหว่างเมนู

### สิ่งที่จะเปลี่ยน
จัดใหม่เป็น **per-item**: สำหรับแต่ละเมนู ทำ Dish DNA → Texture → Sensory (รสชาติ) ต่อเนื่องกันก่อนไปเมนูถัดไป

**ลำดับใหม่:**
```text
store-review → [เมนู 1: dish-dna → texture → sensory] → [เมนู 2: dish-dna → texture → sensory] → ... → results
```

### ไฟล์ที่แก้ไข
**`src/pages/PostOrderReview.tsx`** — แก้ `useMemo` ที่สร้าง `steps` (บรรทัด 128-141)

เปลี่ยนจาก:
```ts
items.forEach(item => s.push({ type: "dish-dna", ... }));
items.forEach(item => s.push({ type: "sensory", ... }));
items.forEach(item => s.push({ type: "texture", ... }));
```

เป็น:
```ts
items.forEach(item => {
  s.push({ type: "dish-dna", ...item });
  s.push({ type: "texture", ...item });
  s.push({ type: "sensory", ...item });
});
```

แค่นี้ — ส่วน render/logic อื่นๆ ใช้ `step.type` + `step.menuItemId` อยู่แล้ว ไม่ต้องแก้เพิ่ม

