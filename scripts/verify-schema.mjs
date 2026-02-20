import fs from "node:fs";

const file = "supabase/migrations/20260215_001_create_gym_app_schema.sql";
if (!fs.existsSync(file)) {
  console.error("Schema migration file missing.");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
const required = [
  "create schema if not exists gym_app",
  "create table if not exists gym_app.focuses",
  "create table if not exists gym_app.training_plans",
  "create table if not exists gym_app.documents",
  "create table if not exists gym_app.chat_messages"
];

for (const marker of required) {
  if (!sql.toLowerCase().includes(marker)) {
    console.error(`Missing schema marker: ${marker}`);
    process.exit(1);
  }
}

if (sql.toLowerCase().includes("create table if not exists public.")) {
  console.error("Detected disallowed table creation in public schema.");
  process.exit(1);
}

console.log("Schema verification passed.");
