import type { AppLanguage } from "./language-context";

/** All UI translations keyed by dot-path */
const translations: Record<string, Record<AppLanguage, string>> = {
  // ─── Bottom Nav ───
  "nav.home": { th: "หน้าแรก", en: "Home", ja: "ホーム", zh: "首页", ko: "홈" },
  "nav.discover": { th: "ค้นหา", en: "Discover", ja: "発見", zh: "发现", ko: "탐색" },
  "nav.post": { th: "โพส", en: "Post", ja: "投稿", zh: "发布", ko: "포스트" },
  "nav.orders": { th: "รายการ", en: "Orders", ja: "注文", zh: "订单", ko: "주문" },
  "nav.profile": { th: "โปรไฟล์", en: "Profile", ja: "プロフ", zh: "我的", ko: "프로필" },

  // ─── Menu Feedback ───
  "feedback.title": { th: "ฟีดแบคเมนู", en: "Menu Feedback", ja: "メニュー評価", zh: "菜单反馈", ko: "메뉴 피드백" },
  "feedback.subtitle": { th: "menu feedback", en: "menu feedback", ja: "menu feedback", zh: "menu feedback", ko: "menu feedback" },
  "feedback.tasteSatisfaction": { th: "ความพอใจรสชาติ", en: "Taste Satisfaction", ja: "味の満足度", zh: "口味满意度", ko: "맛 만족도" },
  "feedback.perfect": { th: "รสสมบูรณ์แบบ", en: "Perfect Taste", ja: "完璧な味", zh: "完美口味", ko: "완벽한 맛" },
  "feedback.ok": { th: "ธรรมดาพอกินได้", en: "Average, OK", ja: "普通、まあまあ", zh: "一般，还行", ko: "보통, 괜찮음" },
  "feedback.bad": { th: "ไม่ถูกปาก", en: "Not My Taste", ja: "口に合わない", zh: "不合口味", ko: "입맛에 안 맞음" },
  "feedback.sensory": { th: "Sensory Feedback", en: "Sensory Feedback", ja: "味覚フィードバック", zh: "感官反馈", ko: "감각 피드백" },
  "feedback.analyzing": { th: "AI กำลังวิเคราะห์แกนรสชาติ...", en: "AI analyzing taste axes...", ja: "AIが味覚軸を分析中...", zh: "AI正在分析味觉轴...", ko: "AI가 맛 축을 분석 중..." },
  "feedback.balanceScore": { th: "คะแนนสมดุลรวม", en: "Overall Balance Score", ja: "バランススコア", zh: "综合平衡分", ko: "종합 균형 점수" },
  "feedback.cannotAnalyze": { th: "ไม่สามารถวิเคราะห์ได้", en: "Unable to analyze", ja: "分析できません", zh: "无法分析", ko: "분석할 수 없습니다" },
  "feedback.persons": { th: "คน", en: "reviews", ja: "人", zh: "人", ko: "명" },
  "feedback.noData": { th: "ยังไม่มี", en: "No data", ja: "未評価", zh: "暂无", ko: "없음" },
  "feedback.special": { th: "พิเศษ", en: "Special", ja: "特別", zh: "特价", ko: "특별" },
  "feedback.items": { th: "รายการ", en: "items", ja: "品", zh: "项", ko: "개" },
  "feedback.rateGuide": {
    th: "กดเลือก 😔 😐 🤩 เพื่อให้คะแนนแต่ละเมนู",
    en: "Tap 😔 😐 🤩 to rate each menu item",
    ja: "😔 😐 🤩 をタップして各メニューを評価",
    zh: "点击 😔 😐 🤩 为每道菜评分",
    ko: "😔 😐 🤩 를 눌러 각 메뉴를 평가하세요",
  },
  "feedback.avgNote": {
    th: "ค่าเฉลี่ยจากทุกคนจะแสดงที่วงกลมด้านขวา",
    en: "Community average shown in the circle on the right",
    ja: "みんなの平均は右の円に表示",
    zh: "所有人的平均分显示在右侧圆圈中",
    ko: "전체 평균이 오른쪽 원에 표시됩니다",
  },
  "feedback.saved": { th: "บันทึกสำเร็จ", en: "Saved Successfully", ja: "保存しました", zh: "保存成功", ko: "저장 완료" },
  "feedback.savedDesc": { th: "ให้คะแนน {count} เมนู", en: "Rated {count} items", ja: "{count}品を評価", zh: "已评价{count}道菜", ko: "{count}개 평가 완료" },
  "feedback.saveFailed": { th: "บันทึกไม่สำเร็จ", en: "Save Failed", ja: "保存失敗", zh: "保存失败", ko: "저장 실패" },
  "feedback.loading": { th: "กำลังโหลดเมนู", en: "Loading menu", ja: "メニュー読み込み中", zh: "正在加载菜单", ko: "메뉴 로딩 중" },
  "feedback.noMenu": { th: "ยังไม่มีเมนูในร้านนี้", en: "No menu items yet", ja: "まだメニューがありません", zh: "暂无菜单项", ko: "아직 메뉴가 없습니다" },
  "feedback.noMenuDesc": {
    th: "เมนูจะปรากฏหลังจากสแกนป้ายเมนู",
    en: "Menu items appear after scanning the menu",
    ja: "メニューをスキャンすると表示されます",
    zh: "扫描菜单后将显示菜品",
    ko: "메뉴를 스캔하면 표시됩니다",
  },
  "feedback.submit": { th: "บันทึก", en: "Save", ja: "保存", zh: "保存", ko: "저장" },
  "feedback.changes": { th: "เปลี่ยน {count} รายการ", en: "{count} changes", ja: "{count}件変更", zh: "{count}项变更", ko: "{count}개 변경" },

  // ─── Review Gate ───
  "gate.previousReview": { th: "คุณเคยรีวิวเมนูร้านนี้แล้ว", en: "You've reviewed this menu before", ja: "このメニューは評価済みです", zh: "您已评价过此菜单", ko: "이 메뉴를 이미 평가했습니다" },
  "gate.changed": { th: "รสชาติเมนูเปลี่ยนไปหรือเปล่า?", en: "Has the taste changed?", ja: "味は変わりましたか？", zh: "口味有变化吗？", ko: "맛이 변했나요?" },
  "gate.previousScores": { th: "คะแนนเดิมที่เคยให้", en: "Previous Scores", ja: "以前のスコア", zh: "之前的评分", ko: "이전 점수" },
  "gate.same": { th: "ยังเหมือนเดิม", en: "Same as before", ja: "前と同じ", zh: "和以前一样", ko: "이전과 같음" },
  "gate.sameDesc": { th: "บันทึกคะแนนเดิมอีกครั้ง", en: "Keep previous scores", ja: "前回のスコアを維持", zh: "保持之前的评分", ko: "이전 점수 유지" },
  "gate.different": { th: "เปลี่ยนไป", en: "Changed", ja: "変わった", zh: "有变化", ko: "변경됨" },
  "gate.differentDesc": { th: "รีวิวเมนูใหม่", en: "Review again", ja: "再評価する", zh: "重新评价", ko: "다시 평가" },
  "gate.confirmedSame": { th: "ยืนยันคะแนนเดิม {count} เมนู", en: "Confirmed {count} previous scores", ja: "以前のスコア{count}件を確認", zh: "确认{count}项之前的评分", ko: "이전 점수 {count}개 확인" },

  // ─── Dish Detail Sheet ───
  "detail.reviews": { th: "รีวิว", en: "reviews", ja: "レビュー", zh: "评价", ko: "리뷰" },
  "detail.balance": { th: "ระดับความสมดุล", en: "Balance Level", ja: "バランスレベル", zh: "平衡水平", ko: "균형 수준" },
  "detail.popularTextures": { th: "เทคเจอร์ยอดนิยม", en: "Popular Textures", ja: "人気のテクスチャー", zh: "热门口感", ko: "인기 식감" },
  "detail.mySentiment": { th: "ความรู้สึกของฉัน", en: "My Sentiment", ja: "私の感想", zh: "我的感受", ko: "내 감상" },
  "detail.consistency": { th: "ความคงที่", en: "Consistency", ja: "安定性", zh: "稳定性", ko: "일관성" },
  "detail.consistencyGood": { th: "เสน่ห์คงเดิม", en: "Consistently Good", ja: "安定の美味しさ", zh: "品质稳定", ko: "변함없는 맛" },
  "detail.consistencyBad": { th: "รสชาติมีความแปรปรวน", en: "Taste Varies", ja: "味にばらつきあり", zh: "口味不稳定", ko: "맛이 들쭉날쭉" },
  "detail.emeraldSeal": { th: "มรกตรับรอง", en: "Emerald Certified", ja: "エメラルド認定", zh: "翡翠认证", ko: "에메랄드 인증" },
  "detail.userPhotos": { th: "รูปจากผู้ใช้", en: "User Photos", ja: "ユーザー写真", zh: "用户照片", ko: "사용자 사진" },
  "detail.user": { th: "ผู้ใช้", en: "User", ja: "ユーザー", zh: "用户", ko: "사용자" },
  "detail.loadingDesc": { th: "กำลังเขียนคำบรรยาย...", en: "Writing description...", ja: "説明を作成中...", zh: "正在撰写描述...", ko: "설명 작성 중..." },

  // ─── Menu Sections ───
  "section.noodle": { th: "ก๋วยเตี๋ยว", en: "Noodles", ja: "麺類", zh: "面条", ko: "면류" },
  "section.dualPrice": { th: "ราคาคู่", en: "Dual Price", ja: "二重価格", zh: "双价格", ko: "이중 가격" },
  "section.standard": { th: "เมนูทั่วไป", en: "General Menu", ja: "一般メニュー", zh: "普通菜品", ko: "일반 메뉴" },

  // ─── Menu Cards ───
  "card.noodleType": { th: "เส้น", en: "Noodle", ja: "麺", zh: "面", ko: "면" },
  "card.style": { th: "สไตล์", en: "Style", ja: "スタイル", zh: "风格", ko: "스타일" },
  "card.topping": { th: "ท็อปปิ้ง", en: "Toppings", ja: "トッピング", zh: "配料", ko: "토핑" },
  "card.rate": { th: "ให้คะแนน", en: "Rate", ja: "評価", zh: "评分", ko: "평가" },
  "card.fromUsers": { th: "จากผู้ใช้", en: "from users", ja: "ユーザーより", zh: "来自用户", ko: "사용자 제공" },
  "card.reviewCount": { th: "รีวิว", en: "reviews", ja: "レビュー", zh: "评价", ko: "리뷰" },

  // ─── Scanning ───
  "scan.scanning": { th: "กำลังสแกนเมนู...", en: "Scanning menu...", ja: "メニューをスキャン中...", zh: "正在扫描菜单...", ko: "메뉴 스캔 중..." },

  // ─── Post Prompt ───
  "post.sharePrompt": { th: "แชร์รูปอาหาร?", en: "Share a food photo?", ja: "料理写真をシェア?", zh: "分享美食照片？", ko: "음식 사진을 공유할까요?" },
  "post.shareDesc": { th: "ถ่ายรูปอาหารแล้วโพสลงฟีด", en: "Take a photo and post to feed", ja: "写真を撮ってフィードに投稿", zh: "拍照并发布到动态", ko: "사진을 찍어 피드에 게시" },
  "post.share": { th: "ถ่ายรูป & โพส", en: "Photo & Post", ja: "撮影＆投稿", zh: "拍照发布", ko: "사진 & 게시" },
  "post.skip": { th: "ข้ามไป", en: "Skip", ja: "スキップ", zh: "跳过", ko: "건너뛰기" },

  // ─── Common ───
  "common.save": { th: "บันทึก", en: "Save", ja: "保存", zh: "保存", ko: "저장" },
  "common.cancel": { th: "ยกเลิก", en: "Cancel", ja: "キャンセル", zh: "取消", ko: "취소" },
  "common.back": { th: "กลับ", en: "Back", ja: "戻る", zh: "返回", ko: "뒤로" },
  "common.next": { th: "ถัดไป", en: "Next", ja: "次へ", zh: "下一步", ko: "다음" },
  "common.confirm": { th: "ยืนยัน", en: "Confirm", ja: "確認", zh: "确认", ko: "확인" },
  "common.delete": { th: "ลบ", en: "Delete", ja: "削除", zh: "删除", ko: "삭제" },
  "common.edit": { th: "แก้ไข", en: "Edit", ja: "編集", zh: "编辑", ko: "편집" },
  "common.search": { th: "ค้นหา", en: "Search", ja: "検索", zh: "搜索", ko: "검색" },
  "common.login": { th: "เข้าสู่ระบบ", en: "Log In", ja: "ログイン", zh: "登录", ko: "로그인" },
  "common.signup": { th: "สมัครสมาชิก", en: "Sign Up", ja: "登録", zh: "注册", ko: "회원가입" },
  "common.popular": { th: "ยอดนิยม", en: "Popular", ja: "人気", zh: "热门", ko: "인기" },
  "common.recommended": { th: "แนะนำ", en: "Recommended", ja: "おすすめ", zh: "推荐", ko: "추천" },
  "common.highlyRecommended": { th: "แนะนำสุด", en: "Top Pick", ja: "最もおすすめ", zh: "强烈推荐", ko: "강력 추천" },
  "common.discount": { th: "ลด", en: "Off", ja: "割引", zh: "折扣", ko: "할인" },
};

/**
 * Get translated string by key for a given language.
 * Supports placeholder replacement: t("key", lang, { count: 5 }) → replaces {count} with 5
 */
export function t(key: string, lang: AppLanguage, params?: Record<string, string | number>): string {
  const entry = translations[key];
  if (!entry) return key;
  let text = entry[lang] || entry["th"] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

export default translations;
