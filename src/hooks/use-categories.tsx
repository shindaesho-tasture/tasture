import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { categories as defaultCategories, type Category } from "@/lib/categories";

interface CategoriesContextValue {
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: defaultCategories,
  loading: false,
  refresh: async () => {},
});

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "categories")
        .single();

      if (data?.value && Array.isArray(data.value) && data.value.length > 0) {
        setCategories(data.value as unknown as Category[]);
      } else {
        setCategories(defaultCategories);
      }
    } catch {
      setCategories(defaultCategories);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <CategoriesContext.Provider value={{ categories, loading, refresh: load }}>
      {children}
    </CategoriesContext.Provider>
  );
};

export const useCategories = () => useContext(CategoriesContext);
