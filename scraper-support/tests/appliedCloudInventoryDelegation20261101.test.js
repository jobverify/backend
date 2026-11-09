import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parse } from 'acorn'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { createCatalogScraper, getScraperCatalog, decorateJobsWithProviderMetadata } from '../providers/index.js'
import { INVENTORY_EVIDENCE, readInventoryEvidence, attachInventoryEvidence, mapJobsWithInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createAppliedCloudComputingScraper, PROVIDER_METADATA, BOARD_URL } from '../../scraper/appliedcloudcomputing/script.js'

// Read original synthetic fixtures inertly; do not run their module or change
// native IDs, descriptions, URLs, locations, dates or their historical clock.
const originalText = readFileSync(new URL('./wave7baScript.test.js', import.meta.url), 'utf8')
const ast = parse(originalText, { sourceType: 'module', ecmaVersion: 'latest' })
const read = node => node.type === 'Literal' ? node.value
  : node.type === 'ArrayExpression' ? node.elements.map(read)
  : node.type === 'ObjectExpression' ? Object.fromEntries(node.properties.map(prop => [prop.key.name ?? prop.key.value, read(prop.value)]))
  : node.type === 'TemplateLiteral' && !node.expressions.length ? node.quasis[0].value.cooked
  : (() => { throw Error('Unsupported original static fixture') })()
const fixture = name => read(ast.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).find(node => node.id.name === name).init)
const original = {
  board: fixture('appliedCloudBoardHtml'),
  listing: fixture('appliedCloudListingPayload'),
  details: fixture('appliedCloudDetailPayloadById'),
  clock: fixture('FIXED_SCRAPED_AT'),
}
const LISTING = 'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings?limit=100&country=in&offset=0'
const provider = getScraperCatalog().find(value => value.source === 'appliedcloudcomputing')
const expectedRows = upstream => upstream.map(job => ({ ...job, department: typeof job.department === 'string' ? job.department : null }))
  .sort((left, right) => left.title.localeCompare(right.title))
const input = mode => {
  const requests = [], payloads = []
  const snapshot = value => { payloads.push([value, structuredClone(value)]); return value }
  return {
    requests,
    fetchText: async url => { requests.push(url); assert.equal(url, BOARD_URL); return original.board },
    fetchJson: async url => {
      requests.push(url)
      if (url === LISTING) return snapshot(mode === 'empty' ? { totalFound: 0, content: [] } : structuredClone(original.listing))
      const id = new URL(url).pathname.split('/').at(-1)
      assert.equal(url, PROVIDER_METADATA.config.detail.urlTemplate.replace('{{jobId}}', id))
      assert.ok(Object.hasOwn(original.details, id))
      if (mode === 'partial' && id === original.listing.content[0].id) throw new Error('Controlled optional Applied detail unavailable')
      return snapshot(structuredClone(original.details[id]))
    },
    assertUnchanged() { for (const [value, copy] of payloads) assert.deepEqual(value, copy) },
  }
}
const sameRows = (jobs, expected) => {
  assert.equal(jobs.length, expected.length)
  for (let index = 0; index < expected.length; index++) {
    for (const key of Reflect.ownKeys(expected[index])) assert.deepEqual(jobs[index][key], expected[index][key], 'original field ' + String(key))
    assert.notEqual(jobs[index].sourceScopeComplete, true)
    assert.notEqual(jobs[index].sourceCompanyCoverageComplete, true)
    assert.ok(jobs[index].sourceGlobalJobCount == null && jobs[index].sourceIndiaJobCount == null)
  }
}

