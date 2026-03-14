import { motion } from "framer-motion";
import TastureHeader from "@/components/TastureHeader";
import KingSwitcher from "@/components/KingSwitcher";
import SensorySearch from "@/components/SensorySearch";
import HeroFoodCard from "@/components/HeroFoodCard";
import BottomNav from "@/components/BottomNav";

const Index = () => {
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
      </motion.div>

      <BottomNav />
    </div>
  );
};

export default Index;
