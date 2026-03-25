/**
 * Classifies sensory tags into texture, aroma, or mouthfeel categories.
 * Returns categorized tags with appropriate emoji icons.
 */

export type SensoryCategory = "texture" | "aroma" | "mouthfeel";

export interface ClassifiedTag {
  label: string;
  category: SensoryCategory;
  icon: string; // 🫧 texture, 👃 aroma, 👅 mouthfeel
}

// Keywords that indicate AROMA (กลิ่น)
const AROMA_KEYWORDS = [
  "กลิ่น", "หอม", "ฟุ้ง", "อโรมา", "aroma", "fragran", "scent", "smoky", "ควัน",
  "สมุนไพร", "herbal", "กระเทียม", "garlic", "เนย", "butter", "ทะเล", "briny",
  "oceanic", "truffle", "เครื่องเทศ", "spice", "五香", "香", "出汁", "고소",
  "herb", "floral", "ดอกไม้", "กะปิ", "น้ำปลา", "ใบมะกรูด", "ตะไคร้",
  "lemongrass", "basil", "โหระพา", "กระเพรา", "earthy", "nutty",
  "镬气", "wok", "药膳", "roast", "คั่ว",
];

// Keywords that indicate MOUTHFEEL / sensation (สัมผัสในปาก)
const MOUTHFEEL_KEYWORDS = [
  "เผ็ดชา", "ซ่า", "แสบ", "ชุ่ม", "มัน", "oily", "rich", "numbing", "麻",
  "tingling", "ละลาย", "melt", "เข้มข้น", "ข้น", "creamy", "ครีมมี่",
  "สัมผัส", "ลื่น", "silky", "velvety", "얼큰", "감칠맛", "umami",
  "อูมามิ", "กลมกล่อม", "เปรี้ยวแซ่บ", "แซ่บ", "ร้อน", "เย็น",
  "refreshing", "ชุ่มคอ", "coating", "ฝาด", "astringent",
  "warming", "cooling", "เผ็ด", "spicy", "辣",
];

/**
 * Classify a single sensory tag string into a category.
 */
export function classifyTag(tag: string): ClassifiedTag {
  const lower = tag.toLowerCase();

  // Check aroma keywords
  for (const kw of AROMA_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return { label: tag, category: "aroma", icon: "👃" };
    }
  }

  // Check mouthfeel keywords
  for (const kw of MOUTHFEEL_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return { label: tag, category: "mouthfeel", icon: "👅" };
    }
  }

  // Default: texture
  return { label: tag, category: "texture", icon: "🫧" };
}

/**
 * Classify an array of sensory tags and group them by category.
 */
export function classifyTags(tags: string[]): ClassifiedTag[] {
  return tags.map(classifyTag);
}

/** Category display config */
export const CATEGORY_CONFIG: Record<SensoryCategory, { icon: string; color: string }> = {
  texture: { icon: "🫧", color: "bg-secondary" },
  aroma: { icon: "👃", color: "bg-amber-500/15" },
  mouthfeel: { icon: "👅", color: "bg-rose-500/15" },
};
