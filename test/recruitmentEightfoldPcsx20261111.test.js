import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { decodeHTML, encodeHTML } from 'entities'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { declaredEightfoldPcsxRecruitment, readEightfoldPcsxRecruitment } from '../scraper-support/utils/recruitmentEightfoldPcsx.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-dsm-20261111.json.gz', import.meta.url))))
const secondRoleFixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-dsm-second-role-20261111.json.gz', import.meta.url))))
const hrFourRoleFixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-dsm-hr-four-role-drift-20261111.json.gz', import.meta.url))))
const orderedRoleFixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-dsm-ordered-role-20261111.json.gz', import.meta.url))))
const captures = new Map()
for (const row of [...fixture.responses, ...secondRoleFixture.responses]) {
  const bytes = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bodySHA256)
  captures.set(row.phase + ':' + row.requestedURL, { ...row, html: bytes.toString('utf8') })
}
const url = label => fixture.responses.find(row => row.label === label).requestedURL
const HOME = url('corporate'), BOARD = url('native'), ENTRY = url('renderer'), LAZY = url('lazyRoleRenderer')
const SELECTED = url('search'), ROLE = url('role'), JOB = url('roleAPI'), OVERRIDES = url('overrides')
const JOB2 = secondRoleFixture.responses.find(row => row.label === 'roleAPI2').requestedURL
const config = { source: 'dsmfirmenich', companyName: 'DSM-Firmenich', companyCareerPage: HOME }
const page = (phase, current) => { const value = captures.get(phase + ':' + current); return { url: value.finalURL, status: value.status, html: value.html } }
const descriptor = html => declaredEightfoldPcsxRecruitment({ ...page('opening', BOARD), ...(html ? { html } : {}) }, config)
const changeCarrier = (html, id, change) => {
  const carrier = html.match(new RegExp('<code\\b[^>]*\\bid="' + id + '"[^>]*>[\\s\\S]*?<\\/code>'))[0]
  const source = carrier.match(/>([\s\S]*)<\/code>/)[1], value = JSON.parse(decodeHTML(source))
  change(value)
  return html.replace(carrier, carrier.replace(source, encodeHTML(JSON.stringify(value))))
}
const changePosting = (html, change) => {
  const doc = readNativeDocument(html), script = doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
    .find(node => JSON.parse(node.raw)['@type'] === 'JobPosting')
  const value = JSON.parse(script.raw); change(value)
  return html.replace(script.raw, JSON.stringify(value))
}
const replay = ({ budget = 14, maxDetails = 1, mutate = (_, value) => value, boardHTML, employer = true, captureMap = captures } = {}) => {
  const calls = [], counts = new Map([[HOME, 1], [BOARD, 1]]), jobs = [], records = [], inventories = [], unresolved = []
  const capturedPage = (phase, url) => { const value = captureMap.get(phase + ':' + url); return { url: value.finalURL, status: value.status, html: value.html } }
  const current = declaredEightfoldPcsxRecruitment({ ...capturedPage('opening', BOARD), ...(boardHTML ? { html: boardHTML } : {}) }, config)
  const request = async (url, format) => {
    assert(calls.length < budget, 'Real closing reads must remain within the source request budget')
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count); calls.push({ url, count, format })
    const captured = captureMap.get((count > 1 ? 'closing:' : 'opening:') + url)
    assert(captured, 'Every requested public surface must be currently declared and captured: ' + url)
    return mutate(url, { ...captured }, count)
  }
  const readPage = async url => { const value = await request(url, 'html'); return { url: value.finalURL, status: value.status, html: value.html } }
  const context = { config, readPage, readRenderer: readPage,
    readNativeJson: async url => { const value = await request(url, 'native-json-text'); return { url: value.finalURL, status: value.status, text: value.html } },
    permit: url => assert(captureMap.has('opening:' + url), 'Declared endpoint only'),
    matchingEmployer: value => employer && value === 'dsm-firmenich', addJob: value => jobs.push(value),
    recordRead: value => records.push(value), inventoryRead: value => inventories.push(value), unresolved: value => unresolved.push(value),
    maxPages: 1, maxDetails, remainingRequests: () => budget - calls.length, now: '2026-11-11T06:10:00.000Z',
    officialBinding: { officialURL: HOME, declaredURL: BOARD, page: capturedPage('opening', HOME) },
    recheckOfficialBinding: async binding => readPage(binding.officialURL) }
  return { descriptor: current, context, calls, jobs, records, inventories, unresolved,
    run: () => readEightfoldPcsxRecruitment(current, context) }
}

