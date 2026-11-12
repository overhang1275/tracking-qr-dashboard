import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guide = readFileSync(new URL('../docs/android-integration.md', import.meta.url), 'utf8');

test('Android contract exposes Supabase Auth and REST endpoints with authenticated headers', () => {
  assert.match(guide, /POST \/auth\/v1\/token\?grant_type=password/);
  assert.match(guide, /GET \/rest\/v1\/profiles/);
  assert.match(guide, /POST \/rest\/v1\/validations/);
  assert.match(guide, /apikey: <SUPABASE_PUBLISHABLE_KEY>/);
  assert.match(guide, /Authorization: Bearer <ACCESS_TOKEN>/);
  assert.match(guide, /publishable key identifica el proyecto y puede incluirse/i);
});

test('event JSON has stable fields and leaves identity and timestamp to Postgres', () => {
  const block = guide.match(/## Registrar una lectura[\s\S]*?```json\n([\s\S]*?)\n```/);
  assert.ok(block, 'the event JSON example is present');
  const event = JSON.parse(block[1]);
  assert.deepEqual(Object.keys(event).sort(), [
    'app_version',
    'application',
    'client_event_id',
    'document_type',
    'element_type',
    'folio',
    'reported_result',
  ]);
  assert.equal('user_id' in event, false);
  assert.equal('created_at' in event, false);
  for (const value of ['soporte_vehicular', 'engomado_vehicular', 'engomado_remolque', 'valid', 'invalid', 'inconclusive', 'error']) {
    assert.ok(guide.includes(value), `contract includes ${value}`);
  }
});

test('SQL migration derives identity and time on the server and denies event edits', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20261112211418_colima_android_api.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /user_id uuid not null default auth\.uid\(\)/);
  assert.match(migration, /created_at timestamptz not null default now\(\)/);
  assert.match(migration, /validations_insert_active_validator_own/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /grant insert \(client_event_id, folio, document_type, element_type, reported_result, application, app_version\)/);
  assert.doesNotMatch(migration, /grant\s+(?:update|delete|all)[^;]*validations/i);
});

test('Android integration guide documents the API contract without SDK implementation snippets', () => {
  assert.doesNotMatch(guide, /```(?:java|kotlin)\n/i);
  assert.match(guide, /client_event_id/);
  assert.match(guide, /Authorization: Bearer <ACCESS_TOKEN>/);
  assert.match(guide, /POST \/rest\/v1\/validations/);
});
