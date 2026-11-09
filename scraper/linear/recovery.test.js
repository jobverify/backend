import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { createLinearScraper, extractRoleSummaries } from './script.js'

const manifest = JSON.parse(readFileSync(new URL('./test-data/manifest.json', import.meta.url)))
const bytes = name => gunzipSync(readFileSync(new URL('./test-data/' + manifest.captures[name].file, import.meta.url)))
const careers = bytes('careers').toString('utf8')
const nativePayload = () => JSON.parse(bytes('native-api'))
const firstId = '6dd5500a-4bd4-4f57-ba09-7b07acefecf4'
const mutateNativeRole = change => {
  let html = bytes('native-role').toString('utf8')
  const schemas = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  const data = schemas.find(match => match[1].includes('window.__appData'))
  const assignment = parse(data[1], { ecmaVersion: 'latest' }).body[0].expression.right
  const app = JSON.parse(data[1].slice(assignment.start, assignment.end))
  const schemaMatch = schemas.find(match => match[1].startsWith('{"@context"'))
  const schema = JSON.parse(schemaMatch[1])
  change(app, schema)
  html = html.replace(data[1], data[1].slice(0, assignment.start) + JSON.stringify(app) + data[1].slice(assignment.end))
  return html.replace(schemaMatch[1], JSON.stringify(schema))
}
const transport = ({ html = careers, payload = nativePayload(), alter, requests = [] } = {}) => async url => {
  requests.push(url)
  const entry = Object.entries(manifest.captures).find(([, row]) => row.url === url)
  assert.ok(entry, 'Unexpected public request: ' + url)
  const [name, capture] = entry
  const body = name === 'careers' ? Buffer.from(html) : name === 'native-api' ? Buffer.from(JSON.stringify(payload)) : bytes(name)
  const response = { url, status: 200, headers: { 'content-type': capture.contentType }, body,
    bodyComplete: true, requestedAt: capture.requestedAt, completedAt: capture.completedAt }
  return alter ? alter(response, name) : response
}
const execute = async options => createLinearScraper().run({
  fetchText: async () => options?.html ?? careers, // Reproduce the old implementation without live I/O.
  transport: transport(options),
})

test('Linear extracts all 31 current native identities rather than only 23 grouped title links', () => {
  const rows = extractRoleSummaries(careers)
  assert.equal(rows.length, 31)
  assert.deepEqual(rows[0], {
    id: firstId, title: 'Account Executive, Enterprise', location: 'Singapore',
    url: 'https://linear.app/careers/' + firstId,
    jobUrl: 'https://jobs.ashbyhq.com/Linear/' + firstId,
    applyUrl: 'https://jobs.ashbyhq.com/Linear/' + firstId + '/application',
    team: 'Sales',
  })
  assert.equal(rows.find(row => row.id === 'f16dd5e9-ed10-4b8e-b5d7-1b8b5e3f002f')?.location, 'North America')
})

test('Linear accepts only the exact current renderer cache metadata while preserving all31 bound native identities',()=>{
 const html=gunzipSync(readFileSync(new URL('./test-data/careers-cache-metadata-20261103.html.gz',import.meta.url))).toString()
 assert.equal(createHash('sha256').update(html).digest('hex'),'9b29da9b9f9c630726868e7669f576e47221f2173f55096f48bfa6698023f60b')
 assert.equal(extractRoleSummaries(html).length,31)
 assert.throws(()=>extractRoleSummaries(html.replace('"dynamicStaleTimeSeconds":0','"dynamicStaleTimeSeconds":1')),/runtime metadata changed/)
 assert.throws(()=>extractRoleSummaries(html.replace('"dynamicStaleTimeSeconds":0','"dynamicStaleTimeSeconds":0,"otherPolicy":true')),/runtime metadata changed/)
 assert.throws(()=>extractRoleSummaries(html.replaceAll('__vinext_streaming_metadata_body:route:/careers','__vinext_streaming_metadata_body:route:/unbound')),/metadata route binding missing/)
 assert.throws(()=>extractRoleSummaries(html.replace('<link rel="canonical" href="https://linear.app/careers">','<link rel="canonical" href="https://other.example/careers">')),/metadata does not match original SSR fragment/)
 assert.throws(()=>extractRoleSummaries('<template>'+html+'</template>'),/runtime handoff missing|runtime metadata/)
})

test('registered Linear execution records the checked 31-role public board and preserves its historical clock', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'linear')
  const jobs = await createCatalogScraper(provider).run({ fetchText: async () => careers, transport: transport() })
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.reportedTotal, 31)
  assert.equal(evidence?.indiaFacetCount, 0)
  assert.equal(evidence?.status, 'complete-inventory')
  assert.equal(evidence?.listingComplete, true)
  assert.equal(evidence?.verifiedAt, '2026-10-31T22:39:41.377Z')
  assert.match(evidence?.reason, /official-roles=31;native-roles=31;checked-board-india=0/)
  assert.match(evidence?.reason, /configured-board=complete;company-scope-and-cleanup-unverified/)
  assert.equal(readSourceObservationEvidence(jobs, 'linear')?.observedVacancyCount, 31)
})

