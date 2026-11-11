import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-astro-20261111.json.gz', import.meta.url))))
const HOME = 'https://calendly.com/careers'
const FEED = 'https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true'
const BOARD = 'https://job-boards.greenhouse.io/calendly'
const ID = 8846049002
const ROLE = BOARD + '/jobs/' + ID
const INDEX = 'https://calendly.com/_astro/index.Ca3DqKKy.js'
const ISLAND = 'https://calendly.com/_astro/islands.Ch1etlMm.js'
const COMPONENT = 'https://calendly.com/_astro/src.DLYuXCKx.js'
const VARIANT_ID = 8728555002
const VARIANT_ROLE = BOARD + '/jobs/' + VARIANT_ID
const captures = new Map()
for (const row of fixture.responses) {
  const bytes = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256)
  captures.set(row.phase + ':' + row.url, { ...row, html: bytes.toString('utf8') })
}
const replay = (change = (_, packet) => packet) => {
  const calls = [], counts = new Map()
  const packet = (url, init = {}) => {
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count); calls.push({ url, init, count })
    const captured = captures.get((count > 1 ? 'closing:' : 'opening:') + url)
    assert.ok(captured, 'No invented public endpoint: ' + url)
    return change(url, { ...captured }, count)
  }
  return { calls, options: {
    fetchImpl: async (url, init) => {
      const value = packet(url, init)
      const response = new Response(value.html, { status: value.status, headers: { 'content-type': value.contentType } })
      Object.defineProperty(response, 'url', { value: value.finalURL })
      return response
    },
    // The old exported run ignores fetchImpl. Replay its actual current
    // publisher gate as well, so RED demonstrates the real source failure.
    fetchText: async url => packet(url).html,
    fetchJson: async url => JSON.parse(packet(url).html),
    now: () => '2026-11-11T04:04:00.000Z',
  } }
}
const changeFeed = mutate => (url, packet) => {
  if (url !== FEED) return packet
  const payload = JSON.parse(packet.html); mutate(payload)
  return { ...packet, html: JSON.stringify(payload) }
}
const editLoader = (html, mutate) => {
  const match = /window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html)
  assert.ok(match, 'Actual native JSON-only Remix loader is required by this control')
  const model = JSON.parse(match[1]); mutate(model.state.loaderData)
  return html.replace(match[1], JSON.stringify(model))
}

test('the current complete declared public program proves India zero while preserving seven real foreign roles and all original evidence', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Native fixture test forbids uncontrolled HTTP'))
  const r = replay(), jobs = await run(r.options), evidence = readInventoryEvidence(jobs)
  assert.deepEqual(jobs, [])
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 7)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(isVerifiedEmptyEvidence(evidence), false, 'Seven foreign roles are not an empty board')
  assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: '2026-11-11T04:04:00.000Z' }), true)
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.observedNativeRecordCount, 7)
  assert.equal(audit.nativeReportedTotal, 7)
  assert.equal(audit.currentDeclaredSourceProgramComplete, true)
  assert.equal(audit.companyGlobalScopeQualified, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.roles.length, 7)
  for (const role of audit.roles) {
    assert.equal(role.employer, 'Calendly')
    assert.equal(role.legalEmployer, null)
    assert.equal(role.country, 'United States')
    assert.equal(role.fullCriteriaOutsideStructuredPayRangesExact, true)
    assert.equal(role.currentApplicationAction, true)
    assert.equal(role.closingFullRoleUnchanged, true)
    assert.equal(role.sourceNativeRecord.content.length > 1000, true)
    assert.equal(role.sourceNativeRecord.first_published, JSON.parse(captures.get('opening:' + FEED).html).jobs.find(job => job.id === role.id).first_published)
    assert.equal(role.sourceNativeRecord.application_deadline, null)
    assert.ok(role.sourceNativeRecord.content.includes('&amp;mdash;'), 'Original API salary separator must remain unchanged')
    assert.ok(role.sourceNativeDescriptionText.includes(' — '))
    assert.ok(role.sourcePublicDescriptionText.includes(' - '))
    for (const interval of role.salaryIntervals) assert.equal(interval.endpointsAndCurrencyExact, true)
  }
  assert.equal(r.calls.length, 26)
  assert.ok(r.calls.every(call => call.init.method === 'GET' && call.init.credentials === 'omit'))
  assert.ok(r.calls.filter(call => call.count === 2).every(call => call.init.cache === 'no-store'))
})

