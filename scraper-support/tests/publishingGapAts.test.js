import test from 'node:test'
import assert from 'node:assert/strict'
import { createPublishingGapAtsScraper } from '../utils/publishingGapAts.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../providers/apiPortalTemplates.js'

const provider = { source: 'example', companyName: 'Example', companyCareerPage: 'https://example.com/careers', atsPlatform: 'greenhouse', boardToken: 'example' }
const job = { id: 1, title: 'Engineer', location: { name: 'Bangalore, India' }, absolute_url: 'https://job-boards.greenhouse.io/example/jobs/1', content: '&lt;p&gt;Build software&lt;/p&gt;' }
const run = (payload, overrides = {}) => createPublishingGapAtsScraper({ ...provider, ...overrides }).run({ fetchJson: async () => payload })

test('Greenhouse retains proven India jobs while generic remote scope prevents completeness', async () => {
  const jobs = await run({ jobs: [job,
    { ...job, id: 2, absolute_url: 'https://job-boards.greenhouse.io/example/jobs/2', location: { name: 'Remote' } },
    { ...job, id: 3, absolute_url: 'https://job-boards.greenhouse.io/example/jobs/3', location: { name: 'Boston, US' } }
  ], meta: { total: 3 } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Example')
  assert.equal(jobs[0].link, job.absolute_url)
  assert.match(jobs[0].jobDescription, /Build software/)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.every(row => row.sourceListingComplete === false))
})

test('unknown or worldwide Greenhouse locations never establish zero India inventory', async () => {
  for (const name of ['Remote', 'Worldwide', 'Anywhere', 'London', 'Remote US / Worldwide', '']) {
    const jobs = await run({ jobs: [{ ...job, location: { name } }], meta: { total: 1 } })
    assert.equal(jobs.length, 0, name)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false, name)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null, name)
    assert.match(readInventoryEvidence(jobs).reason, /native-location-scope-unresolved/, name)
  }
})

