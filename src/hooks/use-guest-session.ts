import { useMemo } from "react";

const GUEST_ID_KEY = "tasture_guest_id";
const GUEST_REVIEWS_KEY = "tasture_guest_reviews";
const GUEST_ORDERS_KEY = "tasture_guest_orders";

function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest_${crypto.randomUUID()}`;
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export interface GuestReview {
  storeId: string;
  menuItemId: string;
  score: number;
  timestamp: number;
}

export interface GuestOrder {
  storeId: string;
  storeName: string;
  items: { menuItemId: string; name: string; quantity: number; price: number }[];
  timestamp: number;
}

export const useGuestSession = () => {
  const guestId = useMemo(() => getOrCreateGuestId(), []);

  const hasReviewed = (menuItemId: string): boolean => {
    return localStorage.getItem(`has_reviewed_${menuItemId}`) === "true";
  };

  const markReviewed = (menuItemId: string) => {
    localStorage.setItem(`has_reviewed_${menuItemId}`, "true");
  };

  const saveGuestReview = (review: GuestReview) => {
    const existing = getGuestReviews();
    // Replace if same menuItemId exists
    const filtered = existing.filter((r) => r.menuItemId !== review.menuItemId);
    filtered.push(review);
    localStorage.setItem(GUEST_REVIEWS_KEY, JSON.stringify(filtered));
    markReviewed(review.menuItemId);
  };

  const getGuestReviews = (): GuestReview[] => {
    try {
      return JSON.parse(localStorage.getItem(GUEST_REVIEWS_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const saveGuestOrder = (order: GuestOrder) => {
    const existing = getGuestOrders();
    existing.push(order);
    localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(existing));
  };

  const getGuestOrders = (): GuestOrder[] => {
    try {
      return JSON.parse(localStorage.getItem(GUEST_ORDERS_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const getGuestReviewCount = (): number => {
    return getGuestReviews().length;
  };

  return {
    guestId,
    hasReviewed,
    markReviewed,
    saveGuestReview,
    getGuestReviews,
    saveGuestOrder,
    getGuestOrders,
    getGuestReviewCount,
  };
};
