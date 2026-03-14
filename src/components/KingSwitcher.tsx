import { useState } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Eye,
  Flame,
  Droplets,
  Wind,
  Ear,
  Hand,
  Heart,
} from "lucide-react";

const kings = [
  { id: "sovereign", label: "Sovereign", icon: Crown },
  { id: "sight", label: "Sight", icon: Eye },
  { id: "heat", label: "Heat", icon: Flame },
  { id: "liquid", label: "Liquid", icon: Droplets },
  { id: "aroma", label: "Aroma", icon: Wind },
  { id: "sound", label: "Sound", icon: Ear },
  { id: "touch", label: "Touch", icon: Hand },
  { id: "soul", label: "Soul", icon: Heart },
];

const KingSwitcher = () => {
  const [active, setActive] = useState("sovereign");

  return (
    <section className="px-4 py-4">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {kings.map((king) => {
          const Icon = king.icon;
          const isActive = active === king.id;
          return (
            <motion.button
              key={king.id}
              onClick={() => setActive(king.id)}
              whileTap={{ scale: 0.93 }}
              className={`flex flex-col items-center gap-1.5 min-w-[64px] px-3 py-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-foreground shadow-luxury"
                  : "bg-secondary"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={1.5}
                className={`transition-colors duration-300 ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-[10px] font-medium tracking-wide transition-colors duration-300 ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {king.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};

export default KingSwitcher;
