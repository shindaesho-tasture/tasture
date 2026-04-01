import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store-context";
import { OrderProvider } from "@/lib/order-context";
import { CategoriesProvider } from "@/hooks/use-categories";
import { LanguageProvider } from "@/lib/language-context";
import { MerchantProvider } from "@/lib/merchant-context";
import HomeFeed from "./pages/HomeFeed.tsx";
import Index from "./pages/Index.tsx";
import CategorySelect from "./pages/CategorySelect.tsx";
import StoreRegistration from "./pages/StoreRegistration.tsx";
import ReviewFlow from "./pages/ReviewFlow.tsx";
import Results from "./pages/Results.tsx";
import CreatePost from "./pages/CreatePost.tsx";
import OrderHistory from "./pages/OrderHistory.tsx";
import Profile from "./pages/Profile.tsx";
import Auth from "./pages/Auth.tsx";

import StoreList from "./pages/StoreList.tsx";
import StoreOrder from "./pages/StoreOrder.tsx";
import OrderSummary from "./pages/OrderSummary.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import MenuFeedback from "./pages/MenuFeedback.tsx";
import DishDnaFeedback from "./pages/DishDnaFeedback.tsx";
import PostOrderReview from "./pages/PostOrderReview.tsx";
import MenuImageManager from "./pages/MenuImageManager.tsx";
import MenuManager from "./pages/MenuManager.tsx";
import FollowList from "./pages/FollowList.tsx";
import UserProfile from "./pages/UserProfile.tsx";
import QueueManager from "./pages/QueueManager.tsx";
import KitchenDashboard from "./pages/KitchenDashboard.tsx";
import MerchantHub from "./pages/MerchantHub.tsx";
import NotFound from "./pages/NotFound.tsx";

// Merchant sub-app
import MerchantLogin from "./pages/merchant/MerchantLogin.tsx";
import MerchantDashboard from "./pages/merchant/MerchantDashboard.tsx";
import MerchantKitchen from "./pages/merchant/MerchantKitchen.tsx";
import MerchantMenu from "./pages/merchant/MerchantMenu.tsx";
import MerchantQueue from "./pages/merchant/MerchantQueue.tsx";
import MerchantProfile from "./pages/merchant/MerchantProfile.tsx";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Consumer app */}
        <Route path="/" element={<HomeFeed />} />
        <Route path="/discover" element={<Index />} />
        <Route path="/categories" element={<CategorySelect />} />
        <Route path="/register" element={<StoreRegistration />} />
        <Route path="/review/:categoryId" element={<ReviewFlow />} />
        <Route path="/results" element={<Results />} />
        <Route path="/post" element={<CreatePost />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/orders" element={<OrderHistory />} />
        <Route path="/auth" element={<Auth />} />
        
        <Route path="/store-list" element={<StoreList />} />
        <Route path="/store/:storeId/order" element={<StoreOrder />} />
        <Route path="/order-summary" element={<OrderSummary />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/menu-feedback/:storeId" element={<MenuFeedback />} />
        <Route path="/dish-dna/:menuItemId" element={<DishDnaFeedback />} />
        <Route path="/post-review" element={<PostOrderReview />} />
        <Route path="/menu-images/:storeId" element={<MenuImageManager />} />
        <Route path="/menu-manager/:storeId" element={<MenuManager />} />
        <Route path="/follows" element={<FollowList />} />
        <Route path="/user/:userId" element={<UserProfile />} />
        <Route path="/queue-manager/:storeId" element={<QueueManager />} />
        <Route path="/kitchen/:storeId" element={<KitchenDashboard />} />
        <Route path="/merchant/:storeId" element={<MerchantHub />} />
        <Route path="/my-stores" element={<MerchantHub />} />

        {/* ── Merchant sub-app (/m/*) ── */}
        <Route path="/m/login" element={<MerchantLogin />} />
        <Route path="/m" element={<MerchantDashboard />} />
        <Route path="/m/kitchen" element={<MerchantKitchen />} />
        <Route path="/m/menu" element={<MerchantMenu />} />
        <Route path="/m/queue" element={<MerchantQueue />} />
        <Route path="/m/profile" element={<MerchantProfile />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <CategoriesProvider>
          <StoreProvider>
            <OrderProvider>
              <MerchantProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AnimatedRoutes />
                </BrowserRouter>
              </MerchantProvider>
            </OrderProvider>
          </StoreProvider>
        </CategoriesProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
