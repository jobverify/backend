import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { compareHyperscienceServerFormCriteria } from '../scraper/hyperscience/serverFormCriteriaComparison.js';

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/hyperscience-server-form-criteria-originals-20261111.json.gz', import.meta.url))));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const input = () => ({
  requestBody: Buffer.from(fixture.request.bodyBase64, 'base64'),
  opening: { body: Buffer.from(fixture.responses[0].bodyBase64, 'base64'), receipt: structuredClone(fixture.responses[0].receipt) },
  closing: { body: Buffer.from(fixture.responses[1].bodyBase64, 'base64'), receipt: structuredClone(fixture.responses[1].receipt) },
});

test('portable fixture preserves two genuine separately clocked originals, not an acquired closing', () => {
  const value = input();
  assert.equal(sha(value.requestBody), '26301b880ec3355a303c0431fa61fdc78c804d4d3964711771061c44876e51a8');
  assert.equal(value.requestBody.length, 1983);
  assert.equal(sha(value.opening.body), '5f3d2a629d35c05d6f08e9bcd0f2450aa38e634a7436fffbc1f49e5b8e47320f');
  assert.equal(sha(value.closing.body), '6a6910c09941f358c17a17aa36a04b51163d55746cc0561219e58aff21652fdb');
  assert.equal(fixture.genuineAcquiredClosing, false);
  assert.equal(fixture.coherentProgrammeInterval, false);
  assert.equal(fixture.elapsedBetweenRequestsMs, 1443534);
  assert.equal(value.opening.body.equals(value.closing.body), false);
});

test('different genuine original IDs preserve exact server definition and criteria without raw equality or currentness', () => {
  const value = input();
  const result = compareHyperscienceServerFormCriteria(value);
  assert.equal(result.rawEntityEqual, false);
  assert.equal(result.serverDefinitionCriteriaEqual, true);
  assert.equal(result.comparisonProfile, 'hyperscience-server-form-criteria-v2');
  assert.equal(result.scope, 'comparison-only-server-purpose-definition-criteria');
  for (const key of ['interactiveIdentityQualified', 'actionValidityOrInterchangeabilityQualified',
    'UIOrApplicationEquivalent', 'sideEffectFreeInitializationQualified', 'sourceTimeSemanticsQualified',
    'programmeOrCurrentnessQualified', 'globalScopeQualified', 'lifecycleCleanupAllowed']) assert.equal(result[key], false, key);
  assert.equal(result.workCountry, null);
  assert.equal(result.applicantCountry, null);
  assert.equal(result.rawHeaderViewsEqual, false);
  assert.equal(result.securityProfileEqual, true);
  for (const side of ['opening', 'closing']) {
    assert.equal(result[side].bodyBase64, value[side].body.toString('base64'));
    assert.deepEqual(result[side].receipt, value[side].receipt);
    assert.deepEqual(result[side].model, JSON.parse(value[side].body));
    assert.equal(result[side].tokens.length, 12);
    assert.equal(result[side].complements.reduce((sum, row) => sum + row.bytes, 0), 7633);
    assert.equal(result[side].model.data.sourcingForm.sourcingFormRender.sections[0].fieldEntries.every(row => row.fieldValue === null && row.isHidden === null), true);
  }
});

const render = model => model.data.sourcingForm.sourcingFormRender;
const form = model => model.data.sourcingForm;
const entries = model => render(model).sections[0].fieldEntries;
function setBody(value, side, bytes) {
  value[side].body = Buffer.from(bytes);
  value[side].receipt.bodyBytes = bytes.length;
  value[side].receipt.bodySHA256 = sha(bytes);
}
function mutateModel(value, side, edit) {
  const before = value[side].body;
  const model = JSON.parse(before);
  assert.equal(JSON.stringify(model), before.toString('utf8'), 'Actual packet reserialization calibration');
  edit(model);
  const after = Buffer.from(JSON.stringify(model));
  assert.equal(after.equals(before), false, 'Synthetic control must change actual bytes');
  setBody(value, side, after);
}
function setHeader(record, name, content) {
  record.receipt.headers[name] = content;
  if (Object.hasOwn(record.receipt, 'responseHeaders')) record.receipt.responseHeaders[name] = content;
  record.receipt.headerEntries = Object.entries(record.receipt.headers).sort(([a], [b]) => a.localeCompare(b));
}
function hold(value, gate) {
  assert.throws(() => compareHyperscienceServerFormCriteria(value), error =>
    error.code === 'HYPERSCIENCE_FORM_COMPARISON_HOLD' && error.gate === gate,
  `Expected intended ${gate} HOLD`);
}

