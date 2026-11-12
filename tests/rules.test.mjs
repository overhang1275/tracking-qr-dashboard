import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { equalTo, get, limitToFirst, limitToLast, orderByChild, orderByKey, query, ref, remove, serverTimestamp, set, update } from 'firebase/database';

let environment;
const profile = (role = 'VALIDADOR', status = 'active') => ({ firstName: 'Ana', lastName: 'Colima', email: 'ana@example.test', role, status, createdAt: 1, updatedAt: 1, createdBy: 'admin' });
const event = (userId = 'validator') => ({ userId, folio: 'COL-2027-001', documentType: 'soporte_vehicular', elementType: 'escudo_invisible', reportedResult: 'valid', timestamp: serverTimestamp(), application: 'Colima', appVersion: '1.0.0' });
const audit = () => ({ actorUid: 'admin', action: 'user.updated', targetId: 'validator', timestamp: serverTimestamp(), details: 'Perfil actualizado' });
const database = (uid) => uid ? environment.authenticatedContext(uid, { email: `${uid}@example.test` }).database() : environment.unauthenticatedContext().database();
const recent = (db, path = 'validations', maximum = 500) => query(ref(db, path), orderByChild('timestamp'), limitToLast(maximum));
const own = (db, uid = 'validator', maximum = 500) => query(ref(db, 'validations'), orderByChild('userId'), equalTo(uid), limitToLast(maximum));

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-colima-2027',
    database: { host: '127.0.0.1', port: 9000, rules: await readFile(new URL('../database.rules.json', import.meta.url), 'utf8') },
  });
});
after(async () => { await environment?.cleanup(); });
beforeEach(async () => {
  await environment.clearDatabase();
  await environment.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database()), {
      users: { admin: profile('ADMINISTRADOR'), supervisor: profile('SUPERVISOR'), auditor: profile('AUDITOR'), validator: profile(), other: profile(), inactive: profile('VALIDADOR', 'inactive') },
      validations: { existing: { ...event(), timestamp: 1 }, foreign: { ...event('other'), timestamp: 2 } },
      auditLogs: { existing: { ...audit(), timestamp: 1 } },
      settings: { institution: { name: 'Colima', updatedAt: 1, updatedBy: 'admin' } },
    });
  });
});

