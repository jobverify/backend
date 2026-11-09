import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { CAREERS_URL, HOMEPAGE_URL, createLifeSignsScraper, hasOfficialHomepageSignal, hasOfficialCareersSignal } from './script.js'
import { createLSDevicesScraper, hasOfficialLegalIdentitySignal, LEGAL_URL } from '../lsdevicespltd/script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

// Only these three original HTML bodies are actual public responses. Changed
// HTML/metadata and role records below are explicitly controlled test inputs.
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-pages.json.gz', import.meta.url))))
const [home, careers, legal] = fixture.records.map(row => ({ ...row.receipt, html: Buffer.from(row.bodyBase64, 'base64').toString('utf8') }))
const sha = value => createHash('sha256').update(value).digest('hex')
const homeLegacyPhrase = home.html.replace('Predictive intelligence and continuous patient monitoring', 'Predictive intelligence and continuous monitoring')
assert.notEqual(homeLegacyPhrase, home.html)
const publicHeaders = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
}
const setup = (t, changes = {}) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init })
    if (url === LEGAL_URL) return { ok: true, status: 200, url, text: async () => legal.html }
    assert.ok(url === HOMEPAGE_URL || url === CAREERS_URL, 'no role, grant, feed or application request allowed in HTML-profile controls')
    assert.deepEqual(init, { headers: publicHeaders, redirect: 'follow' })
    const isHome = url === HOMEPAGE_URL, original = isHome ? home : careers
    const changed = changes[isHome ? 'home' : 'careers'] || {}
    return { status: changed.status ?? 200, url: changed.url ?? original.finalURL, text: async () => changed.html ?? original.html }
  })
  return calls
}
const stopAtFeed = async (t, changes = {}, delegated = false) => {
  const calls = setup(t, changes), stop = Object.freeze({ controlled: 'stop before any public guest grant or native role feed' })
  let feeds = 0
  const execute = () => createLifeSignsScraper().run({ fetchRoleItems: async () => { feeds++; throw stop } })
  await assert.rejects(delegated ? createLSDevicesScraper().run({ fetchLifeSignsJobs: execute }) : execute(), error => error === stop)
  assert.equal(feeds, 1)
  assert.deepEqual(calls.map(call => call.url), delegated ? [LEGAL_URL, HOMEPAGE_URL, CAREERS_URL] : [HOMEPAGE_URL, CAREERS_URL])
}

test('retained current public profile fixture contains all three exact original HTML bodies', () => {
  assert.equal(fixture.records.length, 3)
  for (const [row, url, bytes, digest] of [
    [home, HOMEPAGE_URL, 105237, '9a0774d54e5fbaa1b8198ffb2597868f8f1382d4f211e8c764f4badd43955f04'],
    [careers, CAREERS_URL, 81409, '80b464daf5d2d577da2c218e9096ea19b4c1875b407d6ab4465709cb1e18a66a'],
    [legal, LEGAL_URL, 63263, 'fb267ccff5821037ec6ae727b0fd08282aa2bd34c3241ad4bd54f1b4339965ca'],
  ]) {
    assert.equal(row.request.url, url); assert.equal(row.finalURL, url); assert.equal(row.status, 200)
    assert.equal(row.completeBody, true); assert.equal(Buffer.byteLength(row.html), bytes); assert.equal(sha(row.html), digest)
  }
})

test('actual current home and careers HTML reach the native feed boundary without claiming roles', async t => stopAtFeed(t))
test('actual current careers title independently passes after explicit synthetic single-word legacy-home control', async t => stopAtFeed(t, { home: { html: homeLegacyPhrase } }))
test('unchanged LS Devices legal prerequisite and delegation reach the same current feed boundary', async t => {
  assert.equal(hasOfficialLegalIdentitySignal(legal.html), true)
  await stopAtFeed(t, {}, true)
})

for (const title of ['Lifesigns | Intelligent patient monitoring for smarter decisions', 'AI Patient Monitoring System, Ambulance to Home | Lifesigns']) {
  test('previous controlled homepage profile remains accepted: ' + title, () => {
    assert.equal(hasOfficialHomepageSignal({ status: 200, url: HOMEPAGE_URL, title,
      text: 'AI-powered patient monitoring. Predictive intelligence and continuous monitoring.', links: ['/careers/'] }), true)
  })
}
const oldCareerText = "We challenge convention. See open roles. Explore our open roles. Didn't see the role you're looking for? Leave a message."
for (const title of ['Careers at Lifesigns | Challenge convention', 'Careers at Lifesigns | Challenge convention | Lifesigns']) {
  test('previous controlled careers profile remains accepted: ' + title, () => {
    assert.equal(hasOfficialCareersSignal({ status: 200, url: CAREERS_URL, title, text: oldCareerText }), true)
  })
}