for (const [name, mutate, expected] of [
  ['a native unknown country', payload => { payload.jobs[0].location.name = 'Remote'; payload.jobs[0].offices = [] }, /country|scope/i],
  ['an unqualified new India role', payload => { payload.jobs[0].location.name = 'Remote - IN'; payload.jobs[0].offices = [] }, /India|positive|country/i],
  ['a conflicting native office country', payload => { payload.jobs[0].offices[0].location = 'Mumbai, Maharashtra, India' }, /country|contradictory/i],
  ['an unrelated native employer', payload => { payload.jobs[0].company_name = 'Other Employer' }, /employer|company/i],
  ['a missing full native criterion', payload => { payload.jobs[0].content = '' }, /criteria|description|content/i],
  ['a false native total', payload => { payload.meta.total = 8 }, /total|count|inventory/i],
  ['a duplicate native identity', payload => { payload.jobs[1] = structuredClone(payload.jobs[0]) }, /identity|duplicate|inventory/i],
  ['an unreviewed native continuation', payload => { payload.next = 'https://other.example/jobs' }, /pagination|continuation|model|inventory/i],
  ['an unreviewed primary typed country', payload => { payload.jobs[0].location.country = 'India' }, /country|location|model/i],
  ['an unreviewed office typed country', payload => { payload.jobs[0].offices[0].country = 'India' }, /country|office|model/i],
  ['unresolved native office descendants', payload => { payload.jobs[0].offices[0].child_ids = [99999] }, /country|office|scope|model/i],
  ['unresolved native office ancestry', payload => { payload.jobs[0].offices[0].parent_id = 99999 }, /country|office|scope|model/i],
  ['an unreviewed metadata country', payload => { payload.jobs[0].metadata[0].country = 'India' }, /country|metadata|model/i],
  ['an impossible original publication date', payload => { payload.jobs[0].first_published = '2026-02-30T11:12:27-04:00' }, /date|calendar|publication/i],
]) test('withholds zero for ' + name, async () => {
  const r = replay(changeFeed(mutate))
  await assert.rejects(run(r.options), expected)
})

test('a new corporate recruitment program is an unresolved source change', async () => {
  const r = replay((url, packet) => url === HOME ? { ...packet, html: packet.html.replace('</body>', '<a href="https://jobs.other.example/current">Additional open roles</a></body>') } : packet)
  await assert.rejects(run(r.options), /program|declaration|publisher|scope/i)
})

test('an inert corporate careers island cannot authorize the native account', async () => {
  const r = replay((url, packet) => url === HOME ? { ...packet, html: packet.html.replace('component-export="CareersHubIsland"', 'hidden component-export="CareersHubIsland"') } : packet)
  await assert.rejects(run(r.options), /program|declaration|publisher|island/i)
})

test('the native board must retain its current active reciprocal corporate careers handoff', async () => {
  const r = replay((url, packet) => url === BOARD ? { ...packet,
    html: packet.html.replaceAll('href="https://calendly.com/careers"', 'hidden href="https://calendly.com/careers"') } : packet)
  await assert.rejects(run(r.options), /reciprocal|employer|identity/i)
})

const firstBoardCard = (html, mutate) => {
  const card = html.match(/<tr class="job-post">[\s\S]*?<\/tr>/)?.[0]
  assert.ok(card, 'Actual current native job-post row is required by this control')
  return html.replace(card, mutate(card))
}
for (const [name, mutate] of [
  ['an explicit India primary card location', card => card.replace('Remote - US', 'Remote - IN')],
  ['an unknown primary card country', card => card.replace('Remote - US', 'Remote')],
  ['a different visible card title with the same ID', card => card.replace('Senior Full Stack Engineer, Website Development', 'Different title for the same native ID')],
  ['additional own-card India metadata', card => card.replace('</a>', '<p class="body body__secondary">Mumbai, India</p></a>')],
  ['an additional unlinked India role card', card => card + '<tr class="job-post"><td><p class="body body--medium">Additional public role</p><p class="body body__secondary">Mumbai, India</p></td></tr>'],
]) test('withholds zero when every native board snapshot consistently declares ' + name, async () => {
  const r = replay((url, packet) => url === BOARD ? { ...packet, html: firstBoardCard(packet.html, mutate) } : packet)
  await assert.rejects(run(r.options), /board|card|country|location|inventory/i)
})

