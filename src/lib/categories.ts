export interface CategoryMetric {
  id: string;
  label: string;
  icon: string;
  options: [string, string, string]; // [+2 label, 0 label, -2 label]
  smartGate?: {
    question: string;
    subMetrics: CategoryMetric[];
  };
}

export interface Category {
  id: string;
  label: string;
  labelTh: string;
  icon: string;
  description: string;
  metrics: CategoryMetric[];
}

export const categories: Category[] = [
  {
    id: "everyday",
    label: "Everyday A-la-carte",
    labelTh: "อาหารตามสั่งทั่วไป",
    icon: "🍜",
    description: "ร้านอาหารตามสั่ง ข้าวราดแกง อาหารจานเดียว",
    metrics: [
      { id: "parking", label: "ที่จอดรถ", icon: "🅿️", options: ["จอดง่ายมาก", "มาตรฐาน", "ไม่มีที่จอด"] },
      { id: "restroom", label: "ห้องน้ำ", icon: "🚻", options: ["สะอาดกริบ", "มาตรฐาน", "ไม่โอเคเลย"] },
      { id: "table-clean", label: "ความสะอาดโต๊ะ", icon: "✨", options: ["สะอาดกริบ", "มาตรฐาน", "สกปรกมาก"] },
      { id: "wait-time", label: "ระยะเวลารอ", icon: "⏱️", options: ["ไวมาก", "ปกติ", "ช้ามาก"] },
      { id: "ambiance", label: "บรรยากาศ", icon: "🌿", options: ["นั่งสบายมาก", "ทั่วไป", "แออัด/ควันเยอะ"] },
    ],
  },
  {
    id: "street-food",
    label: "Street Food & Legend",
    labelTh: "สตรีทฟู้ดและร้านตำนาน",
    icon: "🔥",
    description: "ร้านริมทาง ของกินตำนาน หาบเร่แผงลอย",
    metrics: [
      { id: "parking", label: "ที่จอดรถ", icon: "🅿️", options: ["จอดง่ายมาก", "มาตรฐาน", "ไม่มีที่จอด"] },
      { id: "queue", label: "การจัดคิว", icon: "🎫", options: ["มืออาชีพมาก", "ปกติ", "มั่วซั่ว"] },
      { id: "consistency", label: "ความคงเส้นคงวา", icon: "🎯", options: ["รสมือแม่นยำ", "มาตรฐาน", "รสชาติไม่นิ่ง"] },
      { id: "charm", label: "เสน่ห์เฉพาะตัว", icon: "💫", options: ["หนึ่งเดียวในโลก", "ทั่วไป", "ไร้เสน่ห์"] },
      { id: "value", label: "ความคุ้มค่า", icon: "💰", options: ["คุ้มค่าที่สุด", "สมราคา", "ไม่คุ้มราคา"] },
    ],
  },
  {
    id: "cafe",
    label: "Cafe & Aesthetic",
    labelTh: "คาเฟ่และสุนทรียภาพ",
    icon: "☕",
    description: "คาเฟ่ ร้านกาแฟ พื้นที่สร้างสรรค์",
    metrics: [
      { id: "parking", label: "ที่จอดรถ", icon: "🅿️", options: ["จอดสะดวกมาก", "มาตรฐาน", "จอดลำบาก"] },
      { id: "photo-spot", label: "มุมถ่ายรูป", icon: "📸", options: ["สวยทุกมุม", "มาตรฐาน", "ไม่ตรงปก"] },
      { id: "lighting", label: "แสงและสี", icon: "💡", options: ["แสงนวลถ่ายรูปสวย", "มาตรฐาน", "แสงไม่สวย"] },
      { id: "noise", label: "ระดับเสียง", icon: "🔇", options: ["เงียบสงบ", "ทั่วไป", "เสียงดังรบกวน"] },
    ],
  },
  {
    id: "bistro",
    label: "Bistro & Restaurant",
    labelTh: "บิสโทรและร้านอาหาร",
    icon: "🍽️",
    description: "ร้านอาหารนั่งทาน บิสโทร ครัวสร้างสรรค์",
    metrics: [
      { id: "parking", label: "ที่จอดรถ", icon: "🅿️", options: ["จอดสะดวกมาก", "มาตรฐาน", "จอดลำบาก"] },
      { id: "restroom", label: "ห้องน้ำ", icon: "🚻", options: ["สะอาดกริบ", "มาตรฐาน", "ค่อนข้างแย่"] },
      { id: "utensil-clean", label: "ความสะอาดอุปกรณ์", icon: "🍴", options: ["สะอาดกริบไร้คราบ", "มาตรฐาน", "มีคราบ/ไม่สะอาด"] },
      { id: "menu-variety", label: "ความหลากหลายเมนู", icon: "📋", options: ["เมนูเยอะมาก", "มาตรฐาน", "ตัวเลือกน้อย"] },
      { id: "service", label: "คุณภาพบริการ", icon: "🤵", options: ["บริการดีเยี่ยม", "มาตรฐาน", "บริการแย่"] },
      { id: "ambiance", label: "บรรยากาศ", icon: "🌿", options: ["นั่งสบายหรูหรา", "มาตรฐาน", "อึดอัด/โต๊ะชิด"] },
    ],
  },
  {
    id: "fine-dining",
    label: "Fine Dining & Luxury",
    labelTh: "เลิศรสและงานบริการ",
    icon: "👑",
    description: "ไฟน์ไดนิ่ง ร้านระดับพรีเมียม ประสบการณ์หรูหรา",
    metrics: [
      { id: "valet", label: "บริการ Valet & ที่จอดรถ", icon: "🚗", options: ["รวดเร็วสง่างาม", "มาตรฐาน", "ไม่มีคนดูแล"] },
      { id: "restroom", label: "ห้องน้ำ (ความหรูหรา)", icon: "🚻", options: ["หรูหราสะอาดกริบ", "มาตรฐาน", "ต่ำกว่ามาตรฐานลักชูรี"] },
      { id: "welcome", label: "การต้อนรับ", icon: "🤵", options: ["ระดับคอนเชียร์จ", "มาตรฐาน", "ขาดมืออาชีพ"] },
      { id: "privacy", label: "ความเป็นส่วนตัว", icon: "🔒", options: ["ส่วนตัวสูงมาก", "มาตรฐาน", "เสียงดัง/โต๊ะชิด"] },
      { id: "reservation", label: "การจอง", icon: "📅", options: ["จองง่ายสะดวก", "มาตรฐาน", "ยากระดับตำนาน"] },
      { id: "acoustic", label: "บรรยากาศ (Acoustic/Lighting)", icon: "🎵", options: ["สุนทรียภาพระดับมาสเตอร์พีซ", "มาตรฐาน", "ไม่รื่นรมย์"] },
    ],
  },
  {
    id: "omakase",
    label: "Omakase & Chef's Table",
    labelTh: "โอมากาเสะและเชฟส์เทเบิล",
    icon: "🍣",
    description: "โอมากาเสะ เชฟส์เทเบิล ประสบการณ์เฉพาะตัว",
    metrics: [
      { id: "parking", label: "ที่จอดรถ", icon: "🅿️", options: ["จอดสะดวกมาก", "มาตรฐาน", "จอดลำบาก"] },
      { id: "restroom", label: "ห้องน้ำ", icon: "🚻", options: ["สะอาดกริบ", "มาตรฐาน", "ไม่โอเค"] },
      { id: "chef-charm", label: "เสน่ห์เชฟ", icon: "👨‍🍳", options: ["เชฟระดับมาสเตอร์", "มาตรฐาน", "เชฟไม่สนใจแขก"] },
      { id: "ingredient", label: "คุณภาพวัตถุดิบ", icon: "🐟", options: ["หายากระดับประมูล", "มาตรฐาน", "ไม่สมราคา"] },
      { id: "exclusive", label: "ความเอ็กซ์คลูซีฟ", icon: "💎", options: ["เอ็กซ์คลูซีฟมาก", "มาตรฐาน", "ไม่เป็นส่วนตัว"] },
      { id: "pacing", label: "จังหวะการเสิร์ฟ", icon: "🎼", options: ["จังหวะไร้ที่ติ", "ปกติ", "ขาดตอน/ช้า"] },
    ],
  },
  {
    id: "bar",
    label: "Bar & Nightlife",
    labelTh: "บาร์และจังหวะยามค่ำคืน",
    icon: "🍸",
    description: "บาร์ ค็อกเทลบาร์ ไนท์ไลฟ์",
    metrics: [
      { id: "parking", label: "ที่จอดรถ & Valet", icon: "🅿️", options: ["จอดสะดวก/มี Valet", "มาตรฐาน", "จอดลำบาก"] },
      { id: "restroom", label: "ห้องน้ำ", icon: "🚻", options: ["สะอาดกริบตลอดคืน", "มาตรฐาน", "ค่อนข้างแย่"] },
      { id: "ventilation", label: "ระบบระบายอากาศ", icon: "🌬️", options: ["อากาศสดชื่นไร้กลิ่นควัน", "มาตรฐาน", "ควันอบอวล/อึดอัด"] },
      { id: "noise", label: "ระดับเสียง", icon: "🔊", options: ["เพลงดี/คุยงานรู้เรื่อง", "ทั่วไป", "เสียงดังหูอื้อ"] },
      { id: "density", label: "ความแน่นของโต๊ะ", icon: "🪑", options: ["พื้นที่ส่วนตัวสูงมาก", "มาตรฐาน", "เบียดเสียดอึดอัด"] },
      { id: "bartender", label: "ความเชี่ยวชาญบาร์เทนเดอร์", icon: "🧑‍🍳", options: ["ระดับมาสเตอร์", "มาตรฐาน", "ขาดประสบการณ์"] },
    ],
  },
];
