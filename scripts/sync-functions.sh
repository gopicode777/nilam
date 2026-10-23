#!/usr/bin/env bash
# The server runs the SAME audit rules as the app. Copy them into the Edge Function (Deno needs explicit .ts imports).
set -e
cd "$(dirname "$0")/.."
cp src/types.ts supabase/functions/run-audit/types.ts
sed "s#from './types'#from './types.ts'#" src/engine.ts > supabase/functions/run-audit/engine.ts
echo "synced engine.ts + types.ts into supabase/functions/run-audit/"