test('1. Unauthenticated reads and writes are denied', async () => {
  const db = database();
  await assertFails(get(ref(db, 'users/validator')));
  await assertFails(get(recent(db)));
  await assertFails(set(ref(db, 'validations/new'), event()));
});
test('2. Authenticated accounts without a profile have no access or self-enrollment', async () => {
  const db = database('unknown');
  await assertFails(get(ref(db, 'settings/institution')));
  await assertFails(set(ref(db, 'validations/new'), event('unknown')));
  await assertFails(set(ref(db, 'users/unknown'), { ...profile('ADMINISTRADOR'), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: 'unknown' }));
});
test('3. Inactive validators cannot write or read', async () => {
  const db = database('inactive');
  await assertFails(set(ref(db, 'validations/new'), event('inactive')));
  await assertFails(get(ref(db, 'users/inactive')));
});
test('4. Active validators append valid own events', async () => {
  const db = database('validator');
  await assertSucceeds(set(ref(db, 'validations/new'), event()));
  const result = await assertSucceeds(get(ref(db, 'validations/new')));
  assert.equal(result.val().userId, 'validator');
  assert.equal(typeof result.val().timestamp, 'number');
});
test('5. Validators cannot attribute events to another UID', async () => {
  await assertFails(set(ref(database('validator'), 'validations/new'), event('other')));
});
test('6. Existing validations cannot be modified, including by administrators', async () => {
  await assertFails(update(ref(database('validator'), 'validations/existing'), { folio: 'FORGED' }));
  await assertFails(update(ref(database('admin'), 'validations/existing'), { folio: 'FORGED' }));
});
test('7. Validations cannot be deleted', async () => {
  for (const uid of ['validator', 'admin']) await assertFails(remove(ref(database(uid), 'validations/existing')));
});
test('8. Supervisors cannot create administrators', async () => {
  await assertFails(set(ref(database('supervisor'), 'users/new'), { ...profile('ADMINISTRADOR'), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: 'supervisor' }));
});
test('9. Auditors cannot modify profiles, settings, validations, or audit logs', async () => {
  const db = database('auditor');
  await assertFails(update(ref(db, 'users/validator'), { firstName: 'Cambio', updatedAt: serverTimestamp() }));
  await assertFails(set(ref(db, 'validations/new'), event('auditor')));
  await assertFails(set(ref(db, 'auditLogs/new'), { ...audit(), actorUid: 'auditor' }));
  await assertFails(update(ref(db, 'settings/institution'), { name: 'Cambio', updatedAt: serverTimestamp(), updatedBy: 'auditor' }));
});
test('10. Administrators edit profiles and append an audit entry atomically', async () => {
  const db = database('admin');
  await assertSucceeds(update(ref(db), { 'users/validator/firstName': 'María', 'users/validator/updatedAt': serverTimestamp(), 'auditLogs/new': audit() }));
  assert.equal((await get(ref(db, 'users/validator/firstName'))).val(), 'María');
  await assertSucceeds(set(ref(db, 'users/new'), { ...profile(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: 'admin' }));
});
test('11. Users cannot change their own role or other profile fields', async () => {
  await assertFails(update(ref(database('validator'), 'users/validator'), { role: 'ADMINISTRADOR', updatedAt: serverTimestamp() }));
  await assertFails(update(ref(database('validator'), 'users/validator'), { firstName: 'Cambio', updatedAt: serverTimestamp() }));
});
test('12. Validators only read their profile and own events, and unknown paths are denied', async () => {
  const db = database('validator');
  await assertSucceeds(get(ref(db, 'users/validator')));
  await assertSucceeds(get(ref(db, 'validations/existing')));
  await assertSucceeds(get(own(db)));
  await assertFails(get(ref(db, 'users/other')));
  await assertFails(get(ref(db, 'validations/foreign')));
  await assertFails(get(own(db, 'other')));
  await assertFails(get(recent(db)));
  await assertFails(get(ref(db, 'settings/institution')));
  await assertFails(get(recent(db, 'auditLogs')));
  await assertFails(get(ref(database('admin'), 'unknown')));
  await assertFails(get(ref(database('admin'))));
});
test('Staff queries require the indexed order and bounded limit', async () => {
  for (const uid of ['admin', 'supervisor', 'auditor']) {
    const db = database(uid);
    await assertSucceeds(get(recent(db)));
    await assertSucceeds(get(recent(db, 'auditLogs')));
    await assertFails(get(ref(db, 'validations')));
    await assertFails(get(recent(db, 'validations', 501)));
    await assertFails(get(query(ref(db, 'validations'), limitToLast(500))));
    await assertFails(get(recent(db, 'auditLogs', 501)));
  }
  await assertFails(get(own(database('validator'), 'validator', 501)));
  await assertFails(get(query(ref(database('validator'), 'validations'), orderByChild('userId'), equalTo('validator'))));
});
test('Only administrators list profiles, with at most 200 results', async () => {
  const listing = (uid, count) => query(ref(database(uid), 'users'), orderByKey(), limitToFirst(count));
  await assertSucceeds(get(listing('admin', 200)));
  await assertFails(get(listing('admin', 201)));
  await assertFails(get(ref(database('admin'), 'users')));
  for (const uid of ['supervisor', 'auditor', 'validator']) await assertFails(get(listing(uid, 200)));
});
test('Validation schemas reject missing, extra, wrong type, oversized, invalid enum and incompatible fields', async () => {
  const invalid = [
    { folio: '' }, { folio: 'x'.repeat(81) }, { folio: 123 }, { reportedResult: 'approved' },
    { timestamp: 1 }, { timestamp: Date.now() + 60_000 }, { application: '' }, { appVersion: 'x'.repeat(41) },
    { documentType: 'unknown' }, { elementType: 'anticopia_remolque' }, { unexpected: 'data' },
  ];
  const db = database('validator');
  for (const [index, patch] of invalid.entries()) await assertFails(set(ref(db, `validations/bad${index}`), { ...event(), ...patch }));
  const missing = event();
  delete missing.reportedResult;
  await assertFails(set(ref(db, 'validations/missing'), missing));
  for (const [documentType, elementType] of [
    ['soporte_vehicular', 'anticopia_soporte'], ['engomado_vehicular', 'qr_vehicular'],
    ['engomado_vehicular', 'anticopia_vehicular'], ['engomado_vehicular', 'correlativa_vehicular'],
    ['engomado_remolque', 'anticopia_remolque'],
  ]) await assertSucceeds(set(ref(db, `validations/${elementType}`), { ...event(), documentType, elementType }));
});
test('Profile identity metadata is immutable and admin cannot deactivate, demote or delete self', async () => {
  const db = database('admin');
  for (const patch of [ { role: 'VALIDADOR' }, { status: 'inactive' }, { createdAt: 22 }, { createdBy: 'other' }, { unexpected: 'data' }, { email: 'invalid' }, { firstName: '' } ]) {
    await assertFails(update(ref(db, 'users/admin'), { ...patch, updatedAt: serverTimestamp() }));
  }
  await assertFails(remove(ref(db, 'users/admin')));
  await assertFails(remove(ref(db, 'users/validator')));
});
test('Audit entries are admin-only, actor-bound, schema-checked and append-only', async () => {
  const db = database('admin');
  await assertSucceeds(set(ref(db, 'auditLogs/new'), audit()));
  await assertFails(set(ref(db, 'auditLogs/spoof'), { ...audit(), actorUid: 'other' }));
  await assertFails(set(ref(db, 'auditLogs/extra'), { ...audit(), extra: true }));
  await assertFails(set(ref(db, 'auditLogs/old'), { ...audit(), timestamp: 1 }));
  await assertFails(set(ref(db, 'auditLogs/large'), { ...audit(), details: 'x'.repeat(1001) }));
  await assertFails(update(ref(db, 'auditLogs/existing'), { details: 'forged' }));
  await assertFails(remove(ref(db, 'auditLogs/existing')));
});
test('Settings are exact-schema, admin-write and staff-read', async () => {
  for (const uid of ['admin', 'supervisor', 'auditor']) await assertSucceeds(get(ref(database(uid), 'settings/institution')));
  const db = database('admin');
  await assertSucceeds(set(ref(db, 'settings/application'), { name: 'Verificador', updatedAt: serverTimestamp(), updatedBy: 'admin' }));
  await assertFails(set(ref(db, 'settings/application'), { name: 'Verificador', updatedAt: serverTimestamp(), updatedBy: 'other' }));
  await assertFails(set(ref(db, 'settings/unknown'), { name: 'X', updatedAt: serverTimestamp(), updatedBy: 'admin' }));
  await assertFails(update(ref(db, 'settings/institution'), { unknown: 'X' }));
  await assertFails(remove(ref(db, 'settings/institution')));
});
test('Deactivation revokes an already-authenticated client on its next operation', async () => {
  const validator = database('validator');
  await assertSucceeds(set(ref(validator, 'validations/before'), event()));
  await assertSucceeds(update(ref(database('admin'), 'users/validator'), { status: 'inactive', updatedAt: serverTimestamp() }));
  await assertFails(set(ref(validator, 'validations/after'), event()));
  await assertFails(get(ref(validator, 'validations/existing')));
});
test('Active users update only their own lastAccess using server time', async () => {
  const db = database('validator');
  await assertSucceeds(update(ref(db, 'users/validator'), { lastAccess: serverTimestamp() }));
  await assertFails(update(ref(db, 'users/other'), { lastAccess: serverTimestamp() }));
  await assertFails(update(ref(db, 'users/validator'), { lastAccess: 1 }));
  await assertFails(update(ref(db, 'users/validator'), { lastAccess: serverTimestamp(), role: 'ADMINISTRADOR' }));
  await assertFails(remove(ref(db, 'users/validator/lastAccess')));
  await assertFails(update(ref(database('inactive'), 'users/inactive'), { lastAccess: serverTimestamp() }));
});
