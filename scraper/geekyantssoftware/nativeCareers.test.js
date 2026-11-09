import assert from 'node:assert/strict'
import test from 'node:test'
import { createGeekyantsSoftwareScraper, OFFICIAL_CAREERS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const role = (id = 'backend-a101', title = 'Backend Engineer') => ({
  '@type': 'JobPosting', title,
  url: `https://topgeek.io/company/geekyants-india-pvt-ltd/openings/${id}`,
  description: '<p>Build production services, test integrations, and maintain reliable customer systems.</p>',
  hiringOrganization: { '@type': 'Organization', name: 'GeekyAnts', '@id': 'https://geekyants.com/#organization' },
  jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'IN', addressLocality: 'Bengaluru', addressRegion: 'Karnataka' } },
  datePosted: '2026-10-15', employmentType: 'FULL_TIME', experienceRequirements: { monthsOfExperience: '24' },
})
const rows = () => [role(), role('ios-b202', 'iOS Engineer')]
const card = row => `<a class="group/opening" href="${row.url}"><div><p class="font-heading">${row.title}</p>`
  + '<p class="line-clamp-3">Build production services, test integrations, and maintain reliable customer systems.</p>'
  + '<p><svg class="lucide-map-pin" aria-hidden="true"></svg>Bengaluru</p></div></a>'
const page = ({ records = rows(), cards = records.map(card).join(''), count = records.length,
  schemaRecords = records, schemaWrapper = value => value } = {}) => '<title>Careers | Join Us in India - GeekyAnts</title><h1>Join GeekyAnts</h1>'
  + schemaWrapper(`<script type="application/ld+json">${JSON.stringify([{ '@type': 'ItemList',
    '@id': 'https://geekyants.com/join-geekyants#openings', numberOfItems: count,
    itemListElement: records.map((row, index) => ({ '@type': 'ListItem', position: index + 1, url: row.url, name: row.title })),
  }, ...schemaRecords])}</script>`) + cards
const execute = async ({ opening = page(), closing = opening, maxJobs = null } = {}) => {
  const requests = []
  const jobs = await createGeekyantsSoftwareScraper({ maxJobs }).run({
    now: () => '2026-10-29T16:00:00.000Z',
    fetchText: async url => {
      requests.push(url)
      assert.equal(url, OFFICIAL_CAREERS_URL, 'The complete first-party role data should not require delegated detail requests')
      return requests.length === 1 ? opening : closing
    },
  })
  return { jobs, requests, evidence: readInventoryEvidence(jobs) }
}

test('redesigned GeekyAnts cards retain full first-party descriptions and reconcile their explicit opening count', async () => {
  const { jobs, requests, evidence } = await execute()
  assert.equal(jobs.length, 2)
  assert.deepEqual(requests, [OFFICIAL_CAREERS_URL, OFFICIAL_CAREERS_URL])
  assert.equal(jobs[0].title, 'Backend Engineer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, '2026-10-15')
  assert.equal(jobs[0].experienceRequired, '24 months')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.match(jobs[0].jobDescription, /maintain reliable customer systems/)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.indiaFacetCount, 2)
})

test('a single currently counted native opening remains a valid first-party inventory', async () => {
  const { jobs, evidence } = await execute({ opening: page({ records: [role()] }) })
  assert.equal(jobs.length, 1)
  assert.equal(evidence.listingComplete, true)
})

test('a changed closing inventory or output cap retains usable roles with partial evidence', async () => {
  for (const options of [{ closing: page({ records: [role()] }) }, { maxJobs: 1 }]) {
    const { jobs, evidence } = await execute(options)
    assert.ok(jobs.length > 0)
    assert.equal(evidence.listingComplete, false)
    assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  }
})

test('display-order changes do not change a fully reconciled native role inventory', async () => {
  const { evidence } = await execute({ closing: page({ records: rows().reverse() }) })
  assert.equal(evidence.listingComplete, true)
})

test('a wrong employer, changed title, or foreign country cannot be relabelled as an India opening', async () => {
  for (const change of [
    row => ({ ...row, hiringOrganization: { ...row.hiringOrganization, name: 'Another Company' } }),
    row => ({ ...row, title: 'Unrelated Job' }),
    row => ({ ...row, jobLocation: { ...row.jobLocation, address: { ...row.jobLocation.address, addressCountry: 'US' } } }),
  ]) {
    const records = rows(), schemaRecords = [change(records[0]), records[1]]
    const { jobs, evidence } = await execute({ opening: page({ records, schemaRecords }) })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].title, 'iOS Engineer')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('inert structured data and unmatched declared counts cannot certify the modern source', async () => {
  const hidden = await execute({ opening: page({ schemaWrapper: value => `<template>${value}</template>` }) })
  assert.equal(hidden.jobs.length, 0)
  assert.equal(hidden.evidence.listingComplete, false)
  const countMismatch = await execute({ opening: page({ count: 3 }) })
  assert.equal(countMismatch.jobs.length, 2)
  assert.equal(countMismatch.evidence.listingComplete, false)
})

test('unreconciled visible criteria prevent an incomplete native description being called full', async () => {
  const records = rows(), cards = card(records[0]).replace('</a>', '<p>Mandatory security certification is also required.</p></a>') + card(records[1])
  const { jobs, evidence } = await execute({ opening: page({ records, cards }) })
  assert.equal(jobs.length, 1)
  assert.equal(evidence.listingComplete, false)
})

test('caller cancellation at the first-party response boundary propagates', async () => {
  const controller = new AbortController(), reason = new Error('stop GeekyAnts source')
  await assert.rejects(createGeekyantsSoftwareScraper().run({ signal: controller.signal,
    fetchText: async () => { controller.abort(reason); return page() },
  }), error => error === reason)
})

test('unsuccessful or redirected source responses cannot certify the native inventory', async () => {
  for (const response of [
    { status: 403, url: OFFICIAL_CAREERS_URL, html: page() },
    { status: 200, url: 'https://example.com/en-in/join-geekyants', html: page() },
    { status: 200, url: 'https://geekyants.com/en-in/another-page', html: page() },
    { status: 200, html: page() },
  ]) {
    await assert.rejects(createGeekyantsSoftwareScraper().run({ fetchPage: async () => response }),
      /verified source URL and HTTP status/)
  }
})

test('failed closing responses retain positive roles without allowing inventory cleanup', async () => {
  let requests = 0
  const jobs = await createGeekyantsSoftwareScraper().run({ fetchPage: async url => {
    requests += 1
    if (requests > 1) throw new Error('closing HTTP request failed')
    return { status: 200, url, html: page() }
  } })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /native-closing-inventory-unavailable/)
})

test('a zero output cap cannot certify that a currently nonempty company inventory is empty', async () => {
  const { jobs, evidence } = await execute({ maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.listingComplete, false)
})
