export interface SensoryAxis {
  name: string;
  icon: string;
  labels: [string, string, string, string, string]; // 5 levels
}

export interface SensoryAnalysis {
  dish_name: string;
  axes: SensoryAxis[];
}

export interface SensoryFeedback {
  axis_name: string;
  axis_icon: string;
  level: 1 | 2 | 3 | 4 | 5; // 1=lacking, 3=perfect, 5=excessive
}
