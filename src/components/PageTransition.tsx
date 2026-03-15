import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => (
  <motion.div
    initial={{ x: "60%", opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: "-30%", opacity: 0 }}
    transition={{
      type: "spring",
      stiffness: 380,
      damping: 34,
      mass: 0.8,
    }}
    className="min-h-screen"
  >
    {children}
  </motion.div>
);

export default PageTransition;