test('the current DSM PWA descriptor binds its exact active carriers, account and reviewed renderer declaration', () => {
  const current = descriptor()
  assert.equal(current?.kind, 'eightfold-pcsx')
  assert.equal(current.origin, 'https://jobs.dsm-firmenich.com')
  assert.equal(current.domain, 'dsm.com')
  assert.equal(current.entryURL, ENTRY)
  assert.equal(current.roleRendererURL, LAZY)
})

for (const [name, change] of [
  ['inactive entry', html => html.replace('src="/gen/js/pcsxPwa.', 'hidden src="/gen/js/pcsxPwa.')],
  ['nomodule entry', html => html.replace('src="/gen/js/pcsxPwa.', 'nomodule src="/gen/js/pcsxPwa.')],
  ['foreign PWA account', html => changeCarrier(html, 'pcsx-data', value => { value.domain = 'other.example' })],
  ['foreign branding account', html => changeCarrier(html, 'branding-data', value => { value.domain = 'other.example' })],
  ['changed current renderer configuration', html => changeCarrier(html, 'pcsx-data', value => { value.configs.pcsxConfig.unreviewed = true })],
  ['non-public model', html => changeCarrier(html, 'pcsx-data', value => { value.themeBuilderUser = { email: 'review-control@example.invalid' } })],
  ['hidden mount', html => html.replace('id="pcsx"', 'hidden id="pcsx"')],
  ['stylesheet-hidden mount', html => html.replace('</head>', '<style>#pcsx{display:none!important}</style></head>')],
]) test('current descriptor withholds ' + name, () => {
  const actual = page('opening', BOARD).html, changed = change(actual)
  assert.notEqual(changed, actual)
  assert.throws(() => descriptor(changed), /Eightfold|PWA|account|renderer|mode|mount|config/i)
})

test('unreviewed original source and unrelated page do not acquire the DSM contract', () => {
  assert.equal(declaredEightfoldPcsxRecruitment(page('opening', BOARD), { ...config, source: 'sendgrid' }), null)
  assert.equal(declaredEightfoldPcsxRecruitment(page('opening', HOME), config), null)
})

