import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const provider = getScraperCatalog().find(row => row.source === 'choco')
const homepage = 'https://choco.com/us/careers'
const advertised = 'https://choco.com/careers/open-roles'
const canonical = 'https://choco.com/us/careers/open-roles'
const embed = '<script src="https://jobs.ashbyhq.com/choco/embed"></script>'
const role = (location = 'Chicago', country = 'USA') => ({
  id: 'fixture-role', title: 'Solutions Engineer', isListed: true, location,
  address: { postalAddress: { addressCountry: country } }, secondaryLocations: [],
  jobUrl: 'https://jobs.ashbyhq.com/choco/fixture-role',
  applyUrl: 'https://jobs.ashbyhq.com/choco/fixture-role/application',
  descriptionPlain: 'Build, test, and maintain customer integrations with the engineering team.',
})
const execute = async ({ parent = `<a href="${advertised}">View open roles</a>`, child = embed,
  finalUrl = canonical, childStatus = 200, records = [role()], currentProvider = provider, signal } = {}) => {
  const requests = []
  const jobs = await createCatalogScraper(currentProvider).run({ signal,
    fetchPage: async url => {
      requests.push(url)
      if (url === homepage) return { status: 200, url, html: parent }
      assert.ok([advertised, canonical].includes(url))
      return { status: childStatus, url: finalUrl, html: child }
    },
    fetchJson: async url => {
      requests.push(url)
      return { apiVersion: '1', jobs: records }
    },
  })
  return { jobs, requests, evidence: readInventoryEvidence(jobs) }
}

test('Choco follows its currently advertised employer subpage before verifying the complete native feed', async () => {
  assert.deepEqual(provider.runtimeInventoryVerification?.employerHandoffPages, [canonical, advertised])
  const { jobs, requests, evidence } = await execute()
  assert.deepEqual(requests, [homepage, advertised, 'https://api.ashbyhq.com/posting-api/job-board/choco'])
  assert.equal(jobs.length, 0)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.pagesFetched, 3)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), true)
})
test('the reviewed regional subpage takes priority over an earlier generic navigation link', async () => {
  const { requests, evidence } = await execute({ parent: `<a href="${advertised}">Open roles</a><a href="${canonical}">Regional open roles</a>` })
  assert.equal(requests[1], canonical)
  assert.equal(evidence.listingComplete, true)
})

test('a current employer subpage retains explicitly scoped India roles and their native descriptions', async () => {
  const { jobs, evidence } = await execute({ records: [role('Bengaluru, India', 'India')] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'choco')
  assert.match(jobs[0].jobDescription, /maintain customer integrations/)
  assert.equal(evidence.indiaFacetCount, 1)
  assert.equal(evidence.listingComplete, true)
})

test('an absent, hidden, or changed employer subpage link cannot use the cached ATS binding', async () => {
  for (const parent of ['<h1>Careers</h1>', `<template><a href="${advertised}">Open roles</a></template>`,
    `<a hidden href="${advertised}">Open roles</a>`, `<a href="${advertised}?department=other">Open roles</a>`]) {
    await assert.rejects(execute({ parent }), /advertised employer handoff/i)
  }
})

test('blocked subpages and redirects outside the pinned employer pages cannot establish inventory scope', async () => {
  await assert.rejects(execute({ childStatus: 403 }), /employer response unavailable/i)
  await assert.rejects(execute({ finalUrl: 'https://choco.com/unrelated' }), /employer handoff redirect/i)
  await assert.rejects(execute({ finalUrl: 'https://foreign.invalid/us/careers/open-roles' }), /employer handoff redirect/i)
})

test('additional recruiting inventories on either employer page preserve unknown source scope', async () => {
  const extra = '<a href="https://jobs.ashbyhq.com/another-employer">Other open roles</a>'
  for (const options of [{ parent: `<a href="${advertised}">View open roles</a>${extra}` }, { child: embed + extra }]) {
    const { evidence } = await execute(options)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
    assert.match(evidence.reason, /additional-employer/)
  }
})

test('employer subpage binding cannot resolve unspecified native hiring geography', async () => {
  const { jobs, evidence } = await execute({ records: [role('Worldwide', '')] })
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('configured handoff pages require exact same-employer HTTPS URLs before any transport', async () => {
  for (const pages of [[], ['https://foreign.invalid/careers'], ['https://user:pass@choco.com/careers'],
    ['http://choco.com/careers'], [`${canonical}#roles`]]) {
    const currentProvider = { ...provider, runtimeInventoryVerification: {
      mode: 'board-embed', boardUrl: 'https://jobs.ashbyhq.com/choco', employerHandoffPages: pages,
    } }
    await assert.rejects(createCatalogScraper(currentProvider).run({
      fetchPage: async () => assert.fail('invalid configuration must not send requests'),
      fetchJson: async () => assert.fail('invalid configuration must not send requests'),
    }), /configured employer handoff/i)
  }
})
