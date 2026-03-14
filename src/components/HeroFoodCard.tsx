import { motion } from "framer-motion";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";
import SensoryRadar from "./SensoryRadar";

const HeroFoodCard = () => {
  return (
    <section className="px-6 pb-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative overflow-hidden rounded-xl shadow-card-elevated"
      >
        {/* Image */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
          <img
            src={heroFood}
            alt="Chocolate Sphere with Gold Leaf"
            className="w-full h-full object-cover"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Sensory Radar */}
          <SensoryRadar />

          {/* Content overlay */}
          <div className="absolute bottom-4 right-4 left-[calc(160px+24px)] flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-primary-foreground leading-tight">
              Valrhona Sphere
            </h2>
            <p className="text-xs text-primary-foreground/70 leading-relaxed">
              Dark chocolate, gold leaf, cocoa crumble
            </p>

            {/* Verification Stamps */}
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/20 border border-gold/30">
                <BadgeCheck size={12} className="text-gold" />
                <span className="text-[10px] font-medium text-gold">
                  Verified by Chef
                </span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/20 border border-gold/30">
                <ShieldCheck size={12} className="text-gold" />
                <span className="text-[10px] font-medium text-gold">
                  Validated by Auditor
                </span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroFoodCard;