test('same genuine response reports raw equality while preserving null fields and no authority', () => {
  const value = input();
  value.closing = { body: Buffer.from(value.opening.body), receipt: structuredClone(value.opening.receipt) };
  const result = compareHyperscienceServerFormCriteria(value);
  assert.equal(result.rawEntityEqual, true);
  assert.equal(result.rawHeaderViewsEqual, true);
  assert.equal(result.serverDefinitionCriteriaEqual, true);
  assert.equal(result.programmeOrCurrentnessQualified, false);
});

test('independent new canonical IDs bind all own entries and remain meaningful original IDs', () => {
  const value = input();
  mutateModel(value, 'closing', model => {
    render(model).id = '00000000-0000-4000-8000-000000000001';
    render(model).formControls[0].identifier = '00000000-0000-4000-8000-000000000002';
    for (const row of entries(model)) row.id = `${render(model).id}_${row.field.path}`;
  });
  const result = compareHyperscienceServerFormCriteria(value);
  assert.equal(result.rawEntityEqual, false);
  assert.equal(result.closing.identifiers.renderId, '00000000-0000-4000-8000-000000000001');
  assert.equal(result.closing.identifiers.actionIdentifier, '00000000-0000-4000-8000-000000000002');
  assert.equal(result.closing.identifiers.entryIds[0], '00000000-0000-4000-8000-000000000001__systemfield_name');
});

for (const [name, replacement] of [
  ['uppercase', '59B446BD-98E7-4FDE-847D-DD2F11D5AE04'],
  ['wrong version', '59b446bd-98e7-3fde-847d-dd2f11d5ae04'],
  ['wrong variant', '59b446bd-98e7-4fde-747d-dd2f11d5ae04'],
  ['truncated', '59b446bd-98e7-4fde-847d-dd2f11d5ae0'],
  ['trailing bytes', '59b446bd-98e7-4fde-847d-dd2f11d5ae04 '],
]) test(`synthetic ${name} render UUID holds before baseline comparison`, () => {
  const value = input();
  mutateModel(value, 'opening', model => { render(model).id = replacement; });
  hold(value, 'uuid');
});

for (const [name, edit, gate] of [
  ['malformed independent action', model => { render(model).formControls[0].identifier = 'not-a-uuid'; }, 'uuid'],
  ['action equal render', model => { render(model).formControls[0].identifier = render(model).id; }, 'identity'],
  ['render collision with stable organization', model => { render(model).id = form(model).organizationId; }, 'identity'],
  ['action collision with native field', model => { render(model).formControls[0].identifier = entries(model)[0].field.id; }, 'identity'],
  ['action collision with native path', model => { render(model).formControls[0].identifier = entries(model)[2].field.path; }, 'identity'],
  ['other snapshot entry prefix', model => { entries(model)[0].id = '559503a3-7639-4ed3-8248-b42363d54de7__systemfield_name'; }, 'binding'],
  ['action entry prefix', model => { entries(model)[0].id = `${render(model).formControls[0].identifier}__systemfield_name`; }, 'binding'],
  ['missing double underscore', model => { entries(model)[0].id = `${render(model).id}_systemfield_name`; }, 'binding'],
  ['truncated entry suffix', model => { entries(model)[2].id = entries(model)[2].id.slice(0, -1); }, 'binding'],
  ['duplicate entry ID', model => { entries(model)[1].id = entries(model)[0].id; }, 'binding'],
  ['reordered native fields', model => { entries(model).reverse(); }, 'identity'],
  ['new native path', model => { entries(model)[2].field.path = '00000000-0000-4000-8000-000000000009'; }, 'identity'],
  ['changed native field ID', model => { entries(model)[0].field.id = '00000000-0000-4000-8000-000000000009'; }, 'identity'],
  ['changed form ID', model => { form(model).id = '00000000-0000-4000-8000-000000000009'; }, 'identity'],
  ['changed source definition', model => { render(model).sourceFormDefinitionId = '00000000-0000-4000-8000-000000000009'; }, 'identity'],
  ['wrong token type', model => { render(model).id = null; }, 'slots'],
]) test(`synthetic ${name} holds at its independent qualification gate`, () => {
  const value = input();
  mutateModel(value, 'opening', edit);
  hold(value, gate);
});

