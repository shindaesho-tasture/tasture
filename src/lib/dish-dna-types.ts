export interface DishComponent {
  name: string;
  icon: string;
  tags: {
    emerald: string[]; // +2 (2 tags)
    neutral: string[]; // 0 (2 tags)
    ruby: string[];    // -2 (2 tags)
  };
}

export interface DishAnalysis {
  dish_name: string;
  components: DishComponent[];
}

export interface DishDnaSelection {
  component_name: string;
  component_icon: string;
  selected_score: -2 | 0 | 2;
  selected_tag: string;
}
