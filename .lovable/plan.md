

## แผน: เพิ่มระบบเลือกภาษาในแอพ + ปรับ AI ให้อธิบายเมนูตามวัฒนธรรมภาษาที่เลือก

### แนวคิด

ผู้ใช้เลือกภาษาหลักในแอพ (เช่น ไทย, อังกฤษ, ญี่ปุ่น, จีน, เกาหลี) จากนั้นเมื่อสแกนเมนู AI จะ:
1. สวมบทบาทเป็นผู้เชี่ยวชาญอาหารของวัฒนธรรมเมนูนั้น
2. อธิบายเมนูเป็นภาษาที่ผู้ใช้เลือก ให้คนที่ไม่รู้จักเมนูเข้าใจได้ทันที
3. ใช้การเปรียบเทียบกับอาหารที่คนในวัฒนธรรมภาษานั้นคุ้นเคย

เช่น ถ้าผู้ใช้เลือกภาษาไทย แล้วสแกนเมนูญี่ปุ่น:
- とんかつ → "คล้ายหมูทอดแต่ชุบเกล็ดขนมปังแบบญี่ปุ่น (パン粉) ทอดจนเปลือกกรอบฟู เนื้อในฉ่ำ"

ถ้าผู้ใช้เลือกภาษาอังกฤษ แล้วสแกนเมนูไทย:
- ส้มตำ → "Shredded green papaya salad pounded with chili, lime, fish sauce. Crunchy, spicy, tangy."

### การเปลี่ยนแปลง

**1. สร้าง Language Context (`src/lib/language-context.tsx`)**
- สร้าง React context เก็บภาษาที่เลือก (default: `th`)
- รองรับ: `th`, `en`, `ja`, `zh`, `ko`
- เก็บใน localStorage เพื่อจำค่า
- Provide ผ่าน App.tsx

**2. เพิ่ม Language Selector บนหน้า Profile**
- Dropdown เลือกภาษา พร้อมไอคอนธง/ชื่อภาษา
- บันทึกลง context + localStorage

**3. อัปเดต `StoreRegistration.tsx`**
- ส่ง `language` parameter ไปพร้อมกับ `imageBase64` เมื่อเรียก `scan-menu`

**4. อัปเดต `supabase/functions/scan-menu/index.ts` (หลัก)**
- รับ `language` parameter จาก request body (default: `"th"`)
- ปรับ system prompt ให้:
  - ตรวจจับวัฒนธรรมอาหารจากเมนู แล้วสวมบทเป็นผู้เชี่ยวชาญวัฒนธรรมนั้น
  - อธิบายทุกอย่างเป็นภาษาที่ผู้ใช้เลือก
  - ใช้การเปรียบเทียบกับอาหารที่คนในวัฒนธรรมภาษานั้นรู้จัก เพื่อให้คนที่ไม่เคยกินเมนูนั้นเข้าใจทันที
  - เทคเจอร์ต้องแม่นยำตามมุมมองผู้เชี่ยวชาญ (เช่น もちもち→เหนียวนุ่มเด้ง ไม่ใช่แค่ "นุ่ม")

### ตัวอย่าง Prompt Logic

```text
Step 1: Detect the cuisine culture from the menu (Japanese, Korean, Chinese, Italian, Thai, etc.)
Step 2: Adopt the persona of a culinary expert from that culture.
Step 3: Output ALL text (name translation, description, textures) in the user's chosen language: {language}.
Step 4: Describe each dish so someone unfamiliar can instantly understand — compare to foods familiar in {language}'s culture.

Examples when language=th, menu=Japanese:
- ラーメン → name: "ราเม็ง", description: "บะหมี่ในน้ำซุปกระดูกหมูเข้มข้น คล้ายก๋วยเตี๋ยวแต่เส้นเหนียวนุ่มกว่า", textures: ["เหนียวเด้ง", "ซุปเข้มข้น"]

Examples when language=en, menu=Thai:
- ส้มตำ → name: "Som Tam", description: "Pounded green papaya salad with chili, lime & fish sauce — like a spicy crunchy slaw", textures: ["Crunchy", "Tangy", "Spicy"]
```

### ไฟล์ที่จะแก้ไข/สร้าง

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/lib/language-context.tsx` | **สร้างใหม่** — Language context + provider |
| `src/App.tsx` | Wrap ด้วย LanguageProvider |
| `src/pages/Profile.tsx` | เพิ่ม Language selector dropdown |
| `src/pages/StoreRegistration.tsx` | ส่ง `language` ไปกับ scan-menu |
| `supabase/functions/scan-menu/index.ts` | ปรับ prompt ให้รับ language + สวมบทผู้เชี่ยวชาญ + อธิบายข้ามวัฒนธรรม |

