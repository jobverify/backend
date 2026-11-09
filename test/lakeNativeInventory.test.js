import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, normalizeLocationData } from '../scraper/lakechemicalspvtltd/script.js'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/lakechemicalspvtltd/fixtures/native-20261029.json.gz', import.meta.url))))
const home = 'https://lakechemicals.com/', board = 'https://lakechemicals.com/job-search'
test('Lake context-free location parser never guesses India from a city or missing value', () => {
  for (const value of ['', 'Bangalore', 'Attibele (Factory)', 'Shivajinagar (Head Office)']) {
    const location = normalizeLocationData(value)
    assert.equal(location.country, null)
    assert.equal(location.city, null)
    assert.equal(location.location, value || null)
  }
})
const execute = async (t, { change = () => {}, options = {}, registered = false } = {}) => {
  const calls = [], counts = {}, audits = []
  const fetchImpl = async (input, init = {}) => {
    const url = String(input)
    init.signal?.throwIfAborted()
    assert.equal(init.method || 'GET', 'GET')
    const row = structuredClone(fixture.responses[url])
    assert.ok(row, `Unexpected public URL ${url}`)
    calls.push(url); counts[url] = (counts[url] || 0) + 1
    change(row, url, counts[url])
    const response = new Response(row.body, { status: row.status, headers: { 'content-type': 'text/html;charset=utf-8' } })
    Object.defineProperty(response, 'url', { value: row.url })
    return response
  }
  t.mock.method(globalThis, 'fetch', fetchImpl)
  const args = { onAudit: value => audits.push(value), fetchImpl, minIntervalMs: 0, ...options }
  const jobs = await (registered ? createCatalogScraper(getScraperCatalog().find(row => row.source === 'lakechemicalspvtltd')).run(args) : run(args))
  return { jobs, evidence: readInventoryEvidence(jobs), calls, audits }
}

test('Lake current native cards preserve all six full criteria and role-assigned country evidence', async t => {
  const { jobs, evidence, audits, calls } = await execute(t)
  assert.equal(jobs.length, 6)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 6)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audits[0].nativeRecords, 6)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true && job.sourceListingComplete === false))
  assert.ok(jobs.every(job => job.jobDescription === job.sourceDescription && /Qualification\s*:/.test(job.jobDescription)
    && /Experience\s*:/.test(job.jobDescription) && /Skills\s*:/.test(job.jobDescription)))
  assert.ok(jobs.every(job => !job.jobDescription.includes('Apply via the official')))
  assert.equal(jobs.filter(job => job.sourceWorksiteCountryProof.roleLocation === 'Attibele (Factory)').length, 5)
  assert.equal(jobs.filter(job => job.sourceWorksiteCountryProof.roleLocation === 'Shivajinagar (Head Office)').length, 1)
  assert.ok(jobs.every(job => job.sourceWorksiteCountryProof.nativeAddress.includes('(India)')))
  assert.deepEqual(calls, [home, board, home, board])
  assert.equal(audits[0].unknownCountryRoles.length, 0)
})

test('Lake registered scraper preserves own records while company scope remains incomplete', async t => {
  const { jobs, evidence } = await execute(t, { registered: true })
  assert.equal(jobs.length, 6)
  assert.equal(evidence.listingComplete, false)
  assert.ok(jobs.every(job => job.source === 'lakechemicalspvtltd' && job.lifecycleCleanupAllowed === false))
})

test('Lake a city-only role is not assigned the headquarters country', async t => {
  const { jobs, evidence, audits } = await execute(t, { change: (row, url) => {
    if (url === board) row.body = row.body.replaceAll('Attibele (Factory)', 'Bangalore')
  } })
  assert.equal(jobs.length, 1)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audits[0].unknownCountryRoles.length, 5)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('Lake missing worksite country preserves six unresolved native records without verified zero', async t => {
  const { jobs, evidence, audits } = await execute(t, { change: (row, url) => {
    if (url === home) row.body = row.body.replaceAll('(India)', '(Unknown)')
  } })
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.notEqual(evidence.status, 'verified-empty')
  assert.equal(audits[0].unknownCountryRoles.length, 6)
})

test('Lake conflicting role-owned country takes precedence over the assigned-site match', async t => {
  const { jobs, evidence, audits } = await execute(t, { change: (row, url) => {
    if (url === board) { assert.ok(row.body.includes('>Qualification<')); row.body = row.body.replace('>Qualification<', '>Country: United States Qualification<') }
  } })
  assert.equal(jobs.length, 5)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audits[0].unknownCountryRoles.length, 1)
})

