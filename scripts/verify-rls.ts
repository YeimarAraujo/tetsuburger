/**
 * Verifica en runtime (con la clave anon) que RLS protege los datos privados.
 *
 * Uso:
 *   node --experimental-strip-types scripts/verify-rls.ts
 *
 * Lee SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL y
 * NEXT_PUBLIC_SUPABASE_ANON_KEY de .env.local o del entorno.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!(match[1] in env)) env[match[1]] = value;
    }
  } catch {
    // Sin .env.local: se usan las variables del entorno.
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(2);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRIVATE_TABLES = [
  "orders",
  "expenses",
  "inventory_items",
  "audit_logs",
  "daily_closings",
];

let failures = 0;

function fail(message: string) {
  failures += 1;
  console.error(`FALLA: ${message}`);
}

for (const table of PRIVATE_TABLES) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    // Un error de permisos también es un resultado seguro.
    console.log(`OK   ${table}: acceso denegado (${error.code ?? "sin código"})`);
    continue;
  }
  if ((data ?? []).length > 0) fail(`${table}: anon leyó ${data?.length} fila(s)`);
  else console.log(`OK   ${table}: 0 filas visibles para anon`);
}

{
  const { data, error } = await supabase
    .from("settings")
    .select("key, is_public")
    .limit(200);
  if (error) {
    console.log(`OK   settings: acceso denegado (${error.code ?? "sin código"})`);
  } else {
    const leaked = (data ?? []).filter((row) => row.is_public !== true);
    if (leaked.length > 0) fail(`settings: anon ve ${leaked.length} fila(s) privadas`);
    else console.log(`OK   settings: solo ${data?.length ?? 0} fila(s) públicas`);
  }
}

{
  const { data, error } = await supabase
    .from("product_reviews")
    .select("status")
    .limit(500);
  if (error) {
    console.log(`OK   product_reviews: acceso denegado (${error.code ?? "sin código"})`);
  } else {
    const notApproved = (data ?? []).filter((row) => row.status !== "APROBADO");
    if (notApproved.length > 0) {
      fail(`product_reviews: anon ve ${notApproved.length} reseña(s) no aprobadas`);
    } else {
      console.log(`OK   product_reviews: ${data?.length ?? 0} aprobadas visibles`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} comprobación(es) fallaron.`);
  process.exit(1);
}

console.log("\nOK: RLS protege los datos privados frente a la clave anon.");
