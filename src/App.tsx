import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store-context";
import { OrderProvider } from "@/lib/order-context";
import Index from "./pages/Index.tsx";
import CategorySelect from "./pages/CategorySelect.tsx";
import StoreRegistration from "./pages/StoreRegistration.tsx";
import ReviewFlow from "./pages/ReviewFlow.tsx";
import Results from "./pages/Results.tsx";
import WorldMap from "./pages/WorldMap.tsx";
import SmartSplit from "./pages/SmartSplit.tsx";
import Profile from "./pages/Profile.tsx";
import Auth from "./pages/Auth.tsx";
import MyStores from "./pages/MyStores.tsx";
import StoreList from "./pages/StoreList.tsx";
import StoreOrder from "./pages/StoreOrder.tsx";
import OrderSummary from "./pages/OrderSummary.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import MenuFeedback from "./pages/MenuFeedback.tsx";
import DishDnaFeedback from "./pages/DishDnaFeedback.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/categories" element={<CategorySelect />} />
        <Route path="/register" element={<StoreRegistration />} />
        <Route path="/review/:categoryId" element={<ReviewFlow />} />
        <Route path="/results" element={<Results />} />
        <Route path="/world" element={<WorldMap />} />
        <Route path="/split" element={<SmartSplit />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/my-stores" element={<MyStores />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/menu-feedback/:storeId" element={<MenuFeedback />} />
        <Route path="/dish-dna/:menuItemId" element={<DishDnaFeedback />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <StoreProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </StoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