for (const [name, edit] of [
  ['new envelope field', model => { model.extensions = {}; }],
  ['new schema typename', model => { render(model).__typename = 'OtherRender'; }],
  ['hidden null becomes false', model => { entries(model)[0].isHidden = false; }],
  ['non-null personal field value', model => { entries(model)[0].fieldValue = { value: 'synthetic-only' }; }],
  ['required question becomes optional', model => { entries(model)[0].isRequired = false; }],
  ['changed field type', model => { entries(model)[0].field.type = 'LongText'; }],
  ['changed metadata', model => { entries(model)[0].field.metadata = { syntheticRequiredCondition: true }; }],
  ['new native field', model => { entries(model).push(structuredClone(entries(model)[0])); }],
  ['second section', model => { render(model).sections.push(structuredClone(render(model).sections[0])); }],
  ['second control', model => { render(model).formControls.push(structuredClone(render(model).formControls[0])); }],
  ['control title', model => { render(model).formControls[0].title = 'Apply'; }],
  ['errors', model => { render(model).errorMessages.push('Unavailable'); }],
  ['current vacancy purpose', model => { form(model).descriptionHeaderHtml += '<p>This is a current vacancy.</p>'; }],
  ['new work country criterion', model => { form(model).descriptionHeaderHtml += '<p>Work country: India.</p>'; }],
  ['future-role question changed', model => { entries(model)[3].field.title = 'What current role are you applying for?'; }],
  ['select options removed', model => { entries(model)[2].field.selectableValues = []; }],
  ['archived absence changed', model => { entries(model)[0].field.isArchived = false; }],
  ['current-location description changed', model => { entries(model)[4].descriptionHtml = '<p>Work country</p>'; }],
  ['full notices removed', model => { form(model).descriptionFooterHtml = ''; }],
  ['submit text changed', model => { form(model).submitButtonText = 'Apply now'; }],
  ['autofill changed', model => { form(model).showAutofillBox = false; }],
  ['brand changed', model => { form(model).organizationBrand.hostedJobsPageSlug = 'other'; }],
]) test(`symmetric synthetic ${name} cannot qualify by pair agreement`, () => {
  const value = input();
  mutateModel(value, 'opening', edit);
  mutateModel(value, 'closing', edit);
  hold(value, 'baseline');
});

for (const [name, transform, gate] of [
  ['escaped render', text => text.replace('59b446bd', '\\u00359b446bd'), 'uuid'],
  ['escaped entry underscore', text => text.replace('__systemfield_name"', '\\u005f_systemfield_name"'), 'binding'],
  ['duplicate semantic id', text => text.replace('"id":"0f6b6d84', '"id":"shadow","id":"0f6b6d84'), 'json-duplicate'],
  ['escaped duplicate key', text => text.replace('"id":"0f6b6d84', '"\\u0069d":"shadow","id":"0f6b6d84'), 'json-duplicate'],
  ['space outside tokens', text => ` ${text}`, 'baseline'],
  ['non-slot escaping', text => text.replace('Talent Community ', 'Talent\\u0020Community '), 'baseline'],
  ['key order', text => text.replace('"id":"0f6b6d84-8ea5-4955-b8f8-5b4b7312eaaf","organizationId":"6ee4479e-f868-4423-83db-242e14f71b39"', '"organizationId":"6ee4479e-f868-4423-83db-242e14f71b39","id":"0f6b6d84-8ea5-4955-b8f8-5b4b7312eaaf"'), 'baseline'],
  ['trailing JSON', text => `${text}{}`, 'json-syntax'],
  ['JSON comment', text => `${text}//comment`, 'json-syntax'],
  ['UTF8 BOM', text => `\ufeff${text}`, 'utf8'],
  ['format character', text => text.replace('Talent Community ', 'Talent\u200bCommunity '), 'baseline'],
]) test(`synthetic ${name} is not erased by parsing or serialization`, () => {
  const value = input();
  const before = value.opening.body.toString('utf8');
  const after = transform(before);
  assert.notEqual(after, before, 'Actual mutation reaches the reader');
  setBody(value, 'opening', Buffer.from(after));
  hold(value, gate);
});

