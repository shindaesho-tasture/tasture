import { getScoreTier, type ScoreTier } from "@/lib/categories";

export interface MetricScore {
  id: string;
  label: string;
  icon: string;
  score: number; // weighted avg -2.0 to +2.0
  reviewCount: number;
  // The contextual suffix from the options array
  positiveLabel: string; // +2 label
  neutralLabel: string;  // 0 label
  negativeLabel: string; // -2 label
}

export interface ResultCardData {
  id: string;
  name: string;
  categoryIcon: string;
  categoryLabel: string;
  imageUrl?: string;
  metrics: MetricScore[];
}

/**
 * Calculate opacity based on review count (n).
 * n >= 100 → 1.0 (solid)
 * n < 10  → 0.2 (faded)
 * 10–100  → linear interpolation
 */
export function getIntensityOpacity(reviewCount: number): number {
  if (reviewCount >= 100) return 1.0;
  if (reviewCount < 5) return 0.45; // Minimum opacity for readability on white
  if (reviewCount < 10) return 0.45 + ((reviewCount - 5) / 5) * 0.1;
  return 0.55 + ((Math.min(reviewCount, 100) - 10) / 90) * 0.45;
}

/**
 * Get score suffix label based on score value
 */
export function getScoreSuffix(metric: MetricScore): string {
  if (metric.score >= 1.5) return metric.positiveLabel;
  if (metric.score <= -1.5) return metric.negativeLabel;
  if (metric.score >= -0.4 && metric.score <= 0.4) return metric.neutralLabel;
  if (metric.score > 0) return metric.positiveLabel;
  return metric.negativeLabel;
}

/**
 * Select top 4 tags prioritized by extremity and intensity
 */
export function selectTopTags(metrics: MetricScore[], maxTags = 4): MetricScore[] {
  return [...metrics]
    .sort((a, b) => {
      // Sort by absolute score (extremity) descending, then by review count
      const absA = Math.abs(a.score);
      const absB = Math.abs(b.score);
      if (absB !== absA) return absB - absA;
      return b.reviewCount - a.reviewCount;
    })
    .slice(0, maxTags);
}

// Demo data for showcasing the Result Card
export const demoResults: ResultCardData[] = [
  {
    id: "demo-1",
    name: "ครัวคุณแม่จู",
    categoryIcon: "🍜",
    categoryLabel: "Everyday A-la-carte",
    metrics: [
      { id: "parking", label: "ที่จอดรถ", icon: "🅿️", score: 1.8, reviewCount: 142, positiveLabel: "จอดง่ายมาก", neutralLabel: "มาตรฐาน", negativeLabel: "ไม่มีที่จอด" },
      { id: "restroom", label: "ห้องน้ำ", icon: "🚻", score: -1.6, reviewCount: 89, positiveLabel: "สะอาดกริบ", neutralLabel: "มาตรฐาน", negativeLabel: "ไม่โอเคเลย" },
      { id: "table-clean", label: "ความสะอาดโต๊ะ", icon: "✨", score: 0.2, reviewCount: 56, positiveLabel: "สะอาดกริบ", neutralLabel: "มาตรฐาน", negativeLabel: "สกปรกมาก" },
      { id: "wait-time", label: "ระยะเวลารอ", icon: "⏱️", score: 1.2, reviewCount: 120, positiveLabel: "ไวมาก", neutralLabel: "ปกติ", negativeLabel: "ช้ามาก" },
      { id: "ambiance", label: "บรรยากาศ", icon: "🌿", score: -0.8, reviewCount: 34, positiveLabel: "นั่งสบายมาก", neutralLabel: "ทั่วไป", negativeLabel: "แออัด/ควันเยอะ" },
    ],
  },
  {
    id: "demo-2",
    name: "Sushi Masa Omakase",
    categoryIcon: "🍣",
    categoryLabel: "Omakase & Chef's Table",
    metrics: [
      { id: "parking", label: "ที่จอดรถ", icon: "🅿️", score: 0.1, reviewCount: 8, positiveLabel: "จอดสะดวกมาก", neutralLabel: "มาตรฐาน", negativeLabel: "จอดลำบาก" },
      { id: "restroom", label: "ห้องน้ำ", icon: "🚻", score: 1.9, reviewCount: 45, positiveLabel: "สะอาดกริบ", neutralLabel: "มาตรฐาน", negativeLabel: "ไม่โอเค" },
      { id: "chef-charm", label: "เสน่ห์เชฟ", icon: "👨‍🍳", score: 2.0, reviewCount: 112, positiveLabel: "เชฟระดับมาสเตอร์", neutralLabel: "มาตรฐาน", negativeLabel: "เชฟไม่สนใจแขก" },
      { id: "ingredient", label: "คุณภาพวัตถุดิบ", icon: "🐟", score: 1.7, reviewCount: 98, positiveLabel: "หายากระดับประมูล", neutralLabel: "มาตรฐาน", negativeLabel: "ไม่สมราคา" },
      { id: "exclusive", label: "ความเอ็กซ์คลูซีฟ", icon: "💎", score: 1.5, reviewCount: 67, positiveLabel: "เอ็กซ์คลูซีฟมาก", neutralLabel: "มาตรฐาน", negativeLabel: "ไม่เป็นส่วนตัว" },
      { id: "pacing", label: "จังหวะการเสิร์ฟ", icon: "🎼", score: -1.8, reviewCount: 15, positiveLabel: "จังหวะไร้ที่ติ", neutralLabel: "ปกติ", negativeLabel: "ขาดตอน/ช้า" },
    ],
  },
  {
    id: "demo-3",
    name: "Bar Vogue Rooftop",
    categoryIcon: "🍸",
    categoryLabel: "Bar & Nightlife",
    metrics: [
      { id: "parking", label: "ที่จอดรถ & Valet", icon: "🅿️", score: 1.6, reviewCount: 200, positiveLabel: "จอดสะดวก/มี Valet", neutralLabel: "มาตรฐาน", negativeLabel: "จอดลำบาก" },
      { id: "restroom", label: "ห้องน้ำ", icon: "🚻", score: 0.3, reviewCount: 150, positiveLabel: "สะอาดกริบตลอดคืน", neutralLabel: "มาตรฐาน", negativeLabel: "ค่อนข้างแย่" },
      { id: "ventilation", label: "ระบบระบายอากาศ", icon: "🌬️", score: -1.9, reviewCount: 180, positiveLabel: "อากาศสดชื่นไร้กลิ่นควัน", neutralLabel: "มาตรฐาน", negativeLabel: "ควันอบอวล/อึดอัด" },
      { id: "noise", label: "ระดับเสียง", icon: "🔊", score: -0.5, reviewCount: 130, positiveLabel: "เพลงดี/คุยงานรู้เรื่อง", neutralLabel: "ทั่วไป", negativeLabel: "เสียงดังหูอื้อ" },
      { id: "density", label: "ความแน่นของโต๊ะ", icon: "🪑", score: 0.0, reviewCount: 5, positiveLabel: "พื้นที่ส่วนตัวสูงมาก", neutralLabel: "มาตรฐาน", negativeLabel: "เบียดเสียดอึดอัด" },
      { id: "bartender", label: "ความเชี่ยวชาญบาร์เทนเดอร์", icon: "🧑‍🍳", score: 1.4, reviewCount: 95, positiveLabel: "ระดับมาสเตอร์", neutralLabel: "มาตรฐาน", negativeLabel: "ขาดประสบการณ์" },
    ],
  },
];
