const fs = require('fs');

async function runQuery(query) {
  const res = await fetch('https://api.supabase.com/v1/projects/zfzyzwfliihqgeinnyuy/database/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch(e) { return text; }
  if (json.message && json.message.includes('Failed to run sql query')) {
    throw new Error(json.message);
  }
  return json;
}

async function run() {
  try {
    // 1. Create migration tracking table
    await runQuery(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
          version character varying(255) PRIMARY KEY,
          statements text[],
          name character varying(255)
      );
    `);
    console.log('Migration tracking table ready.');

    const files = [
      { name: '202609160001', file: 'supabase/migrations/202609160001_foundation.sql' },
      { name: '202609170002', file: 'supabase/migrations/202609170002_operations.sql' },
      { name: '202609170003', file: 'supabase/migrations/202609170003_reconciliation.sql' },
      { name: '202609170004', file: 'supabase/migrations/202609170004_indexes.sql' },
      { name: 'bootstrap', file: 'supabase/bootstrap.sql' }
    ];

    for (const f of files) {
      console.log(`Applying ${f.name}...`);
      const sql = fs.readFileSync(f.file, 'utf8');
      await runQuery(sql);
      if (f.name !== 'bootstrap') {
        await runQuery(`INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${f.name}', '${f.name}') ON CONFLICT DO NOTHING;`);
      }
      console.log(`${f.name} applied successfully.`);
    }
    console.log('All migrations applied successfully!');
  } catch(e) {
    console.error('Migration failed:', e.message);
  }
}
run();
