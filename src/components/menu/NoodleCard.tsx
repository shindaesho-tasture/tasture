import { useState } from "react";
import { motion } from "framer-motion";
import type { MenuItem } from "@/lib/menu-types";
import MenuRatingButtons from "./MenuRatingButtons";
import SensoryPills from "./SensoryPills";
import { useLanguage } from "@/lib/language-context";

interface NoodleCardProps {
  item: MenuItem;
  onChange: (updated: MenuItem) => void;
}

const NoodleCard = ({ item, onChange }: NoodleCardProps) => {
  const { t } = useLanguage();
  const [editName, setEditName] = useState(item.name);
  const [editPrice, setEditPrice] = useState(String(item.price));

  const defaultNoodleTypes = item.noodle_types?.length ? item.noodle_types : ["เส้นเล็ก", "เส้นใหญ่", "บะหมี่", "วุ้นเส้น", "มาม่า"];
  const defaultStyles = item.noodle_styles?.length ? item.noodle_styles : ["น้ำ", "แห้ง", "ต้มยำ", "เย็นตาโฟ"];

  const handleChip = (field: "selected_noodle_type" | "selected_noodle_style", value: string) => {
    onChange({ ...item, [field]: item[field] === value ? undefined : value });
  };

  const MAX_TOPPINGS = 3;
  const handleTopping = (topping: string) => {
    const current = item.selected_toppings || [];
    if (current.includes(topping)) {
      onChange({ ...item, selected_toppings: current.filter((t) => t !== topping) });
    } else if (current.length < MAX_TOPPINGS) {
      onChange({ ...item, selected_toppings: [...current, topping] });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-elevated rounded-2xl shadow-luxury p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🍜</span>
            <span className="text-[9px] font-medium text-score-emerald uppercase tracking-widest">Noodle</span>
          </div>
          <input
            value={editName}
            onChange={(e) => { setEditName(e.target.value); onChange({ ...item, name: e.target.value }); }}
            className="w-full text-sm font-medium text-foreground bg-transparent outline-none border-b border-transparent focus:border-border transition-colors"
          />
          {item.original_name && (
            <p className="text-[10px] text-muted-foreground truncate">{item.original_name}</p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">฿</span>
            <input
              value={editPrice}
              onChange={(e) => { setEditPrice(e.target.value); onChange({ ...item, price: Number(e.target.value) || 0 }); }}
              className="w-14 text-right text-sm font-semibold text-foreground bg-transparent outline-none border-b border-transparent focus:border-border transition-colors"
            />
          </div>
          {item.original_currency && item.original_currency !== "THB" && item.original_price != null && (
            <span className="text-[9px] text-muted-foreground">
              {item.original_currency} {item.original_price.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Noodle Type Chips */}
      <div>
        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{t("card.noodleType")}</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {defaultNoodleTypes.map((type) => (
            <motion.button
              key={type}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleChip("selected_noodle_type", type)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-light transition-all ${
                item.selected_noodle_type === type
                  ? "bg-score-emerald text-primary-foreground shadow-sm"
                  : "bg-secondary text-foreground"
              }`}
            >
              {type}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Style Chips */}
      <div>
        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{t("card.style")}</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {defaultStyles.map((style) => (
            <motion.button
              key={style}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleChip("selected_noodle_style", style)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-light transition-all ${
                item.selected_noodle_style === style
                  ? "bg-score-emerald text-primary-foreground shadow-sm"
                  : "bg-secondary text-foreground"
              }`}
            >
              {style}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Toppings */}
      {item.toppings && item.toppings.length > 0 && (
        <div>
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{t("card.topping")}</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {item.toppings.map((topping) => (
              <motion.button
                key={topping}
                whileTap={{ scale: 0.93 }}
                onClick={() => handleTopping(topping)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-light transition-all ${
                  item.selected_toppings?.includes(topping)
                    ? "bg-score-mint text-foreground shadow-sm"
                    : "bg-secondary text-foreground"
                }`}
              >
                {topping}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {item.description && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">{item.description}</p>
      )}

      {/* Sensory pills (texture + aroma + mouthfeel) */}
      {item.textures && item.textures.length > 0 && (
        <SensoryPills textures={item.textures} />
      )}

      {/* Rating */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{t("card.rate")}</span>
        <MenuRatingButtons rating={item.rating} onRate={(v) => onChange({ ...item, rating: v })} />
      </div>
    </motion.div>
  );
};

export default NoodleCard;
