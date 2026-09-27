/* eslint-disable */
const fs = require('fs');

async function runQuery(query) {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  if (!projectId) throw new Error("SUPABASE_PROJECT_ID is not set in environment");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
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
    const sql2 = fs.readFileSync('supabase/migrations/202609270006_admin_no_shift.sql', 'utf8');
    await runQuery(sql2);
    
    // Rerun function definition without the ALTER TABLEs
    const sql3 = fs.readFileSync('supabase/migrations/202609270005_checkout_fields.sql', 'utf8');
    const funcOnly = sql3.substring(sql3.indexOf('CREATE OR REPLACE FUNCTION'));
    await runQuery(funcOnly);
    
    console.log('Admin shift_id migrations applied successfully!');
  } catch(e) {
    console.error('Migration failed:', e.message);
  }
}
run();