test('closing native board card country changes withhold every staged zero observation', async () => {
  const r = replay((url, packet, count) => url === BOARD && count === 2 ? { ...packet,
    html: firstBoardCard(packet.html, card => card.replace('Remote - US', 'Remote - IN')) } : packet)
  await assert.rejects(run(r.options), /board|card|country|location|inventory/i)
})

for (const url of [INDEX, ISLAND, COMPONENT]) test('changed current declared renderer refuses the zero proof: ' + url, async () => {
  const r = replay((current, packet) => current === url ? { ...packet, html: packet.html + '\n// unreviewed active source code' } : packet)
  await assert.rejects(run(r.options), /renderer|client|program/i)
})

test('full own-role punctuation outside the known pay-range separator is never erased', async () => {
  const r = replay((url, packet) => url === ROLE ? { ...packet, html: packet.html.replace('What’s in it for you?', 'What’s in it for you!') } : packet)
  await assert.rejects(run(r.options), /criteria|description/i)
})

test('a changed salary endpoint cannot pass the structural interval reconciliation', async () => {
  const r = replay((url, packet) => url === ROLE ? { ...packet, html: packet.html.replaceAll('$224,400', '$224,401') } : packet)
  await assert.rejects(run(r.options), /salary|interval|criteria/i)
})

test('a live native access denial cannot become zero', async () => {
  const r = replay((url, packet) => url === ROLE ? { ...packet, status: 403, html: 'Forbidden' } : packet)
  await assert.rejects(run(r.options), error => error.status === 403 && error.failureKind === 'blocked_or_access_denied')
})

for (const [name, url, replace] of [
  ['publisher', HOME, html => html + '<a href="https://other.example/jobs">Other current program</a>'],
  ['renderer', ISLAND, html => html + '\nchanged()'],
  ['board', BOARD, html => html.replace('/jobs/' + ID, '/jobs/999999')],
  ['feed', FEED, html => { const payload = JSON.parse(html); payload.jobs[0].updated_at = '2026-11-11T04:03:00-05:00'; return JSON.stringify(payload) }],
  ['role', ROLE, html => html.replace('What’s in it for you?', 'Changed own role criteria')],
]) test('changed closing ' + name + ' withholds the complete zero result', async () => {
  const r = replay((current, packet, count) => current === url && count === 2 ? { ...packet, html: replace(packet.html) } : packet)
  await assert.rejects(run(r.options), /closing|program|renderer|inventory|criteria|description/i)
})

test('cancellation prevents every public source request', async () => {
  const r = replay(), reason = Error('cancel Calendly')
  await assert.rejects(run({ ...r.options, signal: AbortSignal.abort(reason) }), error => error === reason)
  assert.equal(r.calls.length, 0)
})

for (const openingPlaceholder of [false, true]) test('the exact observed native page_title variant reconciles with the normal title in either opening/closing order: ' + openingPlaceholder, async () => {
  const placeholder = captures.get('observed-title-placeholder:' + VARIANT_ROLE)
  const normal = captures.get('opening:' + VARIANT_ROLE)
  const normalTitle = /<title>[\s\S]*?<\/title>/.exec(normal.html)[0]
  assert.equal(placeholder.html.replace('<title>page_title</title>', normalTitle), normal.html,
    'Actual captured documents differ only in the single head-title component')
  const r = replay((url, packet, count) => url === VARIANT_ROLE && (count === 1) === openingPlaceholder
    ? { ...packet, html: placeholder.html } : packet)
  const jobs = await run(r.options), role = jobs.nativeCollectionEvidence.roles.find(role => role.id === VARIANT_ID)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(role.closingFullRoleCriteriaAndIdentityUnchanged, true)
  assert.equal(role.closingFullRoleUnchanged, false, 'The two original raw documents really differ')
  assert.equal(role.sourcePublicClosingRoleHtml, openingPlaceholder ? normal.html : placeholder.html)
  assert.notEqual(role.fullPublicRoleSHA256, role.sourcePublicClosingRoleSHA256)
  assert.equal(role.publicHeadTitleVariant, openingPlaceholder ? 'native-page-title-placeholder' : 'native-job-title')
  assert.equal(role.closingPublicHeadTitleVariant, openingPlaceholder ? 'native-job-title' : 'native-page-title-placeholder')
  assert.equal(role.nativeRouteIdentity.company, 'Calendly')
  assert.equal(role.nativeRouteIdentity.roleId, String(VARIANT_ID))
  assert.equal(role.nativeRouteIdentity.publicURL, VARIANT_ROLE)
})

