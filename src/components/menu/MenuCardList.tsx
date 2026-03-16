import { AnimatePresence } from "framer-motion";
import type { MenuItem } from "@/lib/menu-types";
import NoodleCard from "./NoodleCard";
import DualPriceCard from "./DualPriceCard";
import StandardCard from "./StandardCard";

interface MenuCardListProps {
  items: MenuItem[];
  onItemChange: (index: number, updated: MenuItem) => void;
}

const MenuCardList = ({ items, onItemChange }: MenuCardListProps) => {
  if (items.length === 0) return null;

  // Group by type for display
  const noodles = items.filter((i) => i.type === "noodle");
  const dualPrice = items.filter((i) => i.type === "dual_price");
  const standard = items.filter((i) => i.type === "standard");

  const renderSection = (label: string, count: number, sectionItems: MenuItem[]) => {
    if (sectionItems.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className="text-[10px] font-light text-muted-foreground">{count} รายการ</span>
        </div>
        <AnimatePresence>
          {sectionItems.map((item) => {
            const idx = items.findIndex((i) => i.id === item.id);
            switch (item.type) {
              case "noodle":
                return <NoodleCard key={item.id} item={item} onChange={(u) => onItemChange(idx, u)} />;
              case "dual_price":
                return <DualPriceCard key={item.id} item={item} onChange={(u) => onItemChange(idx, u)} />;
              default:
                return <StandardCard key={item.id} item={item} onChange={(u) => onItemChange(idx, u)} />;
            }
          })}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">เมนูที่สแกนได้</h2>
        <span className="text-[10px] font-light text-muted-foreground">{items.length} รายการ</span>
      </div>
      {renderSection("🍜 ก๋วยเตี๋ยว / Noodles", noodles.length, noodles)}
      {renderSection("💰 ราคาคู่ / Dual Price", dualPrice.length, dualPrice)}
      {renderSection("🍽️ เมนูทั่วไป / Standard", standard.length, standard)}
    </div>
  );
};

export default MenuCardList;