test('the actual full native role survives all fourteen reads with raw criteria, dates and partial scope intact', async () => {
  const r = replay(); await r.run()
  assert.equal(r.jobs.length, 1)
  const native = r.jobs[0], api = JSON.parse(captures.get('opening:' + JOB).html).data
  assert.equal(native.id, '562949974226258')
  assert.equal(native.title, 'Technical Consultant - SAP EHS/PLM')
  assert(native.description.startsWith(api.jobDescription + '\n'))
  assert(native.description.includes('Company and benefits'))
  for (const perk of api.positionExtraDetails.perks) {
    assert(native.description.includes(perk.title))
    assert(native.description.includes(perk.description))
  }
  assert(native.description.includes('Our teams are on site at least 60% of the time to connect, depending on the role.'))
  assert(native.description.includes('5+ years working experience'))
  assert(native.description.includes('Minimum bachelor'))
  assert.equal(native.employer.name, 'dsm-firmenich')
  assert.equal(native.legalEmployer, null)
  assert.equal(native.location, 'Hyderabad, India')
  assert.equal(native.posted, null)
  assert.equal(native.sourcePublicationDateUnavailable, true)
  assert.equal(native.closing, null)
  assert.equal(native.remoteStatus, null)
  assert.equal(native.sourceRemoteStatusUnresolved, true)
  assert.deepEqual(native.record.originalNativeRole, api)
  assert.equal(native.record.originalNativeRole.postedTs, 1794212868)
  assert.equal(native.record.originalNativeRole.creationTs, 1760578878)
  assert.equal(native.record.originalPublishedRole.datePosted, '2026-11-09T08:27:48')
  assert.equal(native.record.originalPublishedRole.validThrough, '2027-05-08T08:27:48')
  assert.equal(native.record.firstEverPublication, null)
  assert.equal(native.record.sourceScopeComplete, false)
  assert.equal(native.record.lifecycleCleanupAllowed, false)
  assert.equal(native.record.nativeClosingContext.everySelectedRoleRechecked, true)
  assert.equal(native.record.nativeClosingContext.currentPublisherHandoffRechecked, true)
  assert.equal(r.records.length, 10)
  assert.equal(r.inventories[0].reportedTotal, 33)
  assert.equal(r.inventories[0].observedRecordCount, 10)
  assert.equal(r.inventories[0].sourceScopeComplete, false)
  assert.equal(r.calls.length, 14)
  assert(r.unresolved.some(value => /partial|scope|bounded/.test(value)))
})

test('the positive fixture is bound to a separately captured active browser description, not LD-only text', () => {
  const proof = fixture.proof.renderedBrowserHTML, bytes = Buffer.from(proof.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), proof.sha256)
  const doc = readNativeDocument(bytes.toString('utf8')), descriptions = doc.nodes(node => node.attrs.id === 'job-description-container')
  assert.equal(descriptions.length, 1)
  const api = JSON.parse(captures.get('opening:' + JOB).html).data, source = readNativeDocument(api.jobDescription)
  assert.equal(doc.text(descriptions[0]), source.text(source.nodes(node => node.tag === 'root')[0]))
  assert.equal(proof.endpointObserved, JOB)
  assert.equal(proof.nativeDetailSHA256, captures.get('opening:' + JOB).bodySHA256)
})

for (const [name, target, change] of [
  ['native role identity', JOB, value => { value.data.id++ }],
  ['native role title', JOB, value => { value.data.name = 'Other role' }],
  ['native primary country label', JOB, value => { value.data.location = 'Boston, United States' }],
  ['additional native country', JOB, value => { value.data.locations.push('Boston, United States'); value.data.standardizedLocations.push('Boston, MA, US') }],
  ['native country code contradiction', JOB, value => { value.data.standardizedLocations = ['Hyderabad, TS, US'] }],
  ['blank criteria', JOB, value => { value.data.jobDescription = '' }],
  ['changed mandatory criteria punctuation', JOB, value => { value.data.jobDescription = value.data.jobDescription.replace('5+ years', '5- years') }],
  ['changed authored criterion number', JOB, value => { value.data.jobDescription = value.data.jobDescription.replace('5+ years', '6+ years') }],
  ['closed public role', JOB, value => { value.data.positionUserActions.applyAction.status = 'blocked' }],
  ['foreign apply-action URL', JOB, value => { value.data.positionUserActions.applyAction.url = 'https://foreign-employer.example/apply' }],
  ['fallback native metadata', JOB, value => { value.metadata = { isFallback: true } }],
  ['unreviewed native metadata', JOB, value => { value.metadata = { unreviewed: true } }],
  ['new native highlighted criterion', JOB, value => { value.data.jdHighlight = 'A new mandatory qualification.' }],
  ['new native supplemental custom criterion', JOB, value => { value.data.positionExtraDetails.customContent = [{ title: 'Required qualification', description: 'A new mandatory certification.' }] }],
  ['changed native company condition', JOB, value => { value.data.positionExtraDetails.perks[3].description += ' A new mandatory certification.' }],
  ['foreign current public URL', JOB, value => { value.data.publicUrl = 'https://other.example/careers/job/' + value.data.id }],
  ['upstream error despite HTTP200', JOB, value => { value.status = 404; value.error.message = 'not available' }],
  ['duplicate listing role', SELECTED, value => { value.data.positions[1] = value.data.positions[0] }],
  ['contradictory listing primary country', SELECTED, value => { value.data.positions[0].location = 'Boston, United States' }],
  ['description override', OVERRIDES, value => { value.data.pcsxBaseConfigOverrides.positionDetailsConfig.jobDescription = '<p>Different required experience.</p>' }],
  ['new authored hero override criterion', OVERRIDES, value => { value.data.pcsxBaseConfigOverrides.branding.heroImageConfig.default.text = 'All applicants must hold a current SAP certification.' }],
]) test('no positive escapes ' + name, async () => {
  const r = replay({ mutate: (url, packet) => {
    if (url !== target) return packet
    const value = JSON.parse(packet.html); change(value)
    return { ...packet, html: JSON.stringify(value) }
  } })
  await assert.rejects(r.run(), /Eightfold|PWA|role|country|identity|scope|criteria|description|config|error|listing/i)
  assert.equal(r.jobs.length, 0)
})

