import fs from "node:fs";

const required = [
  "apps/mobile/package.json",
  "apps/admin-web/package.json",
  "packages/shared/src/parser/planParser.ts",
  "supabase/migrations/20260215_001_create_gym_app_schema.sql"
];

const missing = required.filter((file) => !fs.existsSync(file));

if (missing.length > 0) {
  console.error("Missing required files:\n" + missing.map((m) => `- ${m}`).join("\n"));
  process.exit(1);
}

console.log("Workspace verification passed.");