test('Linear compares closing native and corporate inventory without promoting company-wide coverage', async () => {
  const requests = []
  const result = await createLinearScraper().collect({ transport: transport({ requests }) })
  assert.equal(requests.filter(url => url === 'https://api.ashbyhq.com/posting-api/job-board/Linear').length, 2)
  assert.equal(result.closingInventoryStable, true)
  assert.equal(result.inventoryEvidence.listingComplete, true)
  assert.equal(result.sourceCompanyWideScopeComplete,false)
})

test('unbound or inert careers data cannot establish the current employer handoff', async () => {
  for (const html of [careers.replace('"page:/careers\\\":\\\"$L2', '"page:/careers\\\":\\\"$Lfff'),
    careers.replaceAll('<script>', '<script type="application/json">'),
    '<template>' + careers + '</template>',
    careers.replaceAll('.rsc.push(', '.unused.push('),
    careers.replaceAll('"vinext.navigationRuntime"', '"unrelated.runtime"')]) {
    await assert.rejects(execute({ html }), /Linear.*(?:careers|runtime|handoff|bound)/i)
  }
})

test('native board/role identity changes and missing advertised roles cannot produce an authoritative zero', async () => {
  const missing = nativePayload(); missing.jobs.pop()
  const foreign = nativePayload(); foreign.jobs[0].applyUrl = foreign.jobs[0].applyUrl.replace('/Linear/', '/Foreign/')
  for (const payload of [missing, foreign]) {
    await assert.rejects(execute({ payload }), /Linear.*(?:identity|reconcil|role)/i)
  }
})

test('unknown native geography keeps the checked India count unknown without guessing from a city', async () => {
  const payload = nativePayload()
  payload.jobs[0].location = 'Bengaluru'; payload.jobs[0].address = {}; payload.jobs[0].secondaryLocations = []
  const jobs = await execute({ payload })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs)?.reason, /native-geography-unresolved/)
})

test('a current India role retains its native description, application, employer, and original published date', async () => {
  const payload = nativePayload()
  const row = payload.jobs.find(row => row.id === firstId)
  row.location = 'Bengaluru, India'; row.address = { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }
  const description = row.descriptionHtml
  const nativeRole = bytes('native-role').toString('utf8')
    .replaceAll('"locationName":"Singapore"', '"locationName":"Bengaluru, India"')
    .replaceAll('"addressCountry":"Singapore"', '"addressCountry":"IN","addressLocality":"Bengaluru"')
    .replaceAll('"name":"Singapore"', '"name":"India"')
    .replace('"datePosted":"2026-10-06"', '"datePosted":"2026-10-06","validThrough":"2026-10-06"')
  const jobs = await execute({ payload, alter: (response, name) => name === 'native-role'
    ? { ...response, body: Buffer.from(nativeRole) } : response })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, firstId)
  assert.equal(jobs[0].company, 'Linear')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].applyUrl, 'https://jobs.ashbyhq.com/Linear/' + firstId + '/application')
  assert.equal(jobs[0].jobDescription, description)
  assert.equal(jobs[0].postingDate, '2026-10-06T00:55:56.942+00:00')
  assert.equal(jobs[0].closingDate, '2026-10-06')
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('a failed selected native detail preserves scope uncertainty instead of publishing an unsupported India role', async () => {
  const payload = nativePayload()
  const row = payload.jobs.find(row => row.id === firstId)
  row.secondaryLocations = [{ location: 'India', address: { postalAddress: { addressCountry: 'India' } } }]
  const jobs = await execute({ payload, alter: (response, name) => name === 'native-role'
    ? { ...response, status: 403, body: Buffer.from('Access denied') } : response })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs)?.reason, /native-detail-unverified/)
})

