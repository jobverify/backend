import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const provider = getScraperCatalog().find(row => row.source === 'automox')
const row = (id = 5440188008) => ({ id, title: 'Full-Stack Software Engineer',
  location: { name: 'Remote - Austin, TX - Denver, CO - Tampa, FL' },
  absolute_url: `https://job-boards.greenhouse.io/automox/jobs/${id}`,
  offices: [{ id: 4009483008, name: 'United States', location: null,
    child_ids: [4010759008, 4010757008, 4010758008], parent_id: null }], metadata: null,
  content: '&lt;p&gt;Build services, maintain customer integrations, and test production systems.&lt;/p&gt;',
})
const execute = async ({ records = [row()], html, currentProvider = provider } = {}) => {
  const payload = { jobs: records, meta: { total: records.length } }, original = structuredClone(payload)
  const jobs = await createCatalogScraper(currentProvider).run({
    fetchPage: async url => ({ status: 200, url, html: html ?? records.map(record =>
      `<a href="${record.absolute_url}">${record.title}</a>`).join('') }),
    fetchJson: async () => payload,
  })
  assert.deepEqual(payload, original, 'Native role and office data must remain unchanged')
  return { jobs, evidence: readInventoryEvidence(jobs) }
}

test('Automox reconciles all qualified city/state alternatives with its native assigned US office', async () => {
  assert.equal(provider.runtimeInventoryVerification?.mode, 'role-links-exact')
  const { jobs, evidence } = await execute()
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.match(evidence.reason, /native-worksite-country-verified:5440188008=US@[a-f0-9]{64}/)
})

test('the corroborated US state codes match the retained official USPS reference', async () => {
  const reference = await readFile(new URL('../scraper/esw/fixtures/usps-state-abbreviations-20261027.html', import.meta.url), 'utf8')
  for (const [state, code] of [['Colorado', 'CO'], ['Florida', 'FL'], ['Texas', 'TX']]) {
    assert.match(reference, new RegExp(`${state}[\\s\\S]{0,500}>${code}<`, 'i'))
  }
})

test('a city-only label, unknown state, or missing assigned country retains unknown geography', async () => {
  for (const change of [
    { location: { name: 'Remote - Austin - Denver - Tampa' } },
    { location: { name: 'Remote - Austin, ZZ - Denver, CO' } },
    { location: { name: 'Remote' } },
    { offices: [] },
    { offices: [{ name: 'APAC', location: null }] },
    { offices: [{ name: 'United States', location: 'Remote' }] },
  ]) {
    const { evidence } = await execute({ records: [{ ...row(), ...change }] })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('an exact native office address corroborates only its matching city and US state', async () => {
  const record = { ...row(), location: { name: 'Indianapolis, IN' },
    offices: [{ name: 'Tenon', location: 'Indianapolis, Indiana, United States' }] }
  const { evidence } = await execute({ records: [record] })
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 0)
  for (const location of ['Chicago, Illinois, United States', 'Indianapolis, Illinois, United States',
    'Indianapolis, Indiana, Canada']) {
    const partial = await execute({ records: [{ ...record, offices: [{ name: 'Tenon', location }] }] })
    assert.equal(partial.evidence.listingComplete, false, location)
    assert.equal(partial.evidence.indiaFacetCount, null, location)
  }
})

test('the registered Tenon scraper verifies its employer and exact native office address', async () => {
  const tenon = getScraperCatalog().find(row => row.source === 'tenon')
  assert.equal(tenon.adapter, 'publicAts')
  const jobs = await createCatalogScraper(tenon).run({
    fetchPage: async url => ({ status: 200, url, html: '<a href="https://job-boards.greenhouse.io/tenon">See open positions</a>' }),
    fetchJson: async () => ({ jobs: [{ ...row(8067766), location: { name: 'Indianapolis, IN' },
      absolute_url: 'https://job-boards.greenhouse.io/tenon/jobs/8067766',
      offices: [{ name: 'Tenon', location: 'Indianapolis, Indiana, United States' }] }], meta: { total: 1 } }),
  })
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('every geographic alternative must resolve without an additional India or global worksite', async () => {
  for (const label of ['Remote - Austin, TX - Kochi', 'Remote - Austin, TX - Worldwide',
    'Remote - Austin, TX - APAC', 'Remote - Austin, TX / Toronto', 'Remote - Austin, TX - Mumbai, MH']) {
    const { evidence } = await execute({ records: [{ ...row(), location: { name: label } }] })
    assert.equal(evidence.listingComplete, false, label)
    assert.equal(evidence.indiaFacetCount, null, label)
  }
})

test('additional or contradictory assigned office geography is not covered by one US office', async () => {
  for (const offices of [
    [...row().offices, { name: 'Remote', location: null }],
    [...row().offices, { name: 'Bengaluru, India', location: null }],
    [{ ...row().offices[0], addressCountry: 'Canada' }],
  ]) {
    const { evidence } = await execute({ records: [{ ...row(), offices }] })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('unhandled native location metadata remains unresolved after a qualified worksite match', async () => {
  const { evidence } = await execute({ records: [{ ...row(), metadata: [{ name: 'Hiring Region', value: 'APAC' }] }] })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('native employer binding and exact advertised role reconciliation remain required', async () => {
  await assert.rejects(execute({ html: '<h1>Careers</h1>' }), /handoff not established/)
  const { evidence } = await execute({ records: [row(), row(4118947008)],
    html: `<a href="${row().absolute_url}">One current opening</a>` })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('proven India roles remain in a mixed native inventory with qualified US worksites', async () => {
  const india = { ...row(5454357008), location: { name: 'Bengaluru, India' }, offices: [] }
  const { jobs, evidence } = await execute({ records: [row(), india] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].title, india.title)
  assert.match(jobs[0].jobDescription, /maintain customer integrations/)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 1)
})

test('an unbound native US office cannot resolve a role from another board', async () => {
  await assert.rejects(createPublishingGapAtsScraper({ ...provider, runtimeInventoryVerification: undefined }).run({
    fetchJson: async () => ({ jobs: [{ ...row(), absolute_url: 'https://job-boards.greenhouse.io/foreign/jobs/5440188008' }], meta: { total: 1 } }),
  }), /\[automox\] Invalid greenhouse inventory: foreign native posting account/)
})