test('Greenhouse includes an explicit native India office alongside a foreign primary location', async () => {
  const jobs = await run({ jobs: [{ ...job, location: { name: 'Boston, US' },
    offices: [{ name: 'Bengaluru, India', location: null }] }], meta: { total: 1 } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})

test('Greenhouse unresolved or contradictory office scope cannot authorize completeness', async () => {
  for (const office of [{ name: 'Remote', location: null },
    { name: 'Bengaluru, India', location: 'Boston, US' }, { name: 'Worldwide', location: 'Boston, US' }]) {
    const jobs = await run({ jobs: [{ ...job, location: { name: 'Boston, US' }, offices: [office] }], meta: { total: 1 } })
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  }
  const jobs = await run({ jobs: [{ ...job, location: { name: 'Remote US' }, offices: [{ name: 'Remote US', location: null }] }], meta: { total: 1 } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('an explicit foreign country cannot resolve a different unknown location segment', async () => {
  for (const name of ['Remote US or APAC', 'Boston, US / Kochi', 'Remote US (EMEA)', 'Boston, US; Remote', 'Boston, US + Kochi', 'Boston, US & Kochi']) {
    const jobs = await run({ jobs: [{ ...job, location: { name } }], meta: { total: 1 } })
    assert.equal(readInventoryEvidence(jobs).listingComplete, false, name)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null, name)
  }
})

test('contradictory primary country labels cannot create an India vacancy', async () => {
  await assert.rejects(run({ jobs: [{ ...job, location: { name: 'India / United States' } }], meta: { total: 1 } }), /contradictory country\/location/)
})

test('Greenhouse semicolon office inventories select proven India locations independently', async () => {
  for (const [name, expected] of [
    ['Berlin, Germany; Bulgaria; India, Bengaluru; India, Delhi NCR; India, Hyderabad; Lithuania; Serbia; United Kingdom', 'India, Bengaluru'],
    ['Bangalore, India; Remote, Australia; Remote, Canada; Remote, Israel; Remote, United States', 'Bangalore, India'],
    ['Remote Ireland; Remote, Australia; Remote, Canada; Remote, India; Remote, Mexico; Remote, Poland; Remote, United Kingdom; Remote, United States', 'Remote, India'],
  ]) {
    const jobs = await run({ jobs: [{ ...job, location: { name } }], meta: { total: 1 } })
    assert.equal(jobs.length, 1, name)
    assert.equal(jobs[0].location, expected)
    assert.equal(jobs[0].country, 'India')
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  }
})

test('Greenhouse semicolon parsing retains unresolved and contradictory segment validation', async () => {
  const jobs = await run({ jobs: [{ ...job, location: { name: 'Bangalore, India; Worldwide' } }], meta: { total: 1 } })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  await assert.rejects(run({ jobs: [{ ...job, location: { name: 'Bangalore, India, United States; Berlin, Germany' } }], meta: { total: 1 } }), /contradictory country\/location/)
})

test('Greenhouse primary India segment stays more precise than country-only office metadata', async () => {
  const jobs = await run({ jobs: [{ ...job, location: { name: 'Bangalore, India; Remote, Poland' }, offices: [{ name: 'India', location: null }] }], meta: { total: 1 } })
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[0].city, 'Bangalore')
})

test('Greenhouse native country-first location derives its city without publishing India as a city', async () => {
  const jobs = await run({ jobs: [{ ...job, location: { name: 'Berlin, Germany; India, Bengaluru; India, Hyderabad' } }], meta: { total: 1 } })
  assert.equal(jobs[0].location, 'India, Bengaluru')
  assert.equal(jobs[0].city, 'Bangalore')
})

test('Lever country and allLocations map proven India roles while preserving unresolved scope', async () => {
  const record = { id: 'x', text: 'Engineer', categories: { location: 'Remote' }, hostedUrl: 'https://jobs.lever.co/example/x', applyUrl: 'https://jobs.lever.co/example/x/apply', descriptionPlain: 'Build software' }
  for (const row of [record, { ...record, country: 'US', categories: { location: 'Boston, US', allLocations: ['Boston, US', 'Worldwide'] } }]) {
    const jobs = await run([row], { atsPlatform: 'lever' })
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  }
  for (const row of [{ ...record, country: 'IN' },
    { ...record, country: 'US', categories: { location: 'Boston, US', allLocations: ['Boston, US', 'Bengaluru, India'] } }]) {
    const jobs = await run([row], { atsPlatform: 'lever' })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].country, 'India')
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  }
  const jobs = await run([{ ...record, country: 'US' }], { atsPlatform: 'lever' })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  await assert.rejects(run([{ ...record, country: 'US', categories: { location: 'Bengaluru, India' } }], { atsPlatform: 'lever' }), /contradictory country\/location/)
})

test('malformed, truncated, or failed inventory never becomes authoritative empty', async () => {
  await assert.rejects(run({ error: 'unavailable' }), /inventory/i)
  await assert.rejects(run({ jobs: [job], meta: { total: 2 } }), /incomplete/i)
  await assert.rejects(run({ jobs: [], hasMore: true }), /incomplete/i)
  await assert.rejects(run({ jobs: [{ ...job, absolute_url: null }] }), /application URL/i)
  await assert.rejects(createPublishingGapAtsScraper(provider).run({ fetchJson: async () => { throw new Error('HTTP 503') } }), /503/)
})

test('live empty and complete zero India inventory carry distinct evidence', async () => {
  assert.equal(readInventoryEvidence(await run({ jobs: [], meta: { total: 0 } })).status, 'verified-empty')
  const jobs = await run({ jobs: [{ ...job, location: { name: 'Boston, US' } }], meta: { total: 1 } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('Ashby includes India secondary locations and preserves missing descriptions for downstream validation', async () => {
  const jobs = await run({ jobs: [{ id: 'a', title: 'Engineer', location: 'London', secondaryLocations: [{ location: 'Bengaluru, India' }], jobUrl: 'https://jobs.ashbyhq.com/example/a', applyUrl: 'https://jobs.ashbyhq.com/example/a/application', isListed: true }] }, { atsPlatform: 'ashby' })
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].location, /Bengaluru/)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Lever includes all description sections, filters talent pools, and does not invent posting dates', async () => {
  const record = { id: 'x', text: 'Engineer', categories: { location: 'Hyderabad India' }, hostedUrl: 'https://jobs.lever.co/example/x', applyUrl: 'https://jobs.lever.co/example/x/apply', descriptionPlain: 'Overview', lists: [{ text: 'Requirements', content: '<li>JavaScript</li>' }], additionalPlain: 'Benefits' }
  const jobs = await run([record, { ...record, id: 'y', text: 'Talent Community' }], { atsPlatform: 'lever' })
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].jobDescription, /Overview[\s\S]*JavaScript[\s\S]*Benefits/)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.notEqual(jobs[0].sourceListingComplete, false)
})

test('native Greenhouse template reconciles meta.total without a fictitious continuation field', async () => {
  const config = expandApiPortalProviderTemplate({ ...provider, template: 'greenhouse', templateOptions: { boardToken: 'example' } })
  const jobs = await runApiPortalScraper({ provider: config, fetchJson: async () => ({ jobs: [job], meta: { total: 1 } }) })
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(jobs[0].sourceListingComplete, undefined)
  const truncated = await runApiPortalScraper({ provider: config, fetchJson: async () => ({ jobs: [job], meta: { total: 2 } }) })
  assert.equal(readInventoryEvidence(truncated).listingComplete, false)
  assert.equal(truncated[0].sourceListingComplete, false)
})

test('missing native Greenhouse total remains unknown through the wrapper, including empty arrays', async () => {
  for (const rows of [[job], []]) {
    const jobs = await run({ jobs: rows })
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.status, 'discovery-only')
    assert.equal(evidence.reportedTotal, null)
    assert.match(evidence.reason, /configured-total-unavailable/)
    assert.ok(jobs.every(row => row.sourceListingComplete === false))
  }
})

test('the ATS wrapper rejects duplicate Greenhouse identities before mapping source content', async () => {
  await assert.rejects(run({ jobs: [job, { ...job, title: 'Duplicate ID' }], meta: { total: 2 } }), /duplicate native identity/)
})

test('the ATS wrapper preserves inner incomplete evidence and lifecycle guards', async () => {
  const jobs = await run({ jobs: [job], meta: { total: 1 } },
    { config: { pagination: { hasMorePath: 'configuredContinuation' } } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.match(readInventoryEvidence(jobs).reason, /configured-continuation-unavailable/)
  assert.ok(jobs.every(row => row.sourceListingComplete === false))
})

test('selected roles without employer descriptions cannot authorize complete inventory', async () => {
  for (const [payload, overrides] of [
    [{ jobs: [{ ...job, content: '' }], meta: { total: 1 } }, {}],
    [[{ id: 'x', text: 'Engineer', categories: { location: 'Hyderabad India' },
      hostedUrl: 'https://jobs.lever.co/example/x', applyUrl: 'https://jobs.lever.co/example/x/apply' }], { atsPlatform: 'lever' }],
  ]) {
    const jobs = await run(payload, overrides)
    assert.equal(jobs.length, 1)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(jobs[0].sourceListingComplete, false)
  }
})

test('Ashby country metadata cannot resolve an alternate worldwide scope', async () => {
  const jobs = await run({ apiVersion: '1', jobs: [{ id: 'a', title: 'Engineer', location: 'Remote US or APAC', address: { postalAddress: { addressCountry: 'US' } }, isListed: true,
    jobUrl: 'https://jobs.ashbyhq.com/example/a', applyUrl: 'https://jobs.ashbyhq.com/example/a/application', descriptionHtml: '<p>Build software.</p>' }] }, { atsPlatform: 'ashby' })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('one native Ashby postal country scopes multiple city alternatives in the same location field', async () => {
  const record = { id: 'a', title: 'Research Engineer', location: 'Redwood City or New York City',
    address: { postalAddress: { addressCountry: 'United States' } }, secondaryLocations: [], isListed: true,
    jobUrl: 'https://jobs.ashbyhq.com/example/a', applyUrl: 'https://jobs.ashbyhq.com/example/a/application',
    descriptionPlain: 'Build and evaluate production research systems.' }
  const jobs = await run({ apiVersion: '1', jobs: [record] }, { atsPlatform: 'ashby' })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('a postal country does not extend to separate native secondary-location entries', async () => {
  const record = { id: 'a', title: 'Nursing Executive', location: 'Remote - Tier 1',
    address: { postalAddress: { addressCountry: 'USA' } },
    secondaryLocations: [{ location: 'Remote - Tier 2', address: { postalAddress: {} } }], isListed: true,
    jobUrl: 'https://jobs.ashbyhq.com/example/a', applyUrl: 'https://jobs.ashbyhq.com/example/a/application',
    descriptionPlain: 'Lead and support clinical nursing teams.' }
  const jobs = await run({ apiVersion: '1', jobs: [record] }, { atsPlatform: 'ashby' })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('cancellation at the native response boundary cannot return authoritative empty', async () => {
  const controller = new AbortController()
  await assert.rejects(createPublishingGapAtsScraper(provider).run({ signal: controller.signal, fetchJson: async () => {
    controller.abort(new Error('inventory cancelled'))
    return { jobs: [], meta: { total: 0 } }
  } }), /inventory cancelled/)
})