test('Lake a multiple-country worksite address cannot qualify India', async t => {
  const { jobs, evidence, audits } = await execute(t, { change: (row, url) => {
    if (url === home) row.body = row.body.replace('21-M, Attibele Industrial Area', 'United States; 21-M, Attibele Industrial Area')
  } })
  assert.equal(jobs.length, 1)
  assert.equal(evidence.listingComplete, false)
  assert.equal(audits[0].unknownCountryRoles.length, 5)
})

test('Lake an untagged additional visible role leaves source inventory unknown', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => {
    if (url === board) row.body = row.body.replace('</body>', '<article><h3>Additional Engineer</h3><p>Qualification: Degree. Experience: Two years. Skills: Reliable production systems and safety procedures. Location: Attibele (Factory)</p></article></body>')
  } })
  assert.equal(jobs.length, 6)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

for (const [label, html] of [
  ['neutral ATS link', '<a href="https://jobs.lever.co/lakechemicals">More</a>'],
  ['application form', '<form action="https://recruiting.example/upload"><input name="resume"></form>'],
  ['recruiting script', '<script src="https://boards.greenhouse.io/embed/job_board/js?for=lakechemicals"></script>'],
  ['data hiring widget', '<div data-hiring-url="https://jobs.ashbyhq.com/another"></div>'],
  ['active frame', '<iframe src="https://recruiting.example/openings"></iframe>'],
]) test(`Lake unreviewed ${label} retains known jobs but source coverage remains unknown`, async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => { if (url === board) row.body += html } })
  assert.equal(jobs.length, 6)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('Lake inert embedded text does not introduce an active hiring channel', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => {
    if (url === board) row.body += '<template><div data-hiring-url="https://jobs.ashbyhq.com/another"></div></template>'
  } })
  assert.equal(jobs.length, 6)
  assert.equal(evidence.listingComplete, false)
})

test('Lake closing role changes exclude the contradicted record while preserving other verified roles', async t => {
  const {jobs,evidence}=await execute(t, { change: (row, url, count) => {
    if (url === board && count > 1) row.body = row.body.replaceAll('Marketing Executive', 'Marketing Director')
  } })
  assert.equal(jobs.length,5)
  assert.ok(!jobs.some(job=>job.title==='Marketing Executive'))
  assert.equal(evidence.listingComplete,false)
})

test('Lake stylesheet-hidden worksite country cannot qualify its assigned role', async t => {
  const { jobs, evidence, audits } = await execute(t, { change: (row, url) => {
    if (url === home) row.body += '<style>[data-aid="CONTACT_INFO_ADDRESS_REND"] { display:none; }</style>'
  } })
  assert.equal(jobs.length, 5)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audits[0].unknownCountryRoles.length, 1)
})

test('Lake response status and observed URL are required evidence', async t => {
  await assert.rejects(execute(t, { change: (row, url) => { if (url === board) row.url = 'https://other.example/job-search' } }), /HTTP|URL|identity|response/i)
})

test('Lake unavailable first-party pages cannot become empty inventory', async t => {
  await assert.rejects(execute(t, { change: row => { row.status = 503 } }), /HTTP|response|unavailable/i)
})

test('Lake unsupported body-only transports and page limits are rejected', async t => {
  await assert.rejects(execute(t, { options: { fetchText: async () => '' } }), /metadata|body.only|unsupported/i)
  await assert.rejects(execute(t, { options: { maxPages: 1 } }), /page limit|unsupported/i)
})

test('Lake pre-cancellation stops before public HTTP', async t => {
  const controller = new AbortController(); controller.abort(new Error('stop source'))
  await assert.rejects(execute(t, { options: { signal: controller.signal } }), /stop source/)
})
