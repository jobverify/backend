import test from 'node:test'
import assert from 'node:assert/strict'
import { parseWidgetJSONP, readWidgetInventory, projectIndiaObservations } from './nativeWidget.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { titleData, detailData, titles, details, clone, jsonp, packets, changedPacket, fixtureReader } from './test-data/fixture.mjs'
const snapshot = (data = detailData, mode = 'details') => readWidgetInventory(jsonp(data), { mode, observedAt: details.capturedAt })
const observed = (data = detailData) => projectIndiaObservations(snapshot(titleData, 'titles'), snapshot(data))
const indiaId = '73D0145CD3'
const changeGroup = (data, id, change) => { for (const row of data.jobs.filter(row => row.shortcode === id)) change(row); return data }

test('actual strict native JSONP supplies104 variants and73 posting identities', () => {
  const parsed = parseWidgetJSONP(details.body), inventory = snapshot()
  assert.equal(parsed.name, 'Flatgigs'); assert.equal(parsed.jobs.length, 104)
  assert.equal(inventory.groups.length, 73); assert.equal(inventory.rawRowCount, 104)
  assert.equal(inventory.distinctVariantCount, 104); assert.equal(inventory.extraVariantCount, 31)
})
for (const [name, source] of [
  ['wrong callback', 'other({"name":"Flatgigs","description":"","jobs":[]});'],
  ['member callback', 'window.whrcallback({"name":"Flatgigs","description":"","jobs":[]});'],
  ['extra statement', 'whrcallback({"name":"Flatgigs","description":"","jobs":[]});run();'],
  ['multiple args', 'whrcallback({"name":"Flatgigs","description":"","jobs":[]}, 1);'],
  ['duplicate root', 'whrcallback({"name":"Other","name":"Flatgigs","description":"","jobs":[]});'],
  ['escaped duplicate', 'whrcallback({"name":"Other","na\\u006de":"Flatgigs","description":"","jobs":[]});'],
  ['duplicate nested', 'whrcallback({"name":"Flatgigs","description":"","jobs":[{"title":"A","title":"B"}]});'],
  ['non JSON', 'whrcallback({name:"Flatgigs",description:"",jobs:[]});'],
  ['executed value', 'whrcallback({"name":"Flatgigs","description":get(),"jobs":[]});'],
  ['prototype key', 'whrcallback({"name":"Flatgigs","description":"","jobs":[],"__proto__":{}});'],
]) test('strict JSONP rejects ' + name, () => assert.throws(() => parseWidgetJSONP(source)))
test('wrong publisher and error envelope do not become an empty success', () => {
  assert.throws(() => snapshot({ ...clone(detailData), name: 'Other publisher' }))
  assert.throws(() => snapshot({ error: 'Access denied', jobs: [] }))
})
test('actual three India observations retain country-only workplaces, exact native URLs and all foreign variants', () => {
  const jobs = observed(); assert.equal(jobs.length, 3)
  for (const job of jobs) {
    const source = detailData.jobs.find(row => row.shortcode === job.jobId && row.country === 'India')
    assert.ok(source); assert.equal(job.country, 'India'); assert.equal(job.location, 'India')
    assert.equal(job.city, null); assert.equal(job.state, null); assert.equal(job.nativeLegalEmployer, null)
    assert.equal(job.applyUrl, source.application_url); assert.equal(job.sourceUrl, source.url)
    assert.equal(job.nativeRawEvidence.details.length, 3)
    assert.ok(job.nativeRawEvidence.details.some(row => row.country !== 'India'))
    assert.equal(job.sourcePublishedOn, source.published_on); assert.equal(job.sourceCreatedAt, source.created_at)
    assert.equal(job.postedAt, source.published_on + 'T00:00:00.000Z')
    assert.equal(job.sourcePublicationPrecision, 'calendar-day'); assert.equal(job.sourcePublicationIsExactInstant, false)
    assert.equal(job.nativeSameModeClosingQualified, false)
    assert.equal(job.nativeDescriptionVisibleQualified, true); assert.ok(job.jobDescription.length > 1000)
  }
})
test('another labelled controlled role uses the same source format without a role allowlist', () => {
  const data = clone(detailData), first = data.jobs.find(row => data.jobs.filter(other => other.shortcode === row.shortcode).length === 1 && row.country !== 'India')
  first.title = 'Controlled role with the same native format'; first.country = 'India'; first.city = ''; first.state = ''
  first.locations = [{ country: 'India', countryCode: 'IN', city: '', region: null, hidden: false }]
  const opening = clone(data); for (const row of opening.jobs) delete row.description
  const jobs = projectIndiaObservations(snapshot(opening, 'titles'), snapshot(data))
  assert.ok(jobs.some(job => job.jobId === first.shortcode && job.country === 'India'))
})
for (const field of ['title', 'description', 'application_url', 'published_on', 'telecommuting']) test('same-shortcode variants cannot erase a conflicting ' + field, () => {
  const data = clone(detailData), row = data.jobs.find(row => row.shortcode === indiaId)
  row[field] = field === 'telecommuting' ? !row[field] : String(row[field]) + ' controlled conflict'
  assert.throws(() => snapshot(data))
})
test('identical display copies stay one variant and one posting while raw rows survive', () => {
  const data = clone(detailData); data.jobs.push(clone(data.jobs[0]))
  const inventory = snapshot(data)
  assert.equal(inventory.rawRowCount, 105); assert.equal(inventory.groups.length, 73)
  assert.equal(inventory.distinctVariantCount, 104); assert.equal(inventory.duplicateRowCount, 1)
})
test('same title on different existing native shortcodes does not merge identities', () => {
  const data = clone(detailData), ids = [...new Set(data.jobs.map(row => row.shortcode))].slice(0, 2)
  for (const id of ids) changeGroup(data, id, row => { row.title = 'Controlled equal role title' })
  assert.equal(snapshot(data).groups.filter(group => ids.includes(group.shortcode)).length, 2)
})
for (const flag of [true, undefined]) test('hidden or missing native location visibility does not qualify country: ' + flag, () => {
  const data = changeGroup(clone(detailData), indiaId, row => { if (row.country === 'India') { if (flag === undefined) delete row.locations[0].hidden; else row.locations[0].hidden = flag } })
  const job = observed(data).find(job => job.jobId === indiaId)
  assert.ok(job); assert.equal(job.country, ''); assert.equal(job.location, '')
  assert.equal(job.nativeGeographyQualified, false)
})
for (const mutate of [row => { row.locations[0].country = 'United States' }, row => { row.locations[0].countryCode = 'US' }, row => { row.country = 'United States' }]) test('conflicting explicit India country statements fail closed', () => {
  const data = clone(detailData), row = data.jobs.find(row => row.shortcode === indiaId && row.country === 'India'); mutate(row)
  assert.throws(() => snapshot(data))
})
test('remote arrangement and a city do not provide missing country proof', () => {
  const data = changeGroup(clone(detailData), indiaId, row => { if (row.country === 'India') { row.country = ''; row.city = 'Mumbai'; row.locations = [{ country: '', countryCode: '', city: 'Mumbai', region: null, hidden: false }] } })
  const inventory = snapshot(data), jobs = projectIndiaObservations(snapshot(titleData, 'titles'), inventory)
  assert.ok(inventory.groups.find(group => group.shortcode === indiaId).records.some(row => row.city === 'Mumbai'))
  assert.equal(jobs.find(job => job.jobId === indiaId)?.country || '', '')
})
test('native city disagreement stays unknown while explicit country survives only when corroborated', () => {
  const data = changeGroup(clone(detailData), indiaId, row => { if (row.country === 'India') { row.city = 'Pune'; row.locations[0].city = 'Mumbai' } })
  const opening = clone(data); for (const row of opening.jobs) delete row.description
  const job = projectIndiaObservations(snapshot(opening, 'titles'), snapshot(data)).find(job => job.jobId === indiaId)
  assert.equal(job.country, 'India'); assert.equal(job.city, null); assert.equal(job.nativeCityConflict, true)
  assert.equal(job.nativeRawEvidence.details.find(row => row.country === 'India').city, 'Pune')
})
for (const hidden of ['hidden', 'aria-hidden="true"', 'style="display:none"', 'style="opacity:0"']) test('hidden native criteria stay raw and cannot enter normalized JD: ' + hidden, () => {
  const data = changeGroup(clone(detailData), indiaId, row => { row.description = '<p ' + hidden + '>CONTROLLED_HIDDEN_REQUIREMENT</p>' + row.description })
  const job = observed(data).find(job => job.jobId === indiaId)
  assert.ok(job.jobDescription.length > 1000); assert.equal(job.jobDescription.includes('CONTROLLED_HIDDEN_REQUIREMENT'), false)
  assert.ok(job.nativeRawEvidence.details.every(row => row.description.includes('CONTROLLED_HIDDEN_REQUIREMENT')))
})
test('fully hidden/missing description remains partial without generated JD', () => {
  const data = changeGroup(clone(detailData), indiaId, row => { row.description = '<section hidden>' + row.description + '</section>' })
  const job = observed(data).find(job => job.jobId === indiaId)
  assert.equal(job.jobDescription, null); assert.equal(job.sourceDescription, null); assert.equal(job.nativeDescriptionVisibleQualified, false)
  assert.ok(job.nativeRawEvidence.details[0].description.includes('<section hidden>'))
})
for (const value of [undefined, '', '2026-02-30', '2099-01-01']) test('missing, invalid or future published_on never falls back to created/capture date: ' + value, () => {
  const data = changeGroup(clone(detailData), indiaId, row => { if (value === undefined) delete row.published_on; else row.published_on = value })
  const opening = clone(data); for (const row of opening.jobs) delete row.description
  const job = projectIndiaObservations(snapshot(opening, 'titles'), snapshot(data)).find(job => job.jobId === indiaId)
  assert.equal(job.postedAt, null); assert.equal(job.nativePublicationDateQualified, false)
  assert.equal(job.sourceCreatedAt, '2025-09-03')
})
test('the two actually old India publications remain old under the unchanged month policy', () => {
  const jobs = observed()
  for (const id of ['73D0145CD3', '32604FA996']) {
    const job = jobs.find(job => job.jobId === id), result = analyzePublishableJobs([job], { now: new Date(details.capturedAt) })
    assert.equal(result.filterCounts.old, 1); assert.equal(result.eligibleJobs.length, 0)
  }
})
test('missing application URL stays unknown; contradictory native URLs are rejected', () => {
  const data = changeGroup(clone(detailData), indiaId, row => { delete row.application_url })
  const opening = clone(data); for (const row of opening.jobs) delete row.description
  const job = projectIndiaObservations(snapshot(opening, 'titles'), snapshot(data)).find(job => job.jobId === indiaId)
  assert.equal(job.applyUrl, null); assert.equal(job.nativeApplicationQualified, false)
  const conflict = changeGroup(clone(detailData), indiaId, row => { row.application_url = 'https://apply.workable.com/j/7A9108378E/apply' })
  assert.throws(() => snapshot(conflict))
})
test('matching cross-mode observations do not manufacture a same-mode closing', () => {
  const jobs = observed(); assert.ok(jobs.every(job => job.nativeSameModeClosingQualified === false))
})
test('data projection alone cannot attest an independently qualified closing transport', () => {
  const opening = snapshot(titleData, 'titles'), detail = snapshot(), duplicate = snapshot()
  assert.ok(projectIndiaObservations(opening, detail, duplicate).every(job => job.nativeSameModeClosingQualified === false))
})
test('unsupported authoritative role fields cannot be silently ignored', () => {
  const data = clone(detailData)
  for (const row of data.jobs.filter(row => row.shortcode === indiaId)) row.status = 'closed'
  assert.throws(() => snapshot(data), /unsupported.*field/i)
})
test('visible JD text decodes standard HTML references once while raw native bytes stay intact', () => {
  const data = changeGroup(clone(detailData), indiaId, row => { row.description += '<p>CONTROLLED_VISIBLE_MARKER &quest; &#63; &#63 &amp;quest;</p>' })
  const job = observed(data).find(job => job.jobId === indiaId)
  assert.ok(job.jobDescription.includes('CONTROLLED_VISIBLE_MARKER ? ? ? &quest;'))
  assert.ok(job.nativeRawEvidence.details.every(row => row.description.includes('&quest; &#63; &#63 &amp;quest;')))
})
for (const [name, html, expected] of [
  ['inline word fragment', '<p>Build re<strong>liable</strong> software.</p>', 'Build reliable software.'],
  ['adjacent inline fragments', '<p>Use <strong>Type</strong><em>Script</em>.</p>', 'Use TypeScript.'],
  ['native inline whitespace', '<p>Use <strong>Type</strong> <em>Script</em>.</p>', 'Use Type Script.'],
  ['edge whitespace', '<p>Build <strong>  re&#108;iable  </strong> software.</p>', 'Build reliable software.'],
  ['hidden inline fragment', '<p>Build re<span hidden>jected </span>liable software.</p>', 'Build reliable software.'],
  ['structural blocks', '<p>Build</p><p>reliable software.</p>', 'Build reliable software.'],
  ['literal line break', '<p>Design robust<br>systems.</p>', 'Design robust systems.'],
  ['once-decoded text', '<p>Use &lt;b&gt;reliable&lt;/b&gt; software &amp;quest;.</p>', 'Use <b>reliable</b> software &quest;.'],
]) test('visible native JD preserves ' + name + ' without losing raw HTML', () => {
  const data = changeGroup(clone(detailData), indiaId, row => { row.description = html })
  const job = observed(data).find(job => job.jobId === indiaId)
  assert.equal(job.jobDescription, expected)
  assert.ok(job.nativeRawEvidence.details.every(row => row.description === html))
})

