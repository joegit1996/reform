import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseTrainingPlan } from "../../packages/shared/src/parser/planParser";
import { parseArticles } from "../../packages/shared/src/parser/articleParser";

const SOURCE_FILE =
  "Comprehensive Alpinism Preparation and Conditioning Plan_ Mont Blanc Ascent for the Large-Frame Athlete (1).md";

export async function seedMountaineering() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const markdownPath = path.resolve(process.cwd(), SOURCE_FILE);
  const markdown = fs.readFileSync(markdownPath, "utf8");

  const weeks = parseTrainingPlan(markdown);
  const articles = parseArticles(markdown);

  const { data: focus, error: focusError } = await supabase
    .schema("gym_app")
    .from("focuses")
    .upsert(
      {
        slug: "mountaineering",
        name: "Mountaineering",
        description: "Alpinism and high-altitude training focus."
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (focusError || !focus) throw focusError || new Error("Failed to upsert focus");

  const { data: existingPlan } = await supabase
    .schema("gym_app")
    .from("training_plans")
    .select("id")
    .eq("focus_id", focus.id)
    .eq("name", "16-Week Mont Blanc Preparation")
    .limit(1)
    .maybeSingle();

  const planMutation = existingPlan?.id
    ? supabase
        .schema("gym_app")
        .from("training_plans")
        .update({
          duration_weeks: 16,
          is_active: true
        })
        .eq("id", existingPlan.id)
        .select("id")
        .single()
    : supabase
        .schema("gym_app")
        .from("training_plans")
        .insert({
          focus_id: focus.id,
          name: "16-Week Mont Blanc Preparation",
          duration_weeks: 16,
          is_active: true
        })
        .select("id")
        .single();

  const { data: plan, error: planError } = await planMutation;

  if (planError || !plan) throw planError || new Error("Failed to upsert plan");

  for (const week of weeks) {
    const { data: weekRow, error: weekError } = await supabase
      .schema("gym_app")
      .from("plan_weeks")
      .upsert(
        {
          plan_id: plan.id,
          week_number: week.weekNumber,
          title: week.title,
          phase: week.phase
        },
        { onConflict: "plan_id,week_number" }
      )
      .select("id")
      .single();
    if (weekError || !weekRow) throw weekError || new Error(`Failed week ${week.weekNumber}`);

    for (const day of week.days) {
      const { data: dayRow, error: dayError } = await supabase
        .schema("gym_app")
        .from("plan_days")
        .upsert(
          {
            week_id: weekRow.id,
            day_number: day.dayNumber,
            label: day.label,
            protocol: day.protocol,
            duration_load: day.durationLoad,
            is_rest_day: day.isRestDay,
            notes: day.notes
          },
          { onConflict: "week_id,day_number" }
        )
        .select("id")
        .single();
      if (dayError || !dayRow) throw dayError || new Error("Failed day row");

      await supabase.schema("gym_app").from("plan_exercises").delete().eq("day_id", dayRow.id);
      for (let i = 0; i < day.exercises.length; i += 1) {
        const exercise = day.exercises[i];
        await supabase.schema("gym_app").from("plan_exercises").insert({
          day_id: dayRow.id,
          name: exercise.name,
          description: exercise.description,
          sort_order: i
        });
      }
    }
  }

  const { data: existingDoc } = await supabase
    .schema("gym_app")
    .from("documents")
    .select("id")
    .eq("focus_id", focus.id)
    .eq("title", "Comprehensive Alpinism Preparation Plan")
    .limit(1)
    .maybeSingle();

  const docMutation = existingDoc?.id
    ? supabase
        .schema("gym_app")
        .from("documents")
        .update({
          source_type: "markdown",
          storage_path: SOURCE_FILE,
          raw_text: markdown,
          status: "ready"
        })
        .eq("id", existingDoc.id)
        .select("id")
        .single()
    : supabase
        .schema("gym_app")
        .from("documents")
        .insert({
          focus_id: focus.id,
          title: "Comprehensive Alpinism Preparation Plan",
          source_type: "markdown",
          storage_path: SOURCE_FILE,
          raw_text: markdown,
          status: "ready"
        })
        .select("id")
        .single();

  const { data: doc, error: docError } = await docMutation;
  if (docError || !doc) throw docError || new Error("Failed document row");

  await supabase.schema("gym_app").from("document_chunks").delete().eq("document_id", doc.id);
  for (let i = 0; i < articles.length; i += 1) {
    const article = articles[i];
    await supabase.schema("gym_app").from("document_chunks").insert({
      document_id: doc.id,
      focus_id: focus.id,
      category: article.category,
      chunk_text: `${article.title}\n\n${article.body}`,
      chunk_order: i
    });
  }
}