for (const [name, bytes, gate] of [
  ['invalid UTF8', Buffer.from([0xc3, 0x28]), 'utf8'],
  ['depth65', Buffer.from('['.repeat(65) + '0' + ']'.repeat(65)), 'json-depth'],
  ['more than50000 lexical tokens', Buffer.from(JSON.stringify(Array(25001).fill(null))), 'json-tokens'],
  ['larger than4MiB', Buffer.alloc(4 * 1024 * 1024 + 1, 32), 'ownership'],
]) test(`synthetic ${name} is bounded before baseline qualification`, () => {
  const value = input();
  setBody(value, 'opening', bytes);
  hold(value, gate);
});

for (const [name, edit] of [
  ['changed request bytes', value => { value.requestBody = Buffer.concat([value.requestBody, Buffer.from(' ')]); }],
  ['numeric optional input', value => { const request = JSON.parse(value.requestBody); request.variables.sourcingFormId = 1; value.requestBody = Buffer.from(JSON.stringify(request)); }],
]) test(`synthetic ${name} cannot change the frozen public query`, () => {
  const value = input(); edit(value); hold(value, 'request');
});

for (const [name, edit, gate] of [
  ['wrong method', row => { row.receipt.method = 'GET'; }, 'transport'],
  ['wrong requestedURL', row => { row.receipt.requestedURL += '&other=1'; }, 'transport'],
  ['wrong finalURL', row => { row.receipt.finalURL = 'https://foreign.example/'; }, 'transport'],
  ['non200', row => { row.receipt.status = 403; }, 'transport'],
  ['incomplete entity', row => { row.receipt.bodyComplete = false; }, 'transport'],
  ['prefix only', row => { row.receipt.decodedPrefixOnly = true; }, 'transport'],
  ['stream incomplete', row => { row.receipt.streamDone = false; }, 'transport'],
  ['body hash contradiction', row => { row.receipt.bodySHA256 = '0'.repeat(64); }, 'transport'],
  ['body length contradiction', row => { row.receipt.bodyBytes--; }, 'transport'],
  ['request hash contradiction', row => { row.receipt.requestBodySHA256 = '0'.repeat(64); }, 'transport'],
  ['credential change', row => { row.receipt.credentials = 'include'; }, 'transport'],
  ['cookie supplied', row => { row.receipt.requestHeaders.Cookie = 'synthetic'; }, 'transport'],
  ['missing actual header entries', row => { delete row.receipt.headerEntries; }, 'security'],
  ['header view contradiction', row => { row.receipt.headers['x-frame-options'] = 'SAMEORIGIN'; }, 'security'],
  ['bad chronology', row => { row.receipt.completedAt = row.receipt.requestedAt; }, 'transport'],
]) test(`synthetic ${name} holds on its actual record`, () => {
  const value = input(); edit(value.opening); hold(value, gate);
});

for (const [name, content] of [
  ['content-type', 'application/json; charset=utf-16le'],
  ['content-security-policy', "default-src 'none'"],
  ['content-security-policy-report-only', "default-src 'none'"],
  ['permissions-policy', 'geolocation=()'], ['document-policy', 'force-load-at-top'],
  ['cross-origin-opener-policy', 'same-origin'], ['cross-origin-embedder-policy', 'require-corp'],
  ['cross-origin-resource-policy', 'same-origin'], ['access-control-allow-credentials', 'true'],
  ['access-control-allow-origin', 'https://foreign.example'], ['location', 'https://foreign.example'],
  ['refresh', '0;url=https://foreign.example'], ['content-disposition', 'attachment'],
  ['www-authenticate', 'Basic'], ['set-cookie', 'synthetic=1'], ['cf-mitigated', 'challenge'],
  ['cf-chl-out', '1'], ['cf-chl-bypass', '1'], ['x-captcha', '1'],
  ['x-captcha-required', '1'], ['x-challenge', '1'], ['x-frame-options', 'SAMEORIGIN'],
]) test(`symmetric synthetic ${name} cannot become a trusted initial policy`, () => {
  const value = input();
  setHeader(value.opening, name, content); setHeader(value.closing, name, content);
  hold(value, 'security');
});

test('GraphQL errors do not become an empty or matching form', () => {
  const value = input();
  mutateModel(value, 'opening', model => { model.errors = [{ message: 'Unavailable' }]; });
  hold(value, 'baseline');
});