// Controlled mutations of retained native data, never additional native captures.
const pairedNestedLocations = mutate => {
  const detail = clone(detailData)
  for (const row of detail.jobs) if (row.shortcode === indiaId && row.country === 'India') mutate(row)
  const opening = clone(detail); for (const row of opening.jobs) delete row.description
  return { opening, detail, jobs: projectIndiaObservations(snapshot(opening, 'titles'), snapshot(detail)) }
}
test('nested location schema keeps the actual supported country-only location qualified', () => {
  const { jobs } = pairedNestedLocations(() => {}), job = jobs.find(job => job.jobId === indiaId)
  assert.equal(job.nativeGeographyQualified, true); assert.equal(job.country, 'India'); assert.equal(job.location, 'India')
  assert.equal(job.city, null); assert.equal(job.state, null)
  assert.deepEqual(job.nativeRawEvidence.details.find(row => row.country === 'India').locations, [{ country: 'India', countryCode: 'IN', city: '', region: null, hidden: false }])
})
test('nested location schema cannot erase a recognized country conflict behind an unknown field', () => {
  assert.throws(() => pairedNestedLocations(row => { row.locations[0].countryCode = 'US'; row.locations[0].country_code = 'IN' }), /country-code contradiction/)
})
for (const value of ['US', 'IN', null, { unqualifiedValue: 'US' }]) test('nested location schema withholds geography for uninterpreted country_code: ' + JSON.stringify(value), () => {
  const { jobs } = pairedNestedLocations(row => { row.locations[0].country_code = value }), job = jobs.find(job => job.jobId === indiaId)
  assert.ok(job); assert.equal(job.nativeIdentityQualified, true)
  assert.equal(job.nativeGeographyQualified, false); assert.equal(job.country, ''); assert.equal(job.location, '')
  assert.equal(job.city, null); assert.equal(job.state, null)
  assert.equal(job.nativeDescriptionVisibleQualified, true)
  const raw = job.nativeRawEvidence.details.find(row => row.country === 'India')
  assert.equal(raw.country, 'India'); assert.equal(raw.locations[0].countryCode, 'IN')
  assert.deepEqual(raw.locations[0].country_code, value)
  assert.ok(job.nativeRawEvidence.details.some(row => row.country !== 'India'))
})
test('nested location schema checks every supplied location rather than selecting the first known shape', () => {
  const { jobs } = pairedNestedLocations(row => { row.locations.push({ ...clone(row.locations[0]), country_code: 'US' }) }), job = jobs.find(job => job.jobId === indiaId)
  assert.equal(job.nativeGeographyQualified, false); assert.equal(job.country, '')
  assert.equal(job.nativeRawEvidence.details.find(row => row.country === 'India').locations.length, 2)
})
for (const hidden of [true, undefined]) test('nested location schema still requires explicit native visibility: ' + hidden, () => {
  const { jobs } = pairedNestedLocations(row => { if (hidden === undefined) delete row.locations[0].hidden; else row.locations[0].hidden = hidden }), job = jobs.find(job => job.jobId === indiaId)
  assert.equal(job.nativeGeographyQualified, false); assert.equal(job.country, '')
  assert.ok(job.nativeRawEvidence.details.find(row => row.country === 'India'))
})
test('nested location schema remains partial through the real coordinator and registered decorator without losing raw observations', async () => {
  const { opening, detail } = pairedNestedLocations(row => { row.locations[0].country_code = 'US' })
  const changed = (packet, data) => ({ ...changedPacket(packet, jsonp(data)), evidenceOrigin: 'CONTROLLED_NESTED_SCHEMA_MUTATION_NOT_A_NATIVE_CAPTURE' })
  const sequence = [...packets.slice(0, 3), changed(titles, opening), changed(details, detail)], reader = fixtureReader({}, sequence)
  const provider = getScraperCatalog().find(provider => provider.source === 'flatgigs')
  const jobs = await createCatalogScraper(provider).run({ fetchPacket: reader.read }), job = jobs.find(job => job.jobId === indiaId)
  assert.equal(jobs.length, 3); assert.equal(reader.seen.length, 6)
  assert.equal(job.country, ''); assert.equal(job.location, ''); assert.equal(job.nativeGeographyQualified, false)
  assert.equal(job.nativeIdentityQualified, true); assert.equal(job.nativeDescriptionVisibleQualified, true)
  assert.equal(job.nativeSameModeClosingQualified, false)
  assert.equal(job.nativeRawEvidence.details.find(row => row.country === 'India').locations[0].country_code, 'US')
  assert.equal(jobs.filter(row => row.nativeGeographyQualified && row.country === 'India').length, 2)
  assert.equal(jobs[0].nativeCollectionEvidence.observedListingCount, 104)
  assert.equal(jobs[0].nativeCollectionEvidence.successfulResponses, 5)
  const source = readSourceObservationEvidence(jobs, 'flatgigs'), inventory = readInventoryEvidence(jobs)
  assert.equal(source.observedRecordCount, 73); assert.equal(source.observedVacancyCount, 73)
  assert.equal(source.sourceScopeComplete, false); assert.equal(source.companyIndiaTotal, null)
  assert.equal(inventory.status, 'coverage-gap'); assert.equal(inventory.reportedTotal, null); assert.equal(inventory.verifiedAt, null)
})