test('India in a secondary feed location requires the same secondary location in native application data', async () => {
  const payload = nativePayload()
  payload.jobs.find(row => row.id === firstId).secondaryLocations = [
    { location: 'Bengaluru, India', address: { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru' } } },
  ]
  const role = mutateNativeRole((app, schema) => {
    // This contradictory native page still advertises no secondary location.
    assert.deepEqual(app.posting.secondaryLocationNames, [])
    schema.jobLocation = [schema.jobLocation, { '@type': 'Place', address: { addressCountry: 'India' } }]
    schema.applicantLocationRequirements = [{ '@type': 'Country', name: 'Singapore' }, { '@type': 'Country', name: 'India' }]
  })
  const jobs = await execute({ payload, alter: (response, name) => name === 'native-role'
    ? { ...response, body: Buffer.from(role) } : response })
  assert.equal(jobs.length, 0)
  assert.match(readInventoryEvidence(jobs)?.reason, /native-detail-unverified/)
})

test('an unreviewed pagination field cannot turn one native response into a checked India zero', async () => {
  const payload = nativePayload(); payload.nextCursor = 'another-page'
  await assert.rejects(execute({ payload }), /native.*inventory/i)
})

test('selected native details reject employer, role status, description and original-date contradictions', async () => {
  const payload = nativePayload()
  const row = payload.jobs.find(row => row.id === firstId)
  row.location = 'Bengaluru, India'; row.address = { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }
  for (const change of [app => { app.organization.publicWebsite = 'https://foreign.invalid/' },
    app => { app.posting.isListed = false }, app => { app.posting.descriptionHtml = '<p>Different role content</p>' },
    (app, schema) => { schema.datePosted = '2026-10-07' },
    (app, schema) => { schema.validThrough = '2026-10-05' }]) {
    const role = mutateNativeRole((app, schema) => {
      app.posting.locationName = 'Bengaluru, India'
      schema.jobLocation.address.addressCountry = 'IN'
      schema.applicantLocationRequirements.name = 'India'
      change(app, schema)
    })
    const jobs = await execute({ payload, alter: (response, name) => name === 'native-role'
      ? { ...response, body: Buffer.from(role) } : response })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
  }
})

test('one unavailable native detail retains another proven India vacancy and keeps cleanup disabled', async () => {
  const payload = nativePayload(), otherId = 'cb8e77a6-4316-45c6-ac8d-7ade980cd65e'
  const row = payload.jobs.find(row => row.id === firstId)
  row.location = 'Bengaluru, India'; row.address = { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru' } }
  payload.jobs.find(row => row.id === otherId).secondaryLocations = [{ location: 'India', address: { postalAddress: { addressCountry: 'India' } } }]
  const role = mutateNativeRole((app, schema) => {
    app.posting.locationName = 'Bengaluru, India'
    schema.jobLocation.address.addressCountry = 'India'; schema.applicantLocationRequirements.name = 'India'
  })
  const read = transport({ payload, alter: (response, name) => name === 'native-role' ? { ...response, body: Buffer.from(role) } : response })
  const jobs = await createLinearScraper().run({ transport: url => url === 'https://jobs.ashbyhq.com/Linear/' + otherId
    ? { url, status: 403, bodyComplete: true, body: Buffer.from('Access denied'), headers: { 'content-type': 'text/html' } }
    : read(url) })
  assert.deepEqual(jobs.map(job => job.jobId), [firstId])
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs)?.reason, /native-detail-unverified/)
})

test('European Union remains a native region and never becomes a country, while ambiguous remote scope stays unknown', async () => {
  const result = await createLinearScraper().collect({ transport: transport() })
  const scopes = result.geography.find(row => row.jobId === 'd3bc1ced-3ce4-4086-a050-555055dbb1ff').scopes
  assert.equal(scopes[0].nativeCountryRaw, 'European Union')
  assert.equal(scopes[0].country, null)
  assert.equal(scopes[0].region, 'European Union')
  assert.equal(scopes[0].india, false)
  const payload = nativePayload(); payload.jobs[0].location = 'Worldwide'
  assert.equal(readInventoryEvidence(await execute({ payload }))?.indiaFacetCount, null)
})

test('the body byte budget and cancellation between reads prevent further public requests', async () => {
  await assert.rejects(execute({ alter: response => ({ ...response, body: Buffer.alloc(2 * 1024 * 1024 + 1) }) }), /response byte bound/i)
  const controller = new AbortController()
  const read = transport(), requests = []
  await assert.rejects(createLinearScraper().run({ signal: controller.signal, transport: async url => {
    requests.push(url)
    const response = await read(url)
    controller.abort(new Error('cancel-after-careers-response'))
    return response
  } }), /cancel-after-careers-response/)
  assert.deepEqual(requests, ['https://linear.app/careers'])
})

test('denied inventories, incomplete response bytes, redirects and caller cancellation fail closed', async () => {
  for (const alter of [response => ({ ...response, status: 403 }),
    response => ({ ...response, bodyComplete: false }),
    response => ({ ...response, url: 'https://foreign.invalid/careers' }),
    response => ({ ...response, status: 302, headers: { location: 'https://foreign.invalid' } })]) {
    await assert.rejects(execute({ alter }), /Linear.*(?:response|HTTP|identity)/i)
  }
  const controller = new AbortController(); controller.abort(new Error('cancel-linear-check'))
  await assert.rejects(createLinearScraper().run({ signal: controller.signal,
    fetchText: async () => careers, transport: async () => assert.fail('cancelled read must not start') }), /cancel-linear-check/)
})
