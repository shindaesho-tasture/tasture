

## แผน: เพิ่มปุ่มปฏิเสธออเดอร์พร้อมเหตุผลใน Popup แจ้งเตือน

### ไฟล์ที่แก้ไข
**`src/pages/KitchenDashboard.tsx`**

### สิ่งที่จะเพิ่ม

1. **State ใหม่**
   - `showRejectDialog: boolean` — เปิด/ปิด dialog เลือกเหตุผล
   - `rejectReason: string` — เหตุผลที่เลือก/พิมพ์

2. **เหตุผลปฏิเสธสำเร็จรูป** (ให้กดเลือกได้เลย)
   - วัตถุดิบหมด
   - ร้านกำลังจะปิด
   - ออเดอร์เยอะเกินไป
   - ช่องพิมพ์เหตุผลอื่น (custom)

3. **ปุ่ม "❌ ปฏิเสธ"** ใน popup ข้างปุ่ม "รับออเดอร์" และ "ปิด"
   - กดแล้วเปิด reject dialog แทนที่จะปฏิเสธทันที

4. **Reject Dialog** (แสดงซ้อนใน popup เดิม)
   - แสดงเหตุผลสำเร็จรูปเป็นปุ่มกดเลือก
   - มี textarea สำหรับเหตุผลอื่น
   - ปุ่ม "ยืนยันปฏิเสธ" → เรียก `updateStatus(orderId, "rejected")` พร้อมบันทึก `rejection_reason` ลง orders table
   - ปุ่ม "ย้อนกลับ" → กลับไป popup เดิม

5. **อัปเดต `updateStatus`** ให้รับ optional `rejection_reason` parameter
   - `await supabase.from("orders").update({ status, rejection_reason, updated_at: ... })`

### Database Migration
- เพิ่มคอลัมน์ `rejection_reason text` ใน `orders` table (nullable)

### ผลลัพธ์
Popup ออเดอร์ใหม่จะมี 3 ปุ่ม: **รับออเดอร์ / ปฏิเสธ / ปิด** โดยกดปฏิเสธจะให้เลือกเหตุผลก่อนยืนยัน

