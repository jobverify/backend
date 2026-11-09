import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { attachGreenhouseSourceEvidence } from '../scraper-support/utils/greenhouseSourceEvidence.js'
import { run as standalone, extractEmbeddedFirstPartyJobs, hasOfficialCareersPageSignal } from '../scraper/glance/script.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/scraperRun42395458143GlanceInventory.json.gz', import.meta.url))))
const original = JSON.parse(capture.api.body)
const provider = () => getScraperCatalog().find(row => row.source === 'glance')
const scriptPattern = /<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
const rewriteOfficial = (html, mutate) => html.replace(scriptPattern, (script, json) => {
  const payload = JSON.parse(json)
  const groups = payload.props.pageProps.jobsDepartmentWise
  mutate(groups, payload)
  return script.replace(json, JSON.stringify(payload))
})
const firstOfficial = groups => Object.values(groups).flat()[0]
const baseCountry = row => row.metadata.find(entry => entry.name === 'Base Country')
const run = async (t, { payload = structuredClone(original), html = capture.official.body, maxJobs = null } = {}) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const options = {
    maxJobs, now: () => capture.observedAt,
    fetchText: async url => { assert.equal(url, capture.official.requestedUrl); return html },
    fetchJson: async url => { assert.equal(url, capture.api.requestedUrl); return payload },
  }
  return createCatalogScraper(provider()).run(options)
}

test('registered Glance proves original official/API 35-role inventory and all 22 India roles', async t => {
  const payload = structuredClone(original)
  const jobs = await run(t, { payload })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 35)
  assert.equal(evidence.indiaFacetCount, 22)
  assert.equal(evidence.pagesFetched, 1)
  assert.deepEqual(jobs.map(job => job.jobId).sort(), capture.expectedIndiaIds)
  assert.ok(jobs.every(job => job.source === 'glance' && job.company === 'Glance' && job.country === 'India'
    && job.sourceDetailComplete === true && job.sourceUrl === 'https://glance.com/careers/' + job.jobId
    && job.applyUrl === 'https://job-boards.greenhouse.io/glance/jobs/' + job.jobId
    && job.jobDescription.length > 200
    && job.sourceNativeCountryEvidence?.field === 'metadata.Base Country'
    && job.sourceNativeCountryEvidence.value === 'India'))
  for (const job of jobs) {
    const native = original.jobs.find(row => String(row.id) === job.jobId)
    assert.deepEqual(job.sourceNativeCountryEvidence.nativeMetadata, baseCountry(native))
    assert.equal(job.sourceNativeCountryEvidence.interpretation, 'country')
    assert.equal(job.sourceNativeCountryEvidence.validationViewField, 'Country')
  }
  assert.deepEqual(payload, original, 'The original native payload must remain unchanged')
  const direct = await standalone({ fetchText: async () => capture.official.body, fetchJson: async () => structuredClone(original) })
  assert.deepEqual(direct.map(job => [job.jobId, job.jobDescription]), jobs.map(job => [job.jobId, job.jobDescription]))
  assert.equal(readInventoryEvidence(direct)?.listingComplete, true)
})

for (const [label, mutate] of [
  ['a missing first-party role', groups => { Object.values(groups).find(rows => rows.length).pop() }],
  ['a foreign first-party board', groups => { firstOfficial(groups).absolute_url = firstOfficial(groups).absolute_url.replace('/glance/', '/foreignboard/') }],
  ['a foreign first-party role ID', groups => { firstOfficial(groups).absolute_url = 'https://job-boards.greenhouse.io/glance/jobs/999999999' }],
]) test('registered Glance rejects ' + label, async t => {
  await assert.rejects(run(t, { html: rewriteOfficial(capture.official.body, mutate) }), /first-party|inventor|identity/i)
})

for (const [label, wrap] of [
  ['template', script => '<template>' + script + '</template>'],
  ['noscript', script => '<noscript>' + script + '</noscript>'],
  ['hidden element', script => '<div hidden>' + script + '</div>'],
  ['HTML comment', script => '<!--' + script + '-->'],
  ['duplicate active carrier', script => script + script],
]) test('registered Glance refuses ' + label + ' as official role-set proof', async t => {
  const html = capture.official.body.replace(scriptPattern, script => wrap(script))
  await assert.rejects(run(t, { html }), /first-party|active|carrier/i)
})

for (const [label, mutate] of [
  ['a missing native role', payload => { payload.jobs.pop() }],
  ['a foreign native board', payload => { payload.jobs[0].absolute_url = payload.jobs[0].absolute_url.replace('/glance/', '/foreignboard/') }],
  ['a foreign native role ID', payload => { payload.jobs[0].absolute_url = 'https://job-boards.greenhouse.io/glance/jobs/999999999' }],
  ['a duplicate native ID', payload => { payload.jobs[1] = structuredClone(payload.jobs[0]) }],
]) test('registered Glance rejects ' + label, async t => {
  const payload = structuredClone(original)
  mutate(payload)
  await assert.rejects(run(t, { payload }), /inventor|foreign|identity|board|URL|detail route/i)
})