for (const mode of ['complete', 'partial', 'empty']) {
  test('Applied Cloud real engine, source factory and registered route preserve ' + mode + ' inventory evidence and original fields', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(original.clock) })
    const untouched = structuredClone(original)
    assert.equal(provider.adapter, 'script')
    assert.match(provider.modulePath, /appliedcloudcomputing[\\/]script\.js$/)
    assert.equal(provider.source, PROVIDER_METADATA.source)
    assert.equal(provider.companyName, PROVIDER_METADATA.companyName)
    assert.equal(provider.atsPlatform, 'smartrecruiters')
    const referenceInput = input(mode)
    const upstream = await runApiPortalScraper({ provider: PROVIDER_METADATA, fetchJson: referenceInput.fetchJson })
    const evidence = readInventoryEvidence(upstream)
    assert.ok(evidence, 'the real upstream engine must first provide the carrier')
    assert.equal(evidence.status, mode === 'partial' ? 'discovery-only' : mode === 'empty' ? 'verified-empty' : 'complete-inventory')
    assert.equal(evidence.listingComplete, mode !== 'partial')
    assert.equal(evidence.reportedTotal, mode === 'empty' ? 0 : original.listing.totalFound)
    assert.equal(evidence.pagesFetched, 1)
    assert.equal(evidence.verifiedAt, original.clock)
    assert.equal(evidence.surface, PROVIDER_METADATA.config.discovery.listingApiUrl)
    assert.equal(Object.getOwnPropertyDescriptor(upstream, INVENTORY_EVIDENCE).enumerable, false)
    const expected = expectedRows(upstream)
    const directInput = input(mode), registeredInput = input(mode)
    const direct = await createAppliedCloudComputingScraper().run(directInput)
    const registered = await createCatalogScraper(provider).run(registeredInput)
    sameRows(direct, expected); sameRows(registered, expected)
    assert.deepEqual(direct, expected, 'the wrapper adds only its existing department decoration and sort')
    assert.deepEqual({ direct: readInventoryEvidence(direct), registered: readInventoryEvidence(registered) },
      { direct: evidence, registered: evidence }, 'both source factory and real registered route must retain the upstream envelope')
    for (const jobs of [direct, registered]) {
      assert.deepEqual(Object.getOwnPropertyDescriptor(jobs, INVENTORY_EVIDENCE), Object.getOwnPropertyDescriptor(upstream, INVENTORY_EVIDENCE))
    }
    if (mode === 'partial') {
      assert.match(evidence.reason, /optional-role-details-unavailable/)
      assert.equal(direct.find(job => job.jobId === original.listing.content[0].id).jobDescription, null)
      assert.ok(direct.every(job => job.sourceListingComplete === false))
    }
    assert.deepEqual(directInput.requests, [BOARD_URL, ...referenceInput.requests])
    assert.deepEqual(registeredInput.requests, directInput.requests)
    referenceInput.assertUnchanged(); directInput.assertUnchanged(); registeredInput.assertUnchanged()
    assert.deepEqual(original, untouched)
  })
}

test('Applied existing-helper boundary preserves unverified or absent evidence without minting source authority', () => {
  // The engine does not emit status=unverified. This is a labelled helper cause
  // control; the real source/registered tests above use the actual engine.
  const jobs = [{ title: original.listing.content[0].name, department: original.listing.content[0].department }]
  attachInventoryEvidence(jobs, { status: 'unverified', surface: BOARD_URL, firstParty: false, listingComplete: false,
    pagesFetched: 0, reportedTotal: null, indiaFacetCount: null, verifiedAt: null, reason: 'Controlled unverified input' })
  const mapped = mapJobsWithInventoryEvidence(jobs, job => ({ ...job, department: typeof job.department === 'string' ? job.department : null }))
    .sort((left, right) => left.title.localeCompare(right.title))
  assert.deepEqual(readInventoryEvidence(mapped), readInventoryEvidence(jobs))
  assert.equal(mapped[0].department, null)
  const registered = decorateJobsWithProviderMetadata(mapped, provider)
  assert.deepEqual(readInventoryEvidence(registered), readInventoryEvidence(jobs))
  assert.equal(readInventoryEvidence(registered).status, 'unverified')
  assert.equal(readInventoryEvidence(registered).verifiedAt, null)
  const withoutCarrier = mapJobsWithInventoryEvidence(jobs.map(job => ({ ...job })), job => ({ ...job }))
  assert.equal(readInventoryEvidence(withoutCarrier), null)
  assert.equal(Object.getOwnPropertyDescriptor(withoutCarrier, INVENTORY_EVIDENCE), undefined)
})
