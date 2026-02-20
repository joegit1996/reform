export type PlanExercise = {
  name: string;
  description: string;
};

export type PlanDay = {
  dayNumber: number;
  label: string;
  protocol: string;
  durationLoad: string;
  notes: string;
  isRestDay: boolean;
  exercises: PlanExercise[];
};

export type PlanWeek = {
  weekNumber: number;
  phase: string;
  title: string;
  days: PlanDay[];
};

const DAY_MAP: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7
};

function parseExerciseList(raw: string): PlanExercise[] {
  const lines = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n|;/g)
    .map((v) => v.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  return lines.map((line) => {
    const [name, ...rest] = line.split(":");
    return {
      name: (name || line).trim(),
      description: rest.join(":").trim() || line.trim()
    };
  });
}

function parsePhaseRange(phaseHeading: string): { title: string; phase: string; weeks: number[] } | null {
  const clean = phaseHeading.replace(/\*/g, "").trim();
  const match = clean.match(/Phase\s+\d+:\s*(.+?)\s*\(Weeks\s*(\d+)-(\d+)\)/i);
  if (!match) return null;

  const start = Number(match[2]);
  const end = Number(match[3]);
  const weeks: number[] = [];
  for (let i = start; i <= end; i += 1) weeks.push(i);

  return {
    title: match[1].trim(),
    phase: clean,
    weeks
  };
}

export function parseTrainingPlan(markdown: string): PlanWeek[] {
  const lines = markdown.split("\n");
  const sections: { heading: string; table: string[] }[] = [];
  let current: { heading: string; table: string[] } | null = null;

  for (const line of lines) {
    if (line.trim().startsWith("### **Phase")) {
      if (current) sections.push(current);
      current = { heading: line.trim(), table: [] };
      continue;
    }

    if (current && line.trim().startsWith("|")) {
      current.table.push(line);
    } else if (current && current.table.length > 0 && line.trim() === "") {
      sections.push(current);
      current = null;
    }
  }

  if (current) sections.push(current);

  const weeks: PlanWeek[] = [];

  for (const section of sections) {
    const phaseMeta = parsePhaseRange(section.heading);
    if (!phaseMeta) continue;

    const rows = section.table.filter((line) => {
      const lower = line.toLowerCase();
      return !lower.includes("| :----") && !lower.includes("| day |");
    });

    const templateDays: PlanDay[] = rows
      .map((row) => row.split("|").map((v) => v.trim()))
      .filter((cells) => cells.length >= 5)
      .map((cells) => {
        const label = cells[1];
        const dayNumber = DAY_MAP[label.toLowerCase()] ?? 0;
        const protocol = cells[2] || "";
        const durationLoad = cells[3] || "";
        const notes = cells[4] || "";
        const isRestDay = /rest/i.test(protocol) || /complete physical recovery/i.test(notes);
        const exercises = parseExerciseList(notes);
        return { dayNumber, label, protocol, durationLoad, notes, isRestDay, exercises };
      })
      .filter((day) => day.dayNumber > 0);

    for (const weekNumber of phaseMeta.weeks) {
      weeks.push({
        weekNumber,
        phase: phaseMeta.phase,
        title: `${phaseMeta.title} - Week ${weekNumber}`,
        days: templateDays.map((day) => ({ ...day, exercises: [...day.exercises] }))
      });
    }
  }

  return weeks.sort((a, b) => a.weekNumber - b.weekNumber);
}
