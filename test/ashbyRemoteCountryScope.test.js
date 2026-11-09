import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const provider = getScraperCatalog().find(row => row.source === 'abridge')
const nativeRole = (id = 'nursing-role') => ({ id, title: 'Senior Nursing Executive', isListed: true,
  location: 'Remote - Tier 1', workplaceType: 'Remote',
  address: { postalAddress: { addressCountry: 'USA' } },
  secondaryLocations: [{ location: 'Remote - Tier 3', address: { postalAddress: {} } },
    { location: 'Remote - Tier 2', address: { postalAddress: {} } }],
  descriptionHtml: '<p>Lead nursing teams and support clinical product delivery.</p>',
  jobUrl: `https://jobs.ashbyhq.com/Abridge/${id}`, applyUrl: `https://jobs.ashbyhq.com/Abridge/${id}/application`,
})
const nativePage = (row, { posting = {}, schema = {}, wrapSchema = value => value } = {}) => {
  const app = { organization: { hostedJobsPageSlug: 'Abridge', name: 'Abridge' }, posting: {
    id: row.id, title: row.title, isListed: true, isConfidential: false, workplaceType: 'Remote',
    locationName: row.location, secondaryLocationNames: row.secondaryLocations.map(location => location.location),
    descriptionHtml: row.descriptionHtml, ...posting,
  } }
  const job = { '@type': 'JobPosting', identifier: { '@type': 'PropertyValue', value: row.id },
    title: row.title, description: row.descriptionHtml, jobLocationType: 'TELECOMMUTE',
    jobLocation: { '@type': 'Place', address: { addressCountry: 'USA' } },
    applicantLocationRequirements: { '@type': 'Country', name: 'USA' }, ...schema,
  }
  return `<script>window.__appData = ${JSON.stringify(app)};</script>`
    + wrapSchema(`<script type="application/ld+json">${JSON.stringify(job)}</script>`)
}
const execute = async ({ records = [nativeRole()], detailOptions = {}, detailResponse = {}, fetchPage, signal } = {}) => {
  const requests = [], payload = { apiVersion: '1', jobs: records }
  const original = structuredClone(payload)
  const jobs = await createCatalogScraper(provider).run({ signal,
    fetchPage: fetchPage || (async url => {
      requests.push(url)
      if (url === provider.companyCareerPage) return { status: 200, url,
        html: '<a href="https://jobs.ashbyhq.com/Abridge">View all open roles</a>' }
      const row = records.find(record => record.jobUrl === url)
      assert.ok(row, `Unexpected role URL: ${url}`)
      return { status: 200, url, html: nativePage(row, detailOptions), ...detailResponse }
    }),
    fetchJson: async () => payload,
  })
  assert.deepEqual(payload, original, 'The original native feed must remain intact')
  return { jobs, evidence: readInventoryEvidence(jobs), requests }
}

test('Abridge reconciles missing remote tier countries with the matching native US applicant requirement', async () => {
  assert.equal(provider.runtimeInventoryVerification?.nativeRemoteCountryScope, 'US')
  const { jobs, evidence, requests } = await execute()
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.pagesFetched, 3)
  assert.match(evidence.reason, /native-remote-applicant-country-verified:nursing-role=US@[a-f0-9]{64}/)
  assert.deepEqual(requests, [provider.companyCareerPage, nativeRole().jobUrl])
})