for (const [name, change] of [
  ['published employer', value => { value.hiringOrganization.name = 'Other Employer' }],
  ['published country', value => { value.jobLocation.address.addressCountry.name = 'US' }],
  ['contradictory nested published country', value => { value.jobLocation.address.addressCountry.identifier = 'US' }],
  ['published title', value => { value.title = 'Other role' }],
  ['full published criteria', value => { value.description += ' New required certification.' }],
  ['separate authored qualification', value => { value.experienceRequirements = 'Additional mandatory qualification: 12 years of SAP implementation experience.' }],
]) test('own-page ' + name + ' conflicts with the API without releasing a role', async () => {
  const r = replay({ mutate: (url, packet) => url === ROLE ? { ...packet, html: changePosting(packet.html, change) } : packet })
  await assert.rejects(r.run(), /Eightfold|PWA|employer|country|title|criteria|identity/i)
  assert.equal(r.jobs.length, 0)
})

test('raw transport rejects duplicate role keys that JSON.parse would erase', async () => {
  const r = replay({ mutate: (url, packet) => url === JOB ? { ...packet,
    html: packet.html.replace(/"id":\s*562949974226258/, '"id":999,"\\u0069d":562949974226258') } : packet })
  await assert.rejects(r.run(), /duplicate/i)
  assert.equal(r.jobs.length, 0)
})

for (const [name, target, change] of [
  ['selected listing membership', SELECTED, html => { const value = JSON.parse(html); value.data.positions.shift(); return JSON.stringify(value) }],
  ['full native criterion', JOB, html => { const value = JSON.parse(html); value.data.jobDescription += '<p>A new mandatory criterion.</p>'; return JSON.stringify(value) }],
  ['current native availability', JOB, html => { const value = JSON.parse(html); value.data.positionUserActions.applyAction.status = 'blocked'; return JSON.stringify(value) }],
  ['own-page country', ROLE, html => changePosting(html, value => { value.jobLocation.address.addressCountry.name = 'US' })],
  ['current native carrier', BOARD, html => changeCarrier(html, 'pcsx-data', value => { value.domain = 'other.example' })],
  ['corporate handoff', HOME, html => html.replaceAll(BOARD, 'https://other.example/careers')],
  ['entry renderer', ENTRY, html => html + '\n// source changed'],
  ['full-description renderer', LAZY, html => html + '\n// source changed'],
  ['role override', OVERRIDES, html => { const value = JSON.parse(html); value.data.unreviewed = 'new content'; return JSON.stringify(value) }],
]) test('closing ' + name + ' drift withholds all staged output', async () => {
  const r = replay({ mutate: (url, packet, count) => url === target && count > 1 ? { ...packet, html: change(packet.html) } : packet })
  await assert.rejects(r.run(), /Eightfold|PWA|closing|role|scope|carrier|account|renderer|criteria|country|handoff|config/i)
  assert.equal(r.jobs.length, 0)
})