for (const [name, mutate] of [
  ['caller profile', value => { value.profile = true; }],
  ['caller spans', value => { value.spans = []; }],
  ['parsed-only record', value => { value.opening = { model: JSON.parse(value.opening.body), receipt: value.opening.receipt }; }],
]) test(`synthetic ${name} supplies no authority`, () => {
  const value = input(); mutate(value); hold(value, 'ownership');
});

for (const site of ['options', 'record', 'receipt', 'headers', 'entries', 'request', 'body']) {
  test(`proxy ${site} is rejected without traps`, () => {
    let calls = 0;
    let value = input();
    const wrap = object => new Proxy(object, { get() { calls++; throw new Error('trap'); }, ownKeys() { calls++; throw new Error('trap'); }, getPrototypeOf() { calls++; throw new Error('trap'); } });
    if (site === 'options') value = wrap(value);
    if (site === 'record') value.opening = wrap(value.opening);
    if (site === 'receipt') value.opening.receipt = wrap(value.opening.receipt);
    if (site === 'headers') value.opening.receipt.headers = wrap(value.opening.receipt.headers);
    if (site === 'entries') value.opening.receipt.headerEntries = wrap(value.opening.receipt.headerEntries);
    if (site === 'request') value.requestBody = wrap(value.requestBody);
    if (site === 'body') value.opening.body = wrap(value.opening.body);
    hold(value, 'ownership'); assert.equal(calls, 0);
  });
}

for (const key of ['body', 'receipt', 'headers', 'headerEntries', 'toJSON']) test(`own accessor ${key} never executes`, () => {
  let calls = 0;
  const value = input();
  const target = key === 'body' || key === 'receipt' ? value.opening : value.opening.receipt;
  Object.defineProperty(target, key, { enumerable: true, get() { calls++; throw new Error('getter'); } });
  hold(value, 'ownership'); assert.equal(calls, 0);
});

for (const key of ['length', 'byteLength', 'buffer', 'byteOffset', 'constructor', 'valueOf', 'toString', 'toJSON', Symbol.species, Symbol.toPrimitive]) {
  test(`untrusted byte ${String(key)} hook cannot hide appended bytes or execute`, () => {
    let calls = 0;
    const value = input();
    const original = value.opening.body;
    const bytes = new Uint8Array(Buffer.concat([original, Buffer.from('\n;newCriterion=true;')]));
    Object.defineProperty(bytes, key, { get() { calls++; throw new Error('byte hook'); } });
    value.opening.body = bytes;
    hold(value, 'ownership'); assert.equal(calls, 0);
  });
}

test('inherited conversion cannot hide appended bytes', () => {
  let calls = 0;
  const value = input();
  const bytes = new Uint8Array(Buffer.concat([value.opening.body, Buffer.from(' true')]));
  Object.setPrototypeOf(bytes, { valueOf() { calls++; return value.opening.body; } });
  value.opening.body = bytes;
  hold(value, 'transport'); assert.equal(calls, 0);
});

test('shared mutable buffers are held even when content is genuine', () => {
  const value = input();
  const bytes = new Uint8Array(new SharedArrayBuffer(value.opening.body.length));
  bytes.set(value.opening.body); value.opening.body = bytes;
  hold(value, 'ownership');
});

test('cross-realm plain Uint8Array is copied intrinsically and input/output never alias', () => {
  const value = input();
  const originalBody = Buffer.from(value.opening.body);
  const originalReceipt = structuredClone(value.opening.receipt);
  value.opening.body = vm.runInNewContext('new Uint8Array(bytes)', { bytes: Array.from(originalBody) });
  const result = compareHyperscienceServerFormCriteria(value);
  assert.equal(result.serverDefinitionCriteriaEqual, true);
  assert.equal(result.opening.bodySHA256, sha(originalBody));
  result.opening.receipt.headers.date = 'changed';
  result.opening.model.data.sourcingForm.publicTitle = 'changed';
  assert.deepEqual(value.opening.receipt, originalReceipt);
  assert.deepEqual(Buffer.from(value.opening.body), originalBody);
  value.opening.body[0] = 0;
  value.closing.receipt.headers.date = 'changed';
  assert.equal(result.opening.bodyBase64, originalBody.toString('base64'));
  assert.equal(result.closing.receipt.headers.date, fixture.responses[1].receipt.headers.date);
  assert.doesNotThrow(() => JSON.stringify(result));
});
