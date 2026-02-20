export type ArticleCategory =
  | "Nutrition"
  | "Gear"
  | "Acclimatization"
  | "Recovery"
  | "Strength"
  | "Cardio"
  | "Safety"
  | "General";

export type ParsedArticle = {
  title: string;
  category: ArticleCategory;
  body: string;
};

function classifyCategory(title: string, body: string): ArticleCategory {
  const text = `${title} ${body}`.toLowerCase();

  if (/(nutrition|fuel|hydration|caloric|protein|carbohydrate)/.test(text)) return "Nutrition";
  if (/(gear|backpack|boot|axe|equipment|clothing)/.test(text)) return "Gear";
  if (/(acclimat|altitude|hypoxia|hape|hace|ams)/.test(text)) return "Acclimatization";
  if (/(recovery|rest|sleep|taper)/.test(text)) return "Recovery";
  if (/(strength|muscular|deadlift|squat|core)/.test(text)) return "Strength";
  if (/(cardiovascular|aerobic|zone|stairmaster|endurance)/.test(text)) return "Cardio";
  if (/(risk|injury|hazard|safety|rockfall|descent)/.test(text)) return "Safety";
  return "General";
}

export function parseArticles(markdown: string): ParsedArticle[] {
  const lines = markdown.split("\n");
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    if (line.trim().startsWith("## **")) {
      if (current) sections.push(current);
      current = { heading: line.replace(/[#*]/g, "").trim(), body: [] };
      continue;
    }

    if (current) current.body.push(line);
  }

  if (current) sections.push(current);

  return sections
    .filter((section) => !/16-week periodized training macrocycle|works cited/i.test(section.heading))
    .map((section) => {
      const body = section.body.join("\n").trim();
      return {
        title: section.heading,
        category: classifyCategory(section.heading, body),
        body
      };
    })
    .filter((article) => article.body.length > 0);
}