for (const [label, mutate] of [
  ['missing total', payload => { delete payload.meta }],
  ['truncated native total', payload => { payload.meta.total++ }],
  ['string native total', payload => { payload.meta.total = String(payload.meta.total) }],
]) test('registered Glance retains incomplete evidence for ' + label, async t => {
  const payload = structuredClone(original)
  mutate(payload)
  const jobs = await run(t, { payload })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs)?.status, 'complete-inventory')
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})

for (const [label, mutate] of [
  ['missing Base Country', row => { row.metadata = row.metadata.filter(entry => entry.name !== 'Base Country') }],
  ['empty Base Country', row => { baseCountry(row).value = [] }],
  ['null Base Country', row => { baseCountry(row).value = null }],
  ['scalar Base Country', row => { baseCountry(row).value = 'India' }],
  ['object Base Country', row => { baseCountry(row).value = [{ country: 'India' }] }],
  ['ambiguous Base Country', row => { baseCountry(row).value = ['India', 'Japan'] }],
  ['duplicate Base Country', row => { row.metadata.push(structuredClone(baseCountry(row))) }],
  ['wrong Base Country field type', row => { baseCountry(row).value_type = 'single_select' }],
]) test('registered Glance rejects ' + label, async t => {
  const payload = structuredClone(original)
  mutate(payload.jobs[0])
  await assert.rejects(run(t, { payload }), /Base Country|native country|malformed/i)
})

for (const [label, mutate] of [
  ['foreign Base Country with India location', row => { baseCountry(row).value = ['Philippines'] }],
  ['a contradictory native location', row => { row.location.name = 'Manila, Philippines' }],
  ['a contradictory native office', row => { row.offices[0].location = 'Manila, Philippines' }],
  ['a conflicting generic Country field', row => { row.metadata.push({ name: 'Country', value: 'Philippines' }) }],
]) test('registered Glance rejects ' + label, async t => {
  const payload = structuredClone(original)
  mutate(payload.jobs[0])
  await assert.rejects(run(t, { payload }), /contradict|country|Country|scope/i)
})

test('registered Glance rejects a first-party country that disagrees with the native role', async t => {
  const html = rewriteOfficial(capture.official.body, groups => { baseCountry(firstOfficial(groups)).value = ['Philippines'] })
  await assert.rejects(run(t, { html }), /contradict|country|Country|scope/i)
})

test('registered Glance rejects contradictory first-party office data', async t => {
  const html = rewriteOfficial(capture.official.body, groups => { firstOfficial(groups).offices = [{ name: 'Manila', location: 'Manila, Philippines' }] })
  await assert.rejects(run(t, { html }), /contradict|country|Country|scope/i)
})

