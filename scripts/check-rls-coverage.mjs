/**
 * Verifica estáticamente que cada tabla creada en supabase/migrations tenga
 * `enable row level security` en alguna migración.
 *
 * Uso: node scripts/check-rls-coverage.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const tableRe = /create table\s+(?:if not exists\s+)?(?:public\.)?([a-z_]+)/gi;
const tables = new Set();
const sqlByFile = new Map();

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  sqlByFile.set(file, sql);
  for (const match of sql.matchAll(tableRe)) tables.add(match[1]);
}

const missing = [];
for (const table of [...tables].sort()) {
  const enabled = [...sqlByFile.values()].some((sql) =>
    new RegExp(
      `alter table\\s+(?:public\\.)?${table}\\s+enable row level security`,
      "i"
    ).test(sql)
  );
  if (!enabled) missing.push(table);
}

console.log(`Tablas detectadas: ${tables.size}`);
console.log(`Con RLS en migraciones: ${tables.size - missing.length}`);

if (missing.length > 0) {
  console.error(`\nSin RLS: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("OK: todas las tablas tienen RLS versionado.");
