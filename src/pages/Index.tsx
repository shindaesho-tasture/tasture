import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import TastureHeader from "@/components/TastureHeader";
import KingSwitcher from "@/components/KingSwitcher";
import SensorySearch from "@/components/SensorySearch";
import HeroFoodCard from "@/components/HeroFoodCard";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <TastureHeader />

        {/* Large Title */}
        <div className="px-6 pt-2 pb-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Discover
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore through the lens of your senses
          </p>
        </div>

        <KingSwitcher />
        <SensorySearch />
        <HeroFoodCard />

        {/* Quick Actions */}
        <div className="px-6 pt-4 grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/categories")}
            className="flex items-center gap-2 p-4 rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 text-left"
          >
            <span className="text-xl">📝</span>
            <div>
              <span className="text-xs font-semibold text-foreground block">เขียนรีวิว</span>
              <span className="text-[10px] text-muted-foreground">7 Categories</span>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/results")}
            className="flex items-center gap-2 p-4 rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 text-left"
          >
            <span className="text-xl">📊</span>
            <div>
              <span className="text-xs font-semibold text-foreground block">ผลรีวิว</span>
              <span className="text-[10px] text-muted-foreground">Result Cards</span>
            </div>
          </motion.button>
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
};

export default Index;
