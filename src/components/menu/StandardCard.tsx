import { useState } from "react";
import { motion } from "framer-motion";
import type { MenuItem } from "@/lib/menu-types";
import MenuRatingButtons from "./MenuRatingButtons";

interface StandardCardProps {
  item: MenuItem;
  onChange: (updated: MenuItem) => void;
}

const StandardCard = ({ item, onChange }: StandardCardProps) => {
  const [editName, setEditName] = useState(item.name);
  const [editPrice, setEditPrice] = useState(String(item.price));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-elevated rounded-2xl shadow-luxury p-4 space-y-2"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Name */}
        <div className="flex-1 min-w-0">
          <input
            value={editName}
            onChange={(e) => { setEditName(e.target.value); onChange({ ...item, name: e.target.value }); }}
            className="w-full text-sm font-medium text-foreground bg-transparent outline-none border-b border-transparent focus:border-border transition-colors truncate"
          />
          {item.original_name && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.original_name}</p>
          )}
        </div>

        {/* Price */}
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">฿</span>
            <input
              value={editPrice}
              onChange={(e) => { setEditPrice(e.target.value); onChange({ ...item, price: Number(e.target.value) || 0 }); }}
              className="w-14 text-right text-sm font-semibold text-foreground bg-transparent outline-none border-b border-transparent focus:border-border transition-colors"
            />
          </div>
          {item.original_currency && item.original_currency !== "THB" && item.original_price != null && (
            <span className="text-[9px] text-muted-foreground/70 mt-0.5">
              ≈ {item.original_currency} {item.original_price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Rating */}
        <MenuRatingButtons rating={item.rating} onRate={(v) => onChange({ ...item, rating: v })} />
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">{item.description}</p>
      )}

      {/* Texture pills */}
      {item.textures && item.textures.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.textures.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-secondary text-[9px] font-medium text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default StandardCard;
