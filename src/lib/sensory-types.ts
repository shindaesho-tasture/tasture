export interface SensoryAxis {
  name: string;
  icon: string;
  labels: [string, string, string, string, string]; // 5 levels: lacking → excessive
  category?: "taste" | "texture" | "temperature" | "mouthfeel"; // axis category
}

export interface SensoryAnalysis {
  dish_name: string;
  axes: SensoryAxis[];
}

export interface SensoryFeedback {
  axis_name: string;
  axis_icon: string;
  level: 1 | 2 | 3 | 4 | 5; // 1=lacking, 3=perfect, 5=excessive
}

/** Predefined sensory axes for common Thai food dimensions */
export const COMMON_AXES: SensoryAxis[] = [
  { name: "เผ็ด", icon: "🌶️", labels: ["จืดสนิท", "เผ็ดน้อย", "พอดี", "เผ็ดจัด", "ลุกเป็นไฟ"], category: "taste" },
  { name: "หวาน", icon: "🍯", labels: ["ขาดหวาน", "หวานเบา", "พอดี", "หวานมาก", "หวานจัด"], category: "taste" },
  { name: "เค็ม", icon: "🧂", labels: ["จืดมาก", "เค็มน้อย", "พอดี", "เค็มจัด", "เค็มเวอร์"], category: "taste" },
  { name: "เปรี้ยว", icon: "🍋", labels: ["ไม่มีเลย", "อมเปรี้ยว", "พอดี", "เปรี้ยวจัด", "เปรี้ยวจี๊ด"], category: "taste" },
  { name: "อูมามิ", icon: "🍖", labels: ["ขาดรส", "มีเล็กน้อย", "กลมกล่อม", "เข้มข้น", "หนักมาก"], category: "taste" },
  { name: "กรอบ", icon: "🥜", labels: ["นิ่มเละ", "นิ่มหน่อย", "พอดี", "กรอบมาก", "แข็งเกิน"], category: "texture" },
  { name: "เนื้อสัมผัส", icon: "🫧", labels: ["หยาบมาก", "หยาบหน่อย", "เนียนพอดี", "ละเอียด", "ลื่นเกิน"], category: "texture" },
  { name: "ความร้อน", icon: "🔥", labels: ["เย็นชืด", "อุ่นๆ", "พอดี", "ร้อนมาก", "ลวกปาก"], category: "temperature" },
];
