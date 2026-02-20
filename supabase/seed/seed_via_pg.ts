import fs from "node:fs";
import { Client } from "pg";
import { parseTrainingPlan } from "../../packages/shared/src/parser/planParser";
import { parseArticles } from "../../packages/shared/src/parser/articleParser";

const SOURCE_FILE =
  "Comprehensive Alpinism Preparation and Conditioning Plan_ Mont Blanc Ascent for the Large-Frame Athlete (1).md";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function upsertFocus(client: Client) {
  const res = await client.query(
    `
      insert into gym_app.focuses (slug, name, description)
      values ($1, $2, $3)
      on conflict (slug) do update set name = excluded.name
      returning id
    `,
    ["mountaineering", "Mountaineering", "Alpinism and high-altitude training focus."]
  );
  return res.rows[0].id as string;
}

async function upsertPlan(client: Client, focusId: string) {
  const existing = await client.query(
    `select id from gym_app.training_plans where focus_id = $1 and name = $2 limit 1`,
    [focusId, "16-Week Mont Blanc Preparation"]
  );
  if (existing.rowCount && existing.rows[0].id) return existing.rows[0].id as string;

  const inserted = await client.query(
    `
      insert into gym_app.training_plans (focus_id, name, duration_weeks, is_active)
      values ($1, $2, 16, true)
      returning id
    `,
    [focusId, "16-Week Mont Blanc Preparation"]
  );
  return inserted.rows[0].id as string;
}

async function run() {
  const dbUrl = getRequiredEnv("POSTGRES_DB_URL");
  const markdown = fs.readFileSync(SOURCE_FILE, "utf8");
  const weeks = parseTrainingPlan(markdown);
  const articles = parseArticles(markdown);

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query("begin");

    const focusId = await upsertFocus(client);
    const planId = await upsertPlan(client, focusId);

    for (const week of weeks) {
      const weekRow = await client.query(
        `
          insert into gym_app.plan_weeks (plan_id, week_number, title, phase)
          values ($1, $2, $3, $4)
          on conflict (plan_id, week_number) do update set title = excluded.title, phase = excluded.phase
          returning id
        `,
        [planId, week.weekNumber, week.title, week.phase]
      );
      const weekId = weekRow.rows[0].id as string;

      for (const day of week.days) {
        const dayRow = await client.query(
          `
            insert into gym_app.plan_days (week_id, day_number, label, protocol, duration_load, is_rest_day, notes)
            values ($1, $2, $3, $4, $5, $6, $7)
            on conflict (week_id, day_number)
            do update set
              label = excluded.label,
              protocol = excluded.protocol,
              duration_load = excluded.duration_load,
              is_rest_day = excluded.is_rest_day,
              notes = excluded.notes
            returning id
          `,
          [weekId, day.dayNumber, day.label, day.protocol, day.durationLoad, day.isRestDay, day.notes]
        );
        const dayId = dayRow.rows[0].id as string;

        await client.query(`delete from gym_app.plan_exercises where day_id = $1`, [dayId]);
        for (let i = 0; i < day.exercises.length; i += 1) {
          const exercise = day.exercises[i];
          await client.query(
            `
              insert into gym_app.plan_exercises (day_id, name, description, sort_order)
              values ($1, $2, $3, $4)
            `,
            [dayId, exercise.name, exercise.description, i]
          );
        }
      }
    }

    let docId: string;
    const existingDoc = await client.query(
      `select id from gym_app.documents where focus_id = $1 and title = $2 limit 1`,
      [focusId, "Comprehensive Alpinism Preparation Plan"]
    );
    if (existingDoc.rowCount && existingDoc.rows[0].id) {
      docId = existingDoc.rows[0].id as string;
      await client.query(
        `update gym_app.documents set raw_text = $1, status = 'ready', source_type = 'markdown', storage_path = $2 where id = $3`,
        [markdown, SOURCE_FILE, docId]
      );
    } else {
      const insertedDoc = await client.query(
        `
          insert into gym_app.documents (focus_id, title, source_type, storage_path, raw_text, status)
          values ($1, $2, 'markdown', $3, $4, 'ready')
          returning id
        `,
        [focusId, "Comprehensive Alpinism Preparation Plan", SOURCE_FILE, markdown]
      );
      docId = insertedDoc.rows[0].id as string;
    }

    await client.query(`delete from gym_app.document_chunks where document_id = $1`, [docId]);
    for (let i = 0; i < articles.length; i += 1) {
      const article = articles[i];
      await client.query(
        `
          insert into gym_app.document_chunks (document_id, focus_id, category, chunk_text, chunk_order)
          values ($1, $2, $3, $4, $5)
        `,
        [docId, focusId, article.category, `${article.title}\n\n${article.body}`, i]
      );
    }

    await client.query("commit");
    console.log(`Seed complete. weeks=${weeks.length} article_chunks=${articles.length}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
