export type Exercise = {
  id: string;
  name: string;
  description: string;
  done: boolean;
};

export type DayPlan = {
  id: string;
  label: string;
  protocol: string;
  isRestDay: boolean;
  exercises: Exercise[];
};

export const currentWeek = 1;

export const weekPlans: DayPlan[] = [
  {
    id: "w1-d1",
    label: "Monday",
    protocol: "Rest Day",
    isRestDay: true,
    exercises: []
  },
  {
    id: "w1-d2",
    label: "Tuesday",
    protocol: "Aerobic Base",
    isRestDay: false,
    exercises: [
      {
        id: "w1-d2-e1",
        name: "StairMaster Zone 2",
        description: "45 min at conversational pace with light pack",
        done: false
      }
    ]
  },
  {
    id: "w1-d3",
    label: "Wednesday",
    protocol: "Strength Foundation",
    isRestDay: false,
    exercises: [
      { id: "w1-d3-e1", name: "Squat", description: "3x8 moderate load", done: false },
      { id: "w1-d3-e2", name: "Pull-down", description: "3x10", done: false },
      { id: "w1-d3-e3", name: "Plank", description: "3x45s", done: false }
    ]
  }
];
