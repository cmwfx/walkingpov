import { loadEnv } from "vite";

const env = { ...loadEnv("production", process.cwd()), ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const publishableKey = (
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
)?.trim();

const missing = [];
if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
if (!publishableKey) {
  missing.push("VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)");
}

if (missing.length > 0) {
  console.error(`Frontend build stopped: missing public Supabase configuration: ${missing.join(", ")}.`);
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  console.error("Frontend build stopped: VITE_SUPABASE_URL is not a valid URL.");
  process.exit(1);
}

if (parsedUrl.protocol !== "https:") {
  console.error("Frontend build stopped: VITE_SUPABASE_URL must use HTTPS.");
  process.exit(1);
}

if (publishableKey.startsWith("sb_secret_")) {
  console.error("Frontend build stopped: a Supabase secret key cannot be used in browser code.");
  process.exit(1);
}
