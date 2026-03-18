import { useState } from "react";
import { motion } from "framer-motion";
import type { MenuItem } from "@/lib/menu-types";
import MenuRatingButtons from "./MenuRatingButtons";

interface DualPriceCardProps {
  item: MenuItem;
  onChange: (updated: MenuItem) => void;
}

const DualPriceCard = ({ item, onChange }: DualPriceCardProps) => {
  const [editName, setEditName] = useState(item.name);
  const [editPrice, setEditPrice] = useState(String(item.price));
  const [editPriceSpecial, setEditPriceSpecial] = useState(String(item.price_special || 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-elevated rounded-2xl shadow-luxury p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span className="text-base">💰</span>
        <span className="text-[9px] font-medium text-score-amber uppercase tracking-widest">Dual Price</span>
      </div>

      {/* Name */}
      <input
        value={editName}
        onChange={(e) => { setEditName(e.target.value); onChange({ ...item, name: e.target.value }); }}
        className="w-full text-sm font-medium text-foreground bg-transparent outline-none border-b border-transparent focus:border-border transition-colors"
      />
      {item.original_name && (
        <p className="text-[10px] text-muted-foreground truncate">{item.original_name}</p>
      )}

      {/* Dual Price Fields */}
      <div className="flex gap-3">
        <div className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-center">
          <span className="block text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">ธรรมดา</span>
          <div className="flex items-center justify-center gap-1">
            <span className="text-[10px] text-muted-foreground">฿</span>
            <input
              value={editPrice}
              onChange={(e) => { setEditPrice(e.target.value); onChange({ ...item, price: Number(e.target.value) || 0 }); }}
              className="w-12 text-center text-base font-semibold text-foreground bg-transparent outline-none"
            />
          </div>
        </div>
        <div className="flex-1 bg-score-emerald/10 rounded-xl px-3 py-2.5 text-center">
          <span className="block text-[9px] font-medium text-score-emerald uppercase tracking-wider mb-1">พิเศษ</span>
          <div className="flex items-center justify-center gap-1">
            <span className="text-[10px] text-score-emerald">฿</span>
            <input
              value={editPriceSpecial}
              onChange={(e) => { setEditPriceSpecial(e.target.value); onChange({ ...item, price_special: Number(e.target.value) || 0 }); }}
              className="w-12 text-center text-base font-semibold text-score-emerald bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">ให้คะแนน</span>
        <MenuRatingButtons rating={item.rating} onRate={(v) => onChange({ ...item, rating: v })} />
      </div>
    </motion.div>
  );
};

export default DualPriceCard;
