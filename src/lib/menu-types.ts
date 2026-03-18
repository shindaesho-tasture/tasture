export interface MenuItem {
  id: string;
  name: string;
  original_name?: string;
  description?: string;
  textures?: string[];
  original_price?: number;
  original_currency?: string;
  type: "noodle" | "dual_price" | "standard";
  price: number;
  price_special?: number;
  noodle_types?: string[];
  noodle_styles?: string[];
  toppings?: string[];
  // User selections
  selected_noodle_type?: string;
  selected_noodle_style?: string;
  selected_toppings?: string[];
  // Rating: -2, 0, or +2
  rating?: number;
}