test('insufficient closing reserve preserves native observations and never invents a zero', async () => {
  const r = replay({ budget: 13 }); await r.run()
  assert.equal(r.jobs.length, 0)
  assert.equal(r.records.length, 10)
  assert(r.unresolved.some(value => /budget|reserve/.test(value)))
  assert.equal(r.inventories[0].sourceScopeComplete, false)
  assert.equal(r.inventories[0].lifecycleCleanupAllowed, false)
  assert(r.calls.length <= 13)
})

test('native employer must retain its current original-source binding', async () => {
  const r = replay({ employer: false })
  await assert.rejects(r.run(), /employer|binding/i)
  assert.equal(r.jobs.length, 0)
})

test('two actual current native roles retain complete criteria within the twenty-read reserve', async () => {
  const r = replay({ budget: 20, maxDetails: 2 }); await r.run()
  assert.equal(r.jobs.length, 2)
  const actual = JSON.parse(captures.get('opening:' + JOB2).html).data
  assert(r.jobs[1].description.startsWith(actual.jobDescription + '\n'))
  for (const perk of actual.positionExtraDetails.perks) assert(r.jobs[1].description.includes(perk.description))
  assert.equal(r.jobs[1].id, String(secondRoleFixture.roleID))
  assert.equal(r.calls.length, 20)
})

const captureMapFor = fixture => {
  const captureMap = new Map()
  for (const row of fixture.responses) {
    const bytes = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bodySHA256)
    assert.equal(row.contentType, row.headers['content-type'])
    captureMap.set(row.phase + ':' + row.requestedURL, { ...row, html: bytes.toString('utf8') })
  }
  return captureMap
}
const hrCaptureMap = () => captureMapFor(hrFourRoleFixture)

