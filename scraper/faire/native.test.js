import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { CAREERS, faireAssets, faireBindings, runNativeFaire } from './native.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixtureDir = new URL('./fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', fixtureDir), 'utf8'))
const records = new Map(manifest.requests.map(receipt => {
  const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, fixtureDir)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return [receipt.url, { ...receipt, body, bodyComplete: true }]
}))
const html = records.get(CAREERS).body.toString(), assets = faireAssets(html)
const page = records.get(assets.page).body.toString(), shared = records.get(assets.shared).body.toString()
const employeeURL = 'https://boards-api.greenhouse.io/v1/boards/faire/jobs?content=true'
const consultantURL = 'https://boards-api.greenhouse.io/v1/boards/faireconsultants/jobs?content=true'
const employeePayload = JSON.parse(records.get(employeeURL).body)
const transport = override => async (url, { signal }) => {
  signal?.throwIfAborted()
  assert.ok(records.has(url), `Uncaptured URL must not be fetched: ${url}`)
  const response = structuredClone(records.get(url))
  return override ? override(response, url) : response
}
const editJSON = (response, edit) => {
  const payload = JSON.parse(Buffer.from(response.body).toString())
  edit(payload)
  return { ...response, body: Buffer.from(JSON.stringify(payload)) }
}
// A synthetic native location tests future India extraction. No current India
// role is represented by this mutation of the captured employer record.
const indiaJob = { ...employeePayload.jobs[0], location: { name: 'Bengaluru, India' }, offices: [], metadata: [] }

test('current advertised Faire modules bind both employee and consultant scopes through public native GET calls', () => {
  const bindings = faireBindings(page, shared, assets)
  assert.deepEqual(bindings.map(binding => [binding.nativeWorkType, binding.boardToken]), [['EMPLOYMENT', 'faire'], ['CONSULTANT', 'faireconsultants']])
  assert.ok(bindings.every(binding => binding.bindingEvidence.verified && binding.bindingEvidence.evidenceURL === assets.shared))
})

test('production catalog reads both captured feeds while keeping whole-company scope unknown', async () => {
  const provider = getScraperCatalog().find(provider => provider.source === 'faire')
  assert.equal(provider.parser, 'current-first-party-native-employee-and-consultant-feeds')
  const reads = []
  const jobs = await createCatalogScraper(provider).run({ transport: transport((response, url) => { reads.push(url); return response }) })
  assert.equal(jobs.length, 0)
  assert.equal(reads.length, 5)
  assert.ok(reads.includes(employeeURL) && reads.includes(consultantURL))
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('a synthetic India role retains its native full content and board work type', async () => {
  const jobs = await runNativeFaire({ transport: transport((response, url) => url === employeeURL
    ? editJSON(response, payload => { payload.jobs = [indiaJob]; payload.meta.total = 1 }) : response) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Faire')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].nativeBoardWorkType, 'EMPLOYMENT')
  assert.ok(jobs[0].sourceDescription.length > 1000)
  assert.ok(jobs[0].officialAtsBinding.matchedLinks[0].endsWith('/faire/departments'))
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('a detached asset, changed native method, credentials request or missing work scope cannot authorize a board', () => {
  assert.throws(() => faireAssets(html.replaceAll(assets.shared, 'https://unrelated.example/43927-stale.js')), /shared careers module/)
  const mutations = [shared.replace('method:"GET",withCredentials:!1', 'method:"POST",withCredentials:!1'),
    shared.replace('method:"GET",withCredentials:!1', 'method:"GET",withCredentials:!0'),
    shared.replace('baseUrl:"https://boards-api.greenhouse.io"', 'baseUrl:"https://unrelated.example"'),
    shared.replace('n.CY.CONSULTANT', 'n.CY.EMPLOYMENT')]
  for (const source of mutations) {
    assert.notEqual(source, shared)
    assert.throws(() => faireBindings(page, source, assets), /GET data flow|inventory hook/)
  }
})

test('a blocked current employer page or failed second feed cannot become a zero-job success', async () => {
  let reads = 0
  await assert.rejects(runNativeFaire({ transport: transport((response, url) => {
    reads++
    return url === CAREERS ? { ...response, status: 403 } : response
  }) }), /HTTP 403/)
  assert.equal(reads, 1)
  await assert.rejects(runNativeFaire({ transport: transport((response, url) => url === consultantURL ? { ...response, status: 503 } : response) }), /HTTP 503/)
})

test('native employer identity, exact feed totals and cross-board duplicate identity must reconcile', async () => {
  await assert.rejects(runNativeFaire({ transport: transport((response, url) => url === employeeURL
    ? editJSON(response, payload => { payload.jobs[0].company_name = 'Other Employer' }) : response) }), /employer label mismatch/)
  await assert.rejects(runNativeFaire({ transport: transport((response, url) => url === employeeURL
    ? editJSON(response, payload => { payload.meta.total++ }) : response) }), /Incomplete greenhouse inventory/)
  await assert.rejects(runNativeFaire({ transport: transport((response, url) => [employeeURL, consultantURL].includes(url)
    ? editJSON(response, payload => {
      const board = url === employeeURL ? 'faire' : 'faireconsultants'
      payload.jobs = [{ ...indiaJob, absolute_url: `https://job-boards.greenhouse.io/${board}/jobs/${indiaJob.id}` }]
      payload.meta.total = 1
    }) : response) }), /duplicate role identity across native scopes/)
})

test('pre-cancelled Faire collection makes no requests', async () => {
  const controller = new AbortController()
  controller.abort(Error('cancel Faire source'))
  await assert.rejects(runNativeFaire({ signal: controller.signal, transport: async () => assert.fail('Cancelled source request') }), /cancel Faire/)
})
