import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

globalThis.fetch = async () => assert.fail('The regression suite must use injected HTTP responses')

const contracts = { meru: { token: 'wearemeru', mode: 'board-handoff' },
  logrocket: { token: 'logrocket', mode: 'role-links-exact' } }
const catalog = getScraperCatalog()
for (const [source, contract] of Object.entries(contracts)) {
  const provider = catalog.find(row => row.source === source), board = `https://jobs.lever.co/${contract.token}`
  const role = (id = 'one-role') => ({ id, text: 'Software Engineer', country: 'US',
    categories: { location: 'Boston or NYC', allLocations: ['Boston or NYC'], commitment: 'Full Time' },
    hostedUrl: `${board}/${id}`, applyUrl: `${board}/${id}/apply`,
    descriptionPlain: 'Build customer services.', lists: [{ text: 'Requirements', content: '<li>Production software experience is required.</li>' }],
    additionalPlain: 'Work with the product and engineering teams.',
  })
  const execute = async ({ records = [role()], html, response = {}, signal } = {}) => {
    const original = structuredClone(records)
    const jobs = await createCatalogScraper(provider).run({ signal,
      fetchPage: async url => ({ status: 200, url, html: html ?? (contract.mode === 'board-handoff'
        ? `<a href="${board}">View all open roles</a>`
        : records.map(row => `<a href="${row.hostedUrl}">View job</a>`).join('')), ...response }),
      fetchJson: async () => records,
    })
    assert.deepEqual(records, original)
    return { jobs, evidence: readInventoryEvidence(jobs) }
  }

  test(`${source} verifies its current employer and complete native country-scoped Lever inventory`, async () => {
    assert.equal(provider.adapter, 'publicAts')
    assert.equal(provider.runtimeInventoryVerification?.mode, contract.mode)
    assert.equal(provider.boardToken, contract.token)
    const { jobs, evidence } = await execute()
    assert.equal(jobs.length, 0)
    assert.equal(evidence.listingComplete, true)
    assert.equal(evidence.reportedTotal, 1)
    assert.equal(evidence.indiaFacetCount, 0)
    assert.equal(evidence.pagesFetched, 2)
  })

  test(`${source} retains explicit primary and secondary India offices and full native criteria`, async () => {
    for (const native of [
      { ...role(), country: 'IN', categories: { location: 'Bengaluru, India', allLocations: ['Bengaluru, India'] } },
      { ...role(), categories: { location: 'Boston, US', allLocations: ['Boston, US', 'Bengaluru, India'] } },
    ]) {
      const { jobs, evidence } = await execute({ records: [native] })
      assert.equal(jobs.length, 1)
      assert.equal(jobs[0].country, 'India')
      assert.equal(jobs[0].location, 'Bengaluru, India')
      assert.match(jobs[0].jobDescription, /Production software experience/)
      assert.match(jobs[0].jobDescription, /product and engineering teams/)
      assert.equal(evidence.listingComplete, true)
      assert.equal(evidence.indiaFacetCount, 1)
    }
  })

  test(`${source} cannot establish source scope from missing, inert, blocked or foreign handoffs`, async () => {
    for (const options of [{ html: '<h1>Careers</h1>' },
      { html: `<template><a href="${board}">All roles</a><a href="${role().hostedUrl}">One role</a></template>` },
      { response: { status: 403 } }, { response: { url: 'https://another-company.invalid/careers' } }]) {
      await assert.rejects(execute(options), /handoff|binding|response|redirect/i)
    }
  })

  test(`${source} unresolved additional location scope cannot become an authoritative zero`, async () => {
    const { evidence } = await execute({ records: [{ ...role(), categories: {
      location: 'Boston, US', allLocations: ['Boston, US', 'Worldwide'],
    } }] })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  })

  test(`${source} additional employer inventories preserve unknown overall scope`, async () => {
    const binding = contract.mode === 'board-handoff' ? board : role().hostedUrl
    const { evidence } = await execute({ html: `<a href="${binding}">Open roles</a>`
      + '<a href="https://jobs.lever.co/another-employer">Other roles</a>' })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  })

  test(`${source} validates native board identity and does not mutate contradictory country evidence`, async () => {
    const binding = contract.mode === 'board-handoff' ? board : role().hostedUrl
    await assert.rejects(execute({ records: [{ ...role(), hostedUrl: 'https://jobs.lever.co/foreign/one-role' }],
      html: `<a href="${binding}">Open roles</a>` }), /identity/)
    await assert.rejects(execute({ records: [{ ...role(), categories: { location: 'Bengaluru, India' } }] }), /contradictory country/)
  })

  test(`${source} honors caller cancellation before any employer or native request`, async () => {
    const controller = new AbortController(), reason = new Error(`stop ${source}`)
    controller.abort(reason)
    await assert.rejects(createCatalogScraper(provider).run({ signal: controller.signal,
      fetchPage: async () => assert.fail('aborted employer request'),
      fetchJson: async () => assert.fail('aborted native request'),
    }), error => error === reason)
  })
}

test('LogRocket advertised role identities must exactly equal the current native feed', async () => {
  const provider = catalog.find(row => row.source === 'logrocket'), first = 'https://jobs.lever.co/logrocket/first'
  const jobs = await createCatalogScraper(provider).run({
    fetchPage: async url => ({ status: 200, url, html: `<a href="${first}">View job</a>` }),
    fetchJson: async () => ['first', 'second'].map(id => ({ id, text: 'Engineer', country: 'US',
      categories: { location: 'Boston', allLocations: ['Boston'] },
      hostedUrl: `https://jobs.lever.co/logrocket/${id}`, applyUrl: `https://jobs.lever.co/logrocket/${id}/apply`,
      descriptionPlain: 'Build reliable customer software.',
    })),
  })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
