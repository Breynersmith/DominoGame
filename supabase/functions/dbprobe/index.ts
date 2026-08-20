import postgres from 'npm:postgres@3.4.5';
Deno.serve(async (req) => {
  try {
    const sql = postgres(Deno.env.get('DATABASE_URL')!, { max: 1, ssl: 'require', connect_timeout: 10 });
    const r = await sql`
      select '{"a":1}'::jsonb as lit, estado::jsonb as est, jsonb_build_object('b', 2) as build
      from partidas where codigo = ${'L2932W'}`;
    const row = r[0];
    const res: Record<string, string> = {};
    for (const k of ['lit', 'est', 'build']) {
      res[k] = typeof (row as any)[k];
      res[k + '_val'] = String((row as any)[k]).slice(0, 30);
    }
    return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? (e.stack ?? e.message) : e) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
});