test('the actual four stable selected roles retain positive partial scope while unvisited listing membership drift is recorded', async () => {
  const captureMap = hrCaptureMap()
  assert.equal(hrFourRoleFixture.listingDiff.removedIDs.length, 4)
  assert.equal(hrFourRoleFixture.listingDiff.addedIDs.length, 4)
  const r = replay({ budget: 32, maxDetails: 4, captureMap })
  await r.run()
  assert.deepEqual(r.jobs.map(job => Number(job.id)), hrFourRoleFixture.roleIDs)
  assert.equal(r.records.length, 14)
  assert.equal(new Set(r.records.map(row => row.id)).size, 14)
  assert.equal(r.calls.length, 32)
  for (const roleID of hrFourRoleFixture.roleIDs) {
    for (const path of ['/careers/job/' + roleID,
      '/api/pcsx/position_details?position_id=' + roleID + '&domain=dsm.com&hl=en',
      '/api/pcsx/overrides?position_id=' + roleID + '&domain=dsm.com&hl=en']) {
      assert.equal(r.calls.filter(call => call.url === 'https://jobs.dsm-firmenich.com' + path).length, 2)
    }
  }
  const lastOpening = Math.max(...r.calls.map((call, index) => call.count === 1 && /position_details|overrides|\/careers\/job\//.test(call.url) ? index : -1))
  const firstClosing = r.calls.findIndex(call => call.count === 2 && /position_details/.test(call.url))
  assert(firstClosing > lastOpening)
  assert.equal(r.inventories[0].sourceScopeComplete, false)
  assert.equal(r.inventories[0].lifecycleCleanupAllowed, false)
  assert(r.unresolved.some(value => /unselected-inventory-drift/.test(value)))
  const closingRaw = captureMap.get('closing:' + SELECTED).html, openingRaw = captureMap.get('opening:' + SELECTED).html
  for (const job of r.jobs) {
    assert.equal(job.record.nativeListingEvidence.originalOpeningRawJSON, openingRaw)
    assert.equal(job.record.nativeListingEvidence.originalClosingRawJSON, closingRaw)
    assert.deepEqual(job.record.nativeListingEvidence.unselectedInventoryDrift.addedIDs, hrFourRoleFixture.listingDiff.addedIDs)
    assert.deepEqual(job.record.nativeListingEvidence.unselectedInventoryDrift.removedIDs, hrFourRoleFixture.listingDiff.removedIDs)
    assert.equal(job.record.nativeClosingContext.selectedListingRechecked, true)
    assert.equal(job.record.nativeClosingContext.everySelectedRoleRechecked, true)
    assert.equal(job.record.nativeClosingContext.renderersRechecked, true)
    assert.equal(job.record.sourceScopeComplete, false)
    assert.equal(job.record.lifecycleCleanupAllowed, false)
    assert.equal(job.posted, null)
    assert.equal(job.closing, null)
    assert.equal(job.sourceRemoteStatusUnresolved, true)
  }
  const hr = r.jobs.find(job => job.id === '562949978857170')
  assert(hr.description.startsWith(hr.record.originalNativeRole.jobDescription + '\n'))
  for (const perk of hr.record.originalNativeRole.positionExtraDetails.perks) assert(hr.description.includes(perk.description))
  assert(hr.description.includes('Our teams are on site at least 60% of the time to connect, depending on the role.'))
})

for (const [name, change] of [
  ['missing selected role', value => { value.data.positions = value.data.positions.filter(row => row.id !== 562949978857170) }],
  ['selected title changed', value => { value.data.positions.find(row => row.id === 562949978857170).name += ' changed' }],
  ['selected country changed', value => { value.data.positions.find(row => row.id === 562949978857170).locations = ['Boston, United States'] }],
  ['selected published date changed', value => { value.data.positions.find(row => row.id === 562949978857170).postedTs++ }],
  ['selected work-location option changed', value => { value.data.positions.find(row => row.id === 562949978857170).workLocationOption += ' changed' }],
  ['selected ranking field changed', value => { value.data.positions.find(row => row.id === 562949978857170).solrScore++ }],
  ['native reported count changed', value => { value.data.count++ }],
  ['duplicate closing native identity', value => { value.data.positions[0] = value.data.positions[1] }],
]) test('partial inventory drift never admits ' + name, async () => {
  const r = replay({ budget: 32, maxDetails: 4, captureMap: hrCaptureMap(), mutate: (url, packet, count) => {
    if (url !== SELECTED || count !== 2) return packet
    const value = JSON.parse(packet.html); change(value)
    return { ...packet, html: JSON.stringify(value) }
  } })
  await assert.rejects(r.run(), /Eightfold|closing|listing|country/i)
  assert.equal(r.jobs.length, 0)
})

const ORDERED_JOB = 'https://jobs.dsm-firmenich.com/api/pcsx/position_details?position_id=562949978300025&domain=dsm.com&hl=en'
const ORDERED_ROLE = 'https://jobs.dsm-firmenich.com/careers/job/562949978300025'
test('the actual seven ordered responsibilities retain their complete current native criteria through four-role closing', async () => {
  const r = replay({ budget: 32, maxDetails: 4, captureMap: captureMapFor(orderedRoleFixture) })
  await r.run()
  assert.deepEqual(r.jobs.map(job => Number(job.id)), orderedRoleFixture.roleIDs)
  assert.equal(r.calls.length, 32)
  const role = r.jobs.find(job => job.id === '562949978300025'), original = role.record.originalNativeRole.jobDescription
  assert(original.includes('<ol '))
  assert(original.includes('start="1"'))
  assert(original.includes('type="1"'))
  assert(role.description.startsWith(original + '\n'))
  assert(role.record.originalPublishedRole.description.includes('1. Design and maintain semantic data models'))
  assert.equal(role.record.nativeCriteriaRepresentations.primary.fullPublishedSchemaAgreement, true)
  assert.equal(role.record.sourceScopeComplete, false)
  assert.equal(role.record.lifecycleCleanupAllowed, false)
  assert.equal(role.posted, null)
  assert.equal(role.closing, null)
})

for (const [name, change] of [
  ['wrong published ordinal', value => { value.description = value.description.replace('1. Design and maintain', '2. Design and maintain') }],
  ['changed published ordinal punctuation', value => { value.description = value.description.replace('1. Design and maintain', '1- Design and maintain') }],
]) test('ordered structural markers preserve ' + name, async () => {
  const r = replay({ budget: 32, maxDetails: 4, captureMap: captureMapFor(orderedRoleFixture), mutate: (url, packet) =>
    url === ORDERED_ROLE ? { ...packet, html: changePosting(packet.html, change) } : packet })
  await assert.rejects(r.run(), /complete native\/published criteria differ/)
  assert.equal(r.jobs.length, 0)
})

for (const [name, change] of [
  ['nondefault ordered start', html => html.replace('start="1"', 'start="2"')],
  ['reversed ordered list', html => html.replace('<ol ', '<ol reversed ')],
  ['nondecimal ordered type', html => html.replace('type="1"', 'type="I"')],
  ['explicit list-item value', html => html.replace(/(<ol\b[\s\S]*?<li)\b/, '$1 value="2"')],
  ['nondefault list-style rule', html => html.replace('<ol style="', '<ol style="list-style-type: lower-roman; ')],
  ['conflicting duplicate ordered start', html => html.replace('start="1"', 'start="1" start="2"')],
  ['list-item CSS counter', html => html.replace(/(<ol\b[\s\S]*?<li style=")/, '$1counter-increment: item 2; ')],
  ['embedded ordered-list stylesheet', html => '<style>ol {list-style-type:lower-roman}</style>' + html],
]) test('ordered native criteria hold ' + name, async () => {
  const r = replay({ budget: 32, maxDetails: 4, captureMap: captureMapFor(orderedRoleFixture), mutate: (url, packet) => {
    if (url !== ORDERED_JOB) return packet
    const value = JSON.parse(packet.html), changed = change(value.data.jobDescription)
    assert.notEqual(changed, value.data.jobDescription)
    value.data.jobDescription = changed
    return { ...packet, html: JSON.stringify(value) }
  } })
  await assert.rejects(r.run(), /unreviewed ordered list semantics/)
  assert.equal(r.jobs.length, 0)
})

test('ordered native responsibilities cannot be reordered while the own published criteria retain their order', async () => {
  const r = replay({ budget: 32, maxDetails: 4, captureMap: captureMapFor(orderedRoleFixture), mutate: (url, packet) => {
    if (url !== ORDERED_JOB) return packet
    const value = JSON.parse(packet.html), ordered = value.data.jobDescription.match(/<ol\b[^>]*>([\s\S]*?)<\/ol>/i)
    const items = [...ordered[1].matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    assert.equal(items.length, 7)
    const [a,b] = items, body = ordered[1]
    const swapped = body.slice(0,a.index)+b[0]+body.slice(a.index+a[0].length,b.index)+a[0]+body.slice(b.index+b[0].length)
    value.data.jobDescription = value.data.jobDescription.replace(ordered[1],swapped)
    return { ...packet, html: JSON.stringify(value) }
  } })
  await assert.rejects(r.run(), /complete native\/published criteria differ/)
  assert.equal(r.jobs.length, 0)
})

for (const [name, target, change] of [
  ['changed known video text', JOB, value => { value.data.positionExtraDetails.videos[0].title += ' mandatory qualification' }],
  ['new video record', JOB, value => { value.data.positionExtraDetails.videos.push({ ...value.data.positionExtraDetails.videos[0], url: 'https://www.youtube.com/embed/unreviewed' }) }],
  ['duplicate known video', JOB, value => { value.data.positionExtraDetails.videos.push(value.data.positionExtraDetails.videos[0]) }],
  ['reordered known videos', JOB, value => { value.data.positionExtraDetails.videos.reverse() }],
  ['new field on known blog', JOB, value => { value.data.positionExtraDetails.blogs[0].requirement = 'A mandatory certification.' }],
  ['new blog record', JOB, value => { value.data.positionExtraDetails.blogs.push({ ...value.data.positionExtraDetails.blogs[0], url: 'https://careers.dsm-firmenich.com/unreviewed' }) }],
  ['new supplemental field', JOB, value => { value.data.positionExtraDetails.requirement = 'A mandatory certification.' }],
  ['override known-video membership mismatch', OVERRIDES, value => { value.data.pcsxBaseConfigOverrides.positionDetailsConfig.sectionsConfig.videos.items.pop() }],
  ['override foreign resource', OVERRIDES, value => { value.data.pcsxBaseConfigOverrides.positionDetailsConfig.sectionsConfig.videos.items.push('https://foreign-employer.example/criteria') }],
]) test('optional-resource support still withholds ' + name, async () => {
  const r = replay({ mutate: (url, packet) => {
    if (url !== target) return packet
    const value = JSON.parse(packet.html); change(value)
    return { ...packet, html: JSON.stringify(value) }
  } })
  await assert.rejects(r.run(), /Eightfold|supplemental|override|resource/i)
  assert.equal(r.jobs.length, 0)
})

test('an earlier role changing while the later actual role is acquired is rechecked after all opening detail reads', async () => {
  let laterRoleAcquired = false
  const r = replay({ budget: 20, maxDetails: 2, mutate: (url, packet, count) => {
    if (url === JOB2 && count === 1) laterRoleAcquired = true
    if (url !== JOB || count <= 1 || !laterRoleAcquired) return packet
    const value = JSON.parse(packet.html); value.data.jobDescription += '<p>A newly published mandatory criterion.</p>'
    return { ...packet, html: JSON.stringify(value) }
  } })
  await assert.rejects(r.run(), /Eightfold|PWA|closing|criteria/i)
  assert.equal(r.jobs.length, 0)
})

for (const [name, replacement] of [
  ['numbered-heading dot changed to hyphen', '1- Business'],
  ['authored backslash added before numbered-heading dot', '1\\. Business'],
]) test('the structural schema serializer preserves ' + name, async () => {
  const r = replay({ budget: 20, maxDetails: 2, mutate: (url, packet) => {
    if (url !== JOB2) return packet
    const value = JSON.parse(packet.html), before = value.data.jobDescription
    value.data.jobDescription = before.replace('1. Business', replacement)
    assert.notEqual(value.data.jobDescription, before)
    return { ...packet, html: JSON.stringify(value) }
  } })
  await assert.rejects(r.run(), /Eightfold|PWA|criteria|backslash/i)
  assert.equal(r.jobs.length, 0)
})

test('fully reconciled mixed-country native scope is retained as an observation and withheld from forced India projection', async () => {
  const labels = ['Boston, United States','Hyderabad, India'], standardized = ['Boston, MA, US','Hyderabad, TS, IN']
  const r = replay({ mutate: (url, packet) => {
    if (url === SELECTED || url === JOB) {
      const envelope = JSON.parse(packet.html), row = url === SELECTED ? envelope.data.positions[0] : envelope.data
      row.locations = [...labels]; row.standardizedLocations = [...standardized]
      if (url === JOB) row.location = labels[0]
      return { ...packet, html: JSON.stringify(envelope) }
    }
    if (url === ROLE) return { ...packet, html: changePosting(packet.html, post => {
      post.jobLocation = [
        { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: { '@type': 'Country', name: 'US' }, addressLocality: 'Boston', addressRegion: 'MA,US' } },
        { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: { '@type': 'Country', name: 'IN' }, addressLocality: 'Hyderabad', addressRegion: 'TS,IN' } },
      ]
    }) }
    return packet
  } })
  await r.run()
  assert(r.jobs.every(job => job.id !== '562949974226258'))
  assert.deepEqual(r.records[0].locations, labels)
  assert(r.unresolved.some(value => /mixed|projection/.test(value)))
})