test('missing, hidden, or foreign applicant requirements leave the original remote scope unresolved', async () => {
  for (const detailOptions of [
    { schema: { applicantLocationRequirements: undefined } },
    { schema: { applicantLocationRequirements: { '@type': 'Country', name: 'India' } } },
    { schema: { applicantLocationRequirements: [{ '@type': 'Country', name: 'USA' }, { '@type': 'Country', name: 'India' }] } },
    { wrapSchema: value => `<template>${value}</template>` },
  ]) {
    const { evidence } = await execute({ detailOptions })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('a native applicant requirement must reconcile role identity, descriptions, and all tier labels', async () => {
  for (const detailOptions of [
    { posting: { id: 'another-role' } }, { posting: { isListed: false } },
    { posting: { descriptionHtml: '<p>Different role content.</p>' } },
    { posting: { secondaryLocationNames: ['Remote - Tier 3'] } },
    { posting: { locationAddress: { addressCountry: 'Canada' } } },
    { schema: { identifier: { value: 'another-role' } } },
    { schema: { jobLocationType: 'ONSITE' } },
    { schema: { jobLocation: { '@type': 'Place', address: { addressCountry: 'India' } } } },
  ]) {
    const { evidence } = await execute({ detailOptions })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('blocked or redirected native role pages do not resolve an omitted country', async () => {
  for (const detailResponse of [{ status: 403 }, { url: 'https://jobs.ashbyhq.com/another-employer/nursing-role' }]) {
    const { evidence } = await execute({ detailResponse })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('a published foreign or India secondary country is preserved instead of inheriting the primary US country', async () => {
  const row = nativeRole()
  row.secondaryLocations[0].address.postalAddress.addressCountry = 'Canada'
  const { evidence, requests } = await execute({ records: [row] })
  assert.equal(requests.length, 1, 'No role-wide US audit may replace a published different country')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})
test('secondary geographic address fields remain unresolved when the native country is omitted', async () => {
  const row = nativeRole()
  row.secondaryLocations[0].address.postalAddress.addressLocality = 'Toronto'
  const { evidence, requests } = await execute({ records: [row] })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.deepEqual(requests, [provider.companyCareerPage])
})

test('malformed native inventories fail before any country-recovery role request', async () => {
  const urls = []
  await assert.rejects(createCatalogScraper(provider).run({
    fetchPage: async url => { urls.push(url); return { status: 200, url,
      html: '<a href="https://jobs.ashbyhq.com/Abridge">All roles</a>' } },
    fetchJson: async () => ({ apiVersion: '1', jobs: [nativeRole(), nativeRole()] }),
  }), /repeated native identity/)
  assert.deepEqual(urls, [provider.companyCareerPage])
})

test('cancellation at the native country detail boundary propagates without a complete result', async () => {
  const controller = new AbortController(), reason = new Error('stop native country audit')
  await assert.rejects(execute({ signal: controller.signal, fetchPage: async url => {
    if (url === provider.companyCareerPage) return { status: 200, url,
      html: '<a href="https://jobs.ashbyhq.com/Abridge">All roles</a>' }
    controller.abort(reason)
    return { status: 200, url, html: nativePage(nativeRole()) }
  } }), error => error === reason)
})

const unavailablePage = (overrides = {}) => '<title>Jobs</title>'
  + `<link id="vite-preload" rel="preload" as="fetch" href="https://cdn.ashbyprd.com/frontend_non_user/${'a'.repeat(40)}/.vite/manifest.json">`
  + `<script>window.__appData = ${JSON.stringify({ environment: 'production', maintenanceMode: false,
    schedulingMaintenanceMode: false, organization: null, posting: null, jobBoard: null, ...overrides })};</script>`
const missingRole = '480c4c99-2ca8-4dc7-ba6b-29a9ee28ed95'
const runAdvertisedMissing = async ({ html = unavailablePage(), status = 404, finalUrl,
  ids = [missingRole], signal } = {}) => {
  const row = nativeRole(), requests = []
  for (const location of row.secondaryLocations) location.address.postalAddress.addressCountry = 'USA'
  const jobs = await createCatalogScraper(provider).run({ signal,
    fetchPage: async url => {
      requests.push(url)
      if (url === provider.companyCareerPage) return { status: 200, url,
        html: '<a href="https://jobs.ashbyhq.com/Abridge">All roles</a>'
          + ids.map(id => `<a href="https://jobs.ashbyhq.com/Abridge/${id}">Advertised role</a>`).join('') }
      return { status, url: finalUrl || url, html }
    },
    fetchJson: async () => ({ apiVersion: '1', jobs: [row] }),
  })
  return { evidence: readInventoryEvidence(jobs), requests }
}

test('a stale advertised role is reconciled only by the exact native 404 unavailable state', async () => {
  const { evidence, requests } = await runAdvertisedMissing()
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.pagesFetched, 3)
  assert.match(evidence.reason, new RegExp(`native-advertised-unavailable-verified:${missingRole}@[a-f0-9]{64}`))
  assert.deepEqual(requests, [provider.companyCareerPage, `https://jobs.ashbyhq.com/Abridge/${missingRole}`])
})

test('blank, challenged, or unrecognized 404 pages cannot remove an advertised role from scope', async () => {
  for (const html of ['', '<h1>Not found</h1>', unavailablePage({ maintenanceMode: true }),
    unavailablePage({ posting: { id: missingRole, isListed: true } }),
    unavailablePage() + '<p>Verify you are human</p>']) {
    const { evidence } = await runAdvertisedMissing({ html })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
    assert.match(evidence.reason, /official-role-identities-not-reconciled/)
  }
})

test('an active page or foreign redirect cannot count as an unavailable native role', async () => {
  for (const options of [{ status: 200 }, { finalUrl: 'https://jobs.ashbyhq.com/another-company/role' }]) {
    const { evidence } = await runAdvertisedMissing(options)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('native unavailable-role audits stay bounded and retain any unchecked advertised identities', async () => {
  const { requests, evidence } = await runAdvertisedMissing({ ids: Array.from({ length: 9 }, (_, i) => `missing-${i}`) })
  assert.equal(requests.length, 9)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /official-role-identities-not-reconciled/)
})