for (const [label, content] of [
  ['empty description', ''],
  ['application prompt', '<p>Apply now</p>'],
  ['section label', '<p>Job Description</p>'],
  ['image-only description', '<p><img src="https://glance.com/job-description.png"></p>'],
  ['inactive full description', '<template>' + original.jobs[0].content + '</template><p>Apply now</p>'],
  ['comment-padded prompt', '<!--' + original.jobs[0].content + '--><p>Apply now</p>'],
]) test('registered Glance keeps ' + label + ' incomplete', async t => {
  const payload = structuredClone(original)
  payload.jobs[0].content = content
  const jobs = await run(t, { payload })
  const affected = jobs.find(job => job.jobId === String(payload.jobs[0].id))
  assert.equal(affected.sourceDetailComplete, false)
  assert.equal(affected.sourceDetailFailureKind, 'missing-content')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

for (const maxJobs of [0, 1]) test('registered Glance cap ' + maxJobs + ' cannot claim full India inventory', async t => {
  const jobs = await run(t, { maxJobs })
  assert.equal(jobs.length, maxJobs)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 35)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

for (const [label, url] of [
  ['insecure first-party application authority', 'http://job-boards.greenhouse.io/glance/jobs/8054915'],
  ['credentialed first-party application authority', 'https://other@job-boards.greenhouse.io/glance/jobs/8054915'],
  ['foreign first-party application port', 'https://job-boards.greenhouse.io:444/glance/jobs/8054915'],
]) test('registered Glance rejects ' + label, async t => {
  const html = rewriteOfficial(capture.official.body, groups => { firstOfficial(groups).absolute_url = url })
  await assert.rejects(run(t, { html }), /first-party|authority|identity/i)
})

for (const carrier of ['native', 'first-party']) {
  test('registered Glance rejects an explicitly hidden ' + carrier + ' role', async t => {
    const payload = structuredClone(original)
    let html = capture.official.body
    if (carrier === 'native') payload.jobs[0].isListed = false
    else html = rewriteOfficial(html, groups => { firstOfficial(groups).isListed = false })
    await assert.rejects(run(t, { payload, html }), /hidden|unlisted|identity/i)
  })
  test('registered Glance rejects a foreign ' + carrier + ' employer declaration', async t => {
    const payload = structuredClone(original)
    let html = capture.official.body
    if (carrier === 'native') payload.jobs.find(row => baseCountry(row).value[0] === 'Japan').company_name = 'Foreign Employer'
    else html = rewriteOfficial(html, groups => { firstOfficial(groups).company_name = 'Foreign Employer' })
    await assert.rejects(run(t, { payload, html }), /employer|company identity/i)
  })
}

test('registered Glance rejects an unadvertised Greenhouse host alias', async t => {
  const html = rewriteOfficial(capture.official.body, groups => {
    firstOfficial(groups).absolute_url = 'https://www.job-boards.greenhouse.io/glance/jobs/8054915'
  })
  await assert.rejects(run(t, { html }), /first-party|authority|identity/i)
})

test('registered Glance preserves case-insensitive declared employer matching', async t => {
  const payload = structuredClone(original)
  payload.jobs[0].company_name = 'glance'
  const jobs = await run(t, { payload })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.equal(jobs.length, 22)
})

test('Glance Base Country remains unknown to collectors without the source-owned opt-in', async () => {
  const jobs = await standalone({ fetchText: async () => capture.official.body, fetchJson: async () => structuredClone(original) })
  const evidence = await attachGreenhouseSourceEvidence(jobs, {
    source: 'unrelated-control', companyName: 'Glance', companyCareerPage: 'https://glance.com/careers',
    boardToken: 'glance', payload: structuredClone(original),
  })
  assert.equal(readInventoryEvidence(evidence)?.listingComplete, false)
  assert.match(readInventoryEvidence(evidence).reason, /native-location-scope-unresolved/)
})


const foreignEmbeddedRole = groups => ({ ...structuredClone(firstOfficial(groups)), id: 99999999,
  absolute_url: 'https://job-boards.greenhouse.io/foreign/jobs/99999999', company_name: 'Foreign Employer' })
for (const [label, mutate] of [
  ['an object-valued department carrying an unlisted foreign role', groups => { groups.UnparsedForeignDepartment = foreignEmbeddedRole(groups) }],
  ['a null department', groups => { groups.UnparsedDepartment = null }],
  ['a string department', groups => { groups.UnparsedDepartment = 'unparsed role' }],
  ['a numeric department', groups => { groups.UnparsedDepartment = 1 }],
  ['a boolean department', groups => { groups.UnparsedDepartment = true }],
  ['a null row', groups => { Object.values(groups)[0].push(null) }],
  ['a string row', groups => { Object.values(groups)[0].push('unparsed role') }],
  ['a numeric row', groups => { Object.values(groups)[0].push(1) }],
  ['a boolean row', groups => { Object.values(groups)[0].push(false) }],
  ['an empty array row', groups => { Object.values(groups)[0].push([]) }],
  ['an array row hiding a foreign role', groups => { Object.values(groups)[0].push([foreignEmbeddedRole(groups)]) }],
  ['an array-valued department map', (groups, payload) => { payload.props.pageProps.jobsDepartmentWise = Object.values(groups) }],
  ['a null department map', (_groups, payload) => { payload.props.pageProps.jobsDepartmentWise = null }],
  ['a string department map', (_groups, payload) => { payload.props.pageProps.jobsDepartmentWise = 'unparsed inventory' }],
  ['a numeric department map', (_groups, payload) => { payload.props.pageProps.jobsDepartmentWise = 1 }],
  ['a boolean department map', (_groups, payload) => { payload.props.pageProps.jobsDepartmentWise = true }],
  ['an absent own department map', (_groups, payload) => { delete payload.props.pageProps.jobsDepartmentWise }],
]) test('Glance strict embedded inventory shape rejects '+label+' before native enumeration', async t=>{
  const html = rewriteOfficial(capture.official.body, mutate)
  assert.throws(()=>extractEmbeddedFirstPartyJobs(html), /embedded|department|inventory|row|object|array/i)
  assert.equal(hasOfficialCareersPageSignal(html), false)
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  let nativeRequests = 0
  await assert.rejects(createCatalogScraper(provider()).run({
    fetchText: async url => { assert.equal(url, capture.official.requestedUrl); return html },
    fetchJson: async () => { nativeRequests++; return structuredClone(original) },
  }), /first-party|embedded|department|inventory/i)
  assert.equal(nativeRequests, 0, 'Malformed official inventory cannot be hidden by an agreeing native subset')
})