test('closing comparison retains every original body byte outside the qualified head title', async () => {
  const r = replay((url, packet, count) => url === VARIANT_ROLE && count === 2 ? { ...packet,
    html: captures.get('observed-title-placeholder:' + VARIANT_ROLE).html.replace('</body>', '\n</body>') } : packet)
  await assert.rejects(run(r.options), /closing.*criteria\/identity changed outside qualified head title/i)
})

for (const [name, mutate] of [
  ['a foreign native company', loader => { Object.values(loader).find(value => value?.jobPost).jobPost.company_name = 'Other Employer' }],
  ['a different native role ID', loader => { Object.values(loader).find(value => value?.jobPost).jobPostId = '999999' }],
  ['a different native account', loader => { loader.root.urlToken = 'other-account' }],
  ['a preview role', loader => { loader.root.preview = true }],
  ['an internal role', loader => { loader.root.internal = true }],
  ['a non-job public mode', loader => { loader.root.isJobPost = false }],
  ['a foreign public role URL', loader => { Object.values(loader).find(value => value?.jobPost).jobPost.public_url = 'https://job-boards.greenhouse.io/other/jobs/' + VARIANT_ID }],
  ['a foreign native submission identity', loader => { Object.values(loader).find(value => value?.jobPost).submitPath = 'https://boards.greenhouse.io/other/jobs/' + VARIANT_ID }],
  ['an unrelated reciprocal logo link', loader => { loader.root.boardConfiguration.logo.href = 'https://other.example/careers' }],
]) test('native head-title qualification requires independent original loader proof against ' + name, async () => {
  const r = replay((url, packet) => url === VARIANT_ROLE ? { ...packet, html: editLoader(packet.html, mutate) } : packet)
  await assert.rejects(run(r.options), /native.*(?:loader|account|identity|company|employer|mode|logo|role)/i)
})

for (const [name, replace] of [
  ['a nomodule native loader carrier', html => html.replace('<script>window.__remixContext', '<script nomodule>window.__remixContext')],
  ['an empty-src native loader carrier', html => html.replace('<script>window.__remixContext', '<script src="">window.__remixContext')],
  ['a duplicate active native loader', html => html.replace('</body>', /<script>window\.__remixContext[\s\S]*?<\/script>/.exec(html)[0] + '</body>')],
  ['duplicate native JSON identity keys', html => html.replace('"urlToken":"calendly"', '"urlToken":"other","urlToken":"calendly"')],
  ['a conflicting Open Graph title', html => html.replace('property="og:title" content="Staff Product Manager, AI Assistant"', 'property="og:title" content="Other role"')],
  ['a conflicting Open Graph location', html => html.replace('property="og:description" content="San Francisco (Hybrid)"', 'property="og:description" content="Mumbai, India"')],
  ['a conflicting Open Graph URL', html => html.replace('property="og:url" content="' + VARIANT_ROLE + '"', 'property="og:url" content="https://other.example/jobs"')],
  ['an actual foreign head title', html => html.replace(/<title>[\s\S]*?<\/title>/, '<title>Jobs at Other Employer</title>')],
]) test('rejects ' + name + ' instead of broadly ignoring metadata', async () => {
  const original = captures.get('opening:' + VARIANT_ROLE).html
  assert.notEqual(replace(original), original, 'The control must change the actual native fixture')
  const r = replay((url, packet) => url === VARIANT_ROLE ? { ...packet, html: replace(packet.html) } : packet)
  await assert.rejects(run(r.options), /native|identity|title|loader|metadata|Graph|role/i)
})
