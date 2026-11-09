import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const manifest = JSON.parse(fs.readFileSync(new URL('../providers/providerExtensions/zz-006-publishing-gap-repairs.json', import.meta.url)))
const catalog = getScraperCatalog()

test('historical repair release retains 50 distinct official bindings while current catalog migrations stay explicit', () => {
  assert.equal(manifest.length, 50)
  assert.equal(new Set(manifest.map((p) => p.source)).size, 50)
  for (const metadata of manifest) {
    assert.equal(metadata.bindingEvidence.verified, true, metadata.source)
    assert.ok(metadata.bindingEvidence.checkedAt, metadata.source)
    const links = metadata.bindingEvidence.matchedLinks || []
    if (links.length) {
      const platform = { greenhouse: /greenhouse\.io/i, ashby: /ashbyhq\.com|\/api\/ashby\//i, lever: /lever\.co|leverJobsOptions/i }[metadata.atsPlatform]
      assert.ok(links.some((link) => platform.test(link)), `${metadata.source}: binding must prove the configured ATS platform`)
    }
    const provider = catalog.find((p) => p.source === metadata.source)
    if (metadata.source === 'blueconic') {
      assert.equal(metadata.atsPlatform, 'greenhouse', 'The archived release must retain its historical ATS binding')
      assert.equal(metadata.boardToken, 'blueconic')
      assert.equal(provider.atsPlatform, 'bamboohr', 'Current declared BambooHR supersedes the historical Greenhouse binding')
      assert.equal(provider.backfillMode, 'discovery-only')
      assert.equal(provider.zeroResultPolicy, 'coverage-gap')
      for (const key of ['verifiedOn', 'verifiedAt', 'verifiedPublicJobCount', 'verifiedIndiaJobCount', 'bindingEvidence']) {
        assert.equal(provider[key], null, `BlueConic historical ${key} cannot qualify current inventory`)
      }
      for (const key of ['listingComplete', 'sourceListingComplete', 'sourceScopeComplete', 'lifecycleCleanupAllowed']) {
        assert.equal(provider[key], false, `BlueConic ${key} remains unqualified`)
      }
      continue
    }
    assert.equal(provider.atsPlatform, metadata.atsPlatform)
    assert.equal(provider.backfillMode, 'live-parser')
    if (provider.parser === 'identity-bound-native-ashby-role-observations') {
      assert.equal(provider.zeroResultPolicy, 'coverage-gap')
      assert.equal(provider.sourceScopeComplete, false)
    } else assert.equal(provider.zeroResultPolicy, 'evidence-required')
  }
})

for (const metadata of manifest) {
  test(`${metadata.source} maps its ATS fixture and fails safely on upstream errors`, async t => {
    t.mock.method(globalThis, 'fetch', async () => assert.fail('Repair fixtures must not make live HTTP requests'))
    const provider = catalog.find((p) => p.source === metadata.source)
    const module = await import(pathToFileURL(provider.modulePath).href)
    if (metadata.source === 'blueconic') {
      assert.equal(metadata.atsPlatform, 'greenhouse')
      assert.equal(provider.atsPlatform, 'bamboohr')
      assert.equal(module.PROVIDER_METADATA.atsPlatform, 'bamboohr')
      const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/blueconicBamboo20261106/capture.json.gz', import.meta.url))))
      assert.match(fixture.closingReplay, /No independent live closing/)
      const packets = new Map(fixture.responses.map(page => [page.url, page]))
      assert.equal(packets.size, fixture.responses.length, 'Every retained original entity has one unambiguous URL')
      for (const page of fixture.responses) {
        const bytes = Buffer.from(page.bodyBase64, 'base64')
        assert.equal(bytes.length, page.receipt.bytes, page.url)
        assert.equal(createHash('sha256').update(bytes).digest('hex'), page.receipt.sha256, page.url)
      }
      const corporate = provider.companyCareerPage
      const client = 'https://blueconic.bamboohr.com/js/embed.js'
      const feed = 'https://blueconic.bamboohr.com/jobs/embed2.php?version=1.0.0&format=json'
      const nativeFeed = JSON.parse(Buffer.from(packets.get(feed).bodyBase64, 'base64'))
      const roles = nativeFeed.departments.flatMap(department => department.positions)
      const requests = []
      const jobs = await module.run({ fetchPage: async url => {
        requests.push(url)
        const page = packets.get(url)
        assert.ok(page, `Only retained original BlueConic BambooHR entities may be replayed: ${url}`)
        return { url: page.url, status: page.status, headers: page.headers, bodyBase64: page.bodyBase64 }
      } })
      // The synthetic closing envelope reuses original captured bytes; it does
      // not establish a fresh live closing or current whole-employer inventory.
      assert.deepEqual(requests, [corporate, client, feed, ...roles.flatMap(role => [role.url, `${role.url}/detail`]), feed, corporate, client])
      assert.equal(jobs.length, 3)
      assert.deepEqual(new Set(jobs.map(job => job.jobId)), new Set(roles.map(role => String(role.id))))
      assert.ok(jobs.every(job => job.source === metadata.source && job.company === metadata.companyName && job.atsPlatform === 'bamboohr'))
      assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && job.jobDescription.length > 0
        && job.sourceNativeRecord.description === job.sourceNativeDescriptionHTML))
      assert.ok(jobs.every(job => job.sourceListingComplete === false && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
      const evidence = readInventoryEvidence(jobs)
      assert.equal(evidence.status, 'discovery-only')
      assert.equal(evidence.listingComplete, false)
      assert.equal(evidence.reportedTotal, null)
      assert.equal(evidence.indiaFacetCount, null)
      assert.equal(jobs.sourceAudit.observations.length, roles.length)
      assert.equal(jobs.sourceAudit.closingInventoryMatches, true)
      assert.equal(jobs.sourceAudit.companyGlobalTotal, null)
      assert.equal(jobs.sourceAudit.companyIndiaTotal, null)
      assert.ok(requests.every(url => !url.includes('greenhouse')))
      let parsedReads = 0
      await assert.rejects(module.run({ fetchJson: async () => { parsedReads++; return { jobs: [] } } }), /original response provenance/)
      assert.equal(parsedReads, 0, 'Parsed-only historical fixtures cannot bypass current response provenance')
      const failedRequests = []
      await assert.rejects(module.run({ fetchPage: async url => {
        failedRequests.push(url)
        const page = packets.get(url)
        assert.ok(page, url)
        return { url: page.url, status: 503, headers: page.headers, bodyBase64: page.bodyBase64 }
      } }), error => error.httpStatus === 503 && error.failureKind === 'network_or_timeout' && error.requestedUrl === corporate)
      assert.deepEqual(failedRequests, [corporate], 'An upstream status failure must stop before later native requests')
      return
    }
    if (provider.parser === 'identity-bound-native-ashby-role-observations') {
      const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../native-sources/declaredAshby/fixtures/actual-http-20261031.json.gz', import.meta.url))))
      const pages = new Map()
      for (const page of fixture.responses.filter(row => row.source === metadata.source)) {
        if (!pages.has(page.url)) pages.set(page.url, [])
        pages.get(page.url).push(page)
      }
      const jobs = await module.run({ now: () => '2026-10-31T05:30:00.000Z', fetchPage: async url => {
        const page = pages.get(url)?.shift()
        assert.ok(page, `Missing retained native response: ${url}`)
        return { url: page.finalURL, status: page.status, headers: page.responseHeaders, bodyBase64: page.bodyBase64 }
      } })
      assert.equal(jobs.sourceAudit.observations.length, 24)
      assert.ok(jobs.sourceAudit.observations.every(row => row.source === metadata.source && row.company === metadata.companyName))
      assert.equal(readInventoryEvidence(jobs).listingComplete, false)
      assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
      const unavailable = await module.run({ fetchPage: async () => { throw new Error('HTTP 503') } })
      assert.equal(unavailable.length, 0)
      assert.equal(readInventoryEvidence(unavailable).status, 'discovery-only')
      assert.equal(readInventoryEvidence(unavailable).firstParty, false)
      assert.equal(readInventoryEvidence(unavailable).listingComplete, false)
      assert.ok(unavailable.sourceAudit.issues.some(issue => issue.kind === 'native-response-failed'))
      return
    }
    const url = `https://example.com/jobs/${metadata.source}`
    const record = metadata.atsPlatform === 'greenhouse'
      ? { id: 1, title: 'Software Engineer', location: { name: 'Bangalore, India' }, absolute_url: url, content: 'Build and maintain applications.' }
      : metadata.atsPlatform === 'ashby'
        ? { id: '1', title: 'Software Engineer', location: 'Bangalore, India',
          jobUrl: `https://jobs.ashbyhq.com/${encodeURIComponent(metadata.boardToken)}/1`,
          applyUrl: `https://jobs.ashbyhq.com/${encodeURIComponent(metadata.boardToken)}/1/application`,
          isListed: true, descriptionPlain: 'Build and maintain applications.' }
        : { id: '1', text: 'Software Engineer', categories: { location: 'Bangalore, India' },
          hostedUrl: `https://jobs.lever.co/${encodeURIComponent(metadata.boardToken)}/1`,
          applyUrl: `https://jobs.lever.co/${encodeURIComponent(metadata.boardToken)}/1/apply`,
          descriptionPlain: 'Build and maintain applications.' }
    const payload = metadata.atsPlatform === 'lever' ? [record]
      : metadata.atsPlatform === 'greenhouse' ? { jobs: [record], meta: { total: 1 } } : { jobs: [record], apiVersion: '1' }
    const jobs = await module.run({ fetchJson: async () => payload })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].source, metadata.source)
    assert.equal(jobs[0].company, metadata.companyName)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
    assert.notEqual(jobs[0].sourceListingComplete, false)
    if (metadata.atsPlatform === 'lever') {
      await assert.rejects(module.run({ fetchJson: async () => [{ ...record, hostedUrl: url, applyUrl: `${url}/apply` }] }), /board|identity/i)
    }
    await assert.rejects(module.run({ fetchJson: async () => { throw new Error('HTTP 503') } }), /503/)
  })
}