const replaced = (value, pattern, replacement) => {
  const next = value.replace(pattern, replacement)
  assert.notEqual(next, value, 'negative must alter the actual original body')
  return next
}
for (const [name, changed] of [
  ['HTTP403', { status: 403 }],
  ['foreign same-path authority', { url: 'https://unrelated.invalid/' }],
  ['foreign title', { html: replaced(home.html, /<title[^>]*>[\s\S]*?<\/title>/i, '<title>Unrelated Company Careers</title>') }],
  ['missing required AI phrase', { html: replaced(home.html, /AI-powered /g, 'Unreviewed device ') }],
  ['unreviewed monitoring phrase', { html: replaced(home.html, /predictive intelligence and continuous patient monitoring/gi, 'Predictive intelligence and intermittent clinical monitoring') }],
  ['foreign career handoff', { html: replaced(home.html, /href=(["'])(?:https:\/\/www\.lifesigns\.us)?\/careers\/?\1/gi, 'href="https://unrelated.invalid/careers/"') }],
]) test('current homepage profile still rejects ' + name + ' before later reads', async t => {
  const calls = setup(t, { home: changed }); let feeds = 0
  await assert.rejects(createLifeSignsScraper().run({ fetchRoleItems: async () => { feeds++; throw Error('must not reach feed') } }), /homepage no longer matches/)
  assert.deepEqual(calls.map(call => call.url), [HOMEPAGE_URL]); assert.equal(feeds, 0)
})

for (const [name, changed] of [
  ['HTTP404', { status: 404 }],
  ['foreign same-path authority', { url: 'https://unrelated.invalid/careers/' }],
  ['nearby unreviewed title', { html: replaced(careers.html, /<title[^>]*>[\s\S]*?<\/title>/i, '<title>Careers at Lifesigns | Healthcare &amp; Jobs</title>') }],
  ['missing open-role text', { html: replaced(careers.html, /see open roles/gi, 'View opportunities') }],
  ['missing contact text', { html: replaced(careers.html, /leave a message/gi, 'Contact the team') }],
]) test('current careers profile still rejects ' + name + ' before the feed', async t => {
  // Synthetic single-word legacy-home change isolates the careers guard.
  const calls = setup(t, { home: { html: homeLegacyPhrase }, careers: changed }); let feeds = 0
  await assert.rejects(createLifeSignsScraper().run({ fetchRoleItems: async () => { feeds++; throw Error('must not reach feed') } }), /careers page no longer matches/)
  assert.deepEqual(calls.map(call => call.url), [HOMEPAGE_URL, CAREERS_URL]); assert.equal(feeds, 0)
})

test('current profile does not turn a controlled city-only role or legal brand statement into India or complete inventory', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-07T08:00:00.000Z') })
  const calls = [], rawCriteria = 'CONTROLLED UNIT CRITERIA: build and maintain medical-device software, review requirements, test reliability, and document the work.'
  // This is synthetic role data, not a current public native response or model.
  const item = { id: 'controlled-native-id', dataCollectionId: 'OpenRoles', data: { slug: 'controlled-role', title: 'Controlled Role', location: 'Chennai', employmentType: 'Full-Time', _publishDate: '2026-09-15T00:00:00.000Z', body: { nodes: [{ textData: { text: rawCriteria } }] } } }
  const roleSnapshot = { status: 200, url: 'https://www.lifesigns.us/careers/controlled-role/', title: 'Controlled Role | Lifesigns' }
  // These explicit snapshots and the role feed are synthetic unit inputs;
  // the earlier tests separately exercise genuine HTML through the default parser.
  const jobs = await createLifeSignsScraper().run({
    fetchPageSnapshot: async url => {
      calls.push(url)
      if (url === roleSnapshot.url) return roleSnapshot
      // Use the two actual raw HTML responses through a separate default run
      // above; these profile fields are explicit current unit declarations.
      if (url === HOMEPAGE_URL) return { status: 200, url, title: 'AI Patient Monitoring System, Ambulance to Home | Lifesigns', text: 'AI-powered patient monitoring. Predictive intelligence and continuous patient monitoring.', links: ['/careers/'] }
      assert.equal(url, CAREERS_URL)
      return { status: 200, url, title: 'Careers at Lifesigns | Healthcare AI &amp; Technology Jobs', text: oldCareerText }
    }, fetchRoleItems: async () => [item],
  })
  assert.deepEqual(calls, [HOMEPAGE_URL, CAREERS_URL, roleSnapshot.url]); assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, null); assert.equal(jobs[0].location, null); assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].nativeGeographyQualified, false); assert.equal(jobs[0].rawNativeWorkplaceEvidence.roleLocation, 'Chennai')
  assert.equal(jobs[0].jobDescription, rawCriteria); assert.equal(jobs[0].postingDate, item.data._publishDate)
  assert.equal(jobs[0].requisitionId, item.id); assert.equal(Object.hasOwn(jobs[0], 'nativeLegalEmployer'), false)
  assert.equal(jobs[0].sourceScopeComplete, false); assert.equal(jobs[0].sourceListingComplete, false); assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap'); assert.equal(evidence.listingComplete, false); assert.equal(evidence.reportedTotal, null); assert.equal(evidence.indiaFacetCount, null)
})
