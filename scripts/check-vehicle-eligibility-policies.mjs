import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20261123150000_align_vehicle_offer_eligibility_with_catalog.sql', import.meta.url);
const sql = await readFile(migrationPath, 'utf8');

const policies = [
  ['approved providers submit offers for open employee requests', 'employee_rental_offers'],
  ['approved providers with eligible vehicles can offer on open req', 'rental_offers'],
  ['eligible providers can view matching open rental requests', 'rental_requests'],
];

for (const [name, table] of policies) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(new RegExp('CREATE\\s+POLICY\\s+"' + escapedName + '"[\\s\\S]*?ON\\s+public\\.' + table + '[\\s\\S]*?;', 'i'));
  assert.ok(match, `Missing policy definition: ${table} / ${name}`);
  const definition = match[0];
  assert.match(definition, /registration_expires_at\\s+IS\\s+NOT\\s+NULL/i, `Policy must require registration expiry: ${name}`);
  assert.match(definition, /registration_expires_at\\s*>\\s*now\\(\\)/i, `Policy must require unexpired registration: ${name}`);
  assert.doesNotMatch(definition, /registration_expires_at\\s+IS\\s+NULL(?!\\s*AND)/i, `Policy must not allow missing registration expiry: ${name}`);
}

console.log('Vehicle eligibility regression checks passed for all 3 RLS policies.');
