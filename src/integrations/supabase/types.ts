export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      dish_descriptions: {
        Row: {
          component_name: string
          created_at: string
          description: string
          id: string
          language: string
          menu_item_id: string
        }
        Insert: {
          component_name: string
          created_at?: string
          description: string
          id?: string
          language?: string
          menu_item_id: string
        }
        Update: {
          component_name?: string
          created_at?: string
          description?: string
          id?: string
          language?: string
          menu_item_id?: string
        }
        Relationships: []
      }
      dish_dna: {
        Row: {
          component_icon: string
          component_name: string
          created_at: string
          id: string
          menu_item_id: string
          selected_score: number
          selected_tag: string
          user_id: string
        }
        Insert: {
          component_icon?: string
          component_name: string
          created_at?: string
          id?: string
          menu_item_id: string
          selected_score: number
          selected_tag: string
          user_id: string
        }
        Update: {
          component_icon?: string
          component_name?: string
          created_at?: string
          id?: string
          menu_item_id?: string
          selected_score?: number
          selected_tag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_dna_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_templates: {
        Row: {
          components: Json
          created_at: string
          dish_name: string
          id: string
          updated_at: string
        }
        Insert: {
          components?: Json
          created_at?: string
          dish_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          components?: Json
          created_at?: string
          dish_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          ref_id: string
          ref_type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          ref_id: string
          ref_type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          ref_id?: string
          ref_type?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      menu_addons: {
        Row: {
          category: string
          created_at: string
          id: string
          menu_item_id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          menu_item_id: string
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          menu_item_id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_addons_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          menu_category: string | null
          name: string
          noodle_style_prices: Json
          noodle_styles: string[] | null
          noodle_type_prices: Json
          noodle_types: string[] | null
          original_name: string | null
          price: number
          price_special: number | null
          rating: number | null
          sort_order: number
          store_id: string
          textures: string[] | null
          toppings: string[] | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          menu_category?: string | null
          name: string
          noodle_style_prices?: Json
          noodle_styles?: string[] | null
          noodle_type_prices?: Json
          noodle_types?: string[] | null
          original_name?: string | null
          price?: number
          price_special?: number | null
          rating?: number | null
          sort_order?: number
          store_id: string
          textures?: string[] | null
          toppings?: string[] | null
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          menu_category?: string | null
          name?: string
          noodle_style_prices?: Json
          noodle_styles?: string[] | null
          noodle_type_prices?: Json
          noodle_types?: string[] | null
          original_name?: string | null
          price?: number
          price_special?: number | null
          rating?: number | null
          sort_order?: number
          store_id?: string
          textures?: string[] | null
          toppings?: string[] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_reviews: {
        Row: {
          created_at: string
          hidden: boolean
          id: string
          menu_item_id: string
          score: number
          shared: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          id?: string
          menu_item_id: string
          score: number
          shared?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          id?: string
          menu_item_id?: string
          score?: number
          shared?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_reviews_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_translations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language: string
          menu_item_id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language: string
          menu_item_id: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          menu_item_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_translations_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: string
          is_read: boolean
          ref_id: string | null
          ref_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string | null
          ref_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string | null
          ref_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      post_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          menu_review_id: string | null
          post_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          menu_review_id?: string | null
          post_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          menu_review_id?: string | null
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_images_menu_review_id_fkey"
            columns: ["menu_review_id"]
            isOneToOne: false
            referencedRelation: "menu_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          ref_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ref_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ref_id?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          hidden: boolean
          hide_reason: string | null
          id: string
          image_url: string
          menu_review_id: string | null
          store_id: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hidden?: boolean
          hide_reason?: string | null
          id?: string
          image_url: string
          menu_review_id?: string | null
          store_id?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          hidden?: boolean
          hide_reason?: string | null
          id?: string
          image_url?: string
          menu_review_id?: string | null
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_menu_review_id_fkey"
            columns: ["menu_review_id"]
            isOneToOne: false
            referencedRelation: "menu_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned: boolean
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      queues: {
        Row: {
          created_at: string
          id: string
          party_size: number
          queue_number: number
          status: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          party_size?: number
          queue_number: number
          status?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          party_size?: number
          queue_number?: number
          status?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          metric_id: string
          score: number
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_id: string
          score: number
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_id?: string
          score?: number
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_ratings: {
        Row: {
          cleanliness: number
          created_at: string
          id: string
          menu_item_id: string
          overall: number
          taste: number
          texture: number
          user_id: string
          value: number
        }
        Insert: {
          cleanliness?: number
          created_at?: string
          id?: string
          menu_item_id: string
          overall?: number
          taste?: number
          texture?: number
          user_id: string
          value?: number
        }
        Update: {
          cleanliness?: number
          created_at?: string
          id?: string
          menu_item_id?: string
          overall?: number
          taste?: number
          texture?: number
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_ratings_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_stores: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      site_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      stores: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          menu_photo: string | null
          name: string
          pin_lat: number | null
          pin_lng: number | null
          user_id: string
          verified: boolean
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          menu_photo?: string | null
          name: string
          pin_lat?: number | null
          pin_lng?: number | null
          user_id: string
          verified?: boolean
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          menu_photo?: string | null
          name?: string
          pin_lat?: number | null
          pin_lng?: number | null
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      tag_translations: {
        Row: {
          created_at: string
          id: string
          language: string
          tag_text: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          language: string
          tag_text: string
          translated_text: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          tag_text?: string
          translated_text?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_queue_number: { Args: { p_store_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
