import assert from 'node:assert/strict'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readNativeDocument } from '../utils/activeNativeHtml.js'
import { fixture, replay, mutateJSON } from '../native-sources/declaredJobFeeds/fixtureReplay.js'

// The old synthetic DTOs remain API-model tests. They cannot stand in for the
// registered reader's original HTTP/corporate/own-role/closing boundaries.
export const assertLegacyParsedOnlyRejected = async (source, options, defaults = {}) => {
  const provider = getScraperCatalog().find(row => row.source === source)
  let invoked = 0
  const legacy = { ...options }
  for (const key of ['fetchText', 'fetchJson']) if (legacy[key]) {
    const original = legacy[key]
    legacy[key] = (...args) => { invoked++; return original(...args) }
  }
  await assert.rejects(createCatalogScraper(provider).run({ ...defaults, ...legacy }), /Parsed\/text-only injection has no original HTTP provenance/)
  assert.equal(invoked, 0)
}

export const replayCurrentDeclaredNative = async (source, { maxJobs, scenario = 'complete' } = {}) => {
  const profile = fixture.profiles[source], expected = fixture.oracle[source].records
  assert.ok(profile && expected)
  let missingId, changedHandoffs = 0
  const r = replay((url, page) => {
    if (scenario === 'missing-advertised-identity' && url === profile.publicAPIURL) return mutateJSON(page, value => {
      assert.ok(value.jobs.length > 1)
      missingId ??= value.jobs[0].id
      value.jobs = value.jobs.filter(row => row.id !== missingId)
    })
    if (scenario === 'foreign-company-delegation' && url === profile.primaryPages[0]) {
      const html = Buffer.from(page.bodyBase64, 'base64').toString('utf8'), next = profile.primaryPages[1]
      const document = readNativeDocument(html)
      const hrefs = new Set(document.nodes(node => node.tag === 'a' && node.attrs.href).map(node => node.attrs.href)
        .filter(href => { try { return new URL(href, url).href === next } catch { return false } }))
      assert.ok(hrefs.size, 'Actual retained active company handoff is required before the controlled edit')
      const changed = html.replace(/\bhref\s*=\s*(["'])(.*?)\1/g, (whole, quote, href) => {
        if (!hrefs.has(href)) return whole
        changedHandoffs++
        return 'href=' + quote + 'https://controlled-other-employer.example/careers' + quote
      })
      return { ...page, bodyBase64: Buffer.from(changed).toString('base64') }
    }
    if (scenario === 'script-only-declaration' && url === profile.primaryPages.at(-1)) {
      const html = Buffer.from(page.bodyBase64, 'base64').toString('utf8'), specifier = profile.declaration.scriptSpecifier
      let changed = 0
      const replacement = html.replace(/<script\b[^>]*>/gi, tag => tag.replace(/\bsrc\s*=\s*(["'])(.*?)\1/i, (whole, quote, src) => {
        if (src !== specifier) return whole
        changed++
        return 'data-controlled-inert-src=' + quote + src + quote
      }))
      assert.ok(changed, 'The actual retained declaration, not a guessed client, is edited')
      return { ...page, bodyBase64: Buffer.from(replacement + '<script>const controlledBoard=' + JSON.stringify(profile.boardURL) + ';</script>').toString('base64') }
    }
    return page
  })
  const provider = getScraperCatalog().find(row => row.source === source)
  const jobs = await createCatalogScraper(provider).run({ ...r.options, ...(maxJobs === undefined ? {} : { maxJobs }) })
  assert.equal(r.audits.length, 1)
  const audit = r.audits[0], inventory = readInventoryEvidence(jobs)
  assert.equal(audit.observations.length, expected.length)
  const actualIds = audit.observations.map(row => row.jobId), expectedIds = expected.map(row => row.id)
  if (scenario === 'missing-advertised-identity') assert.deepEqual([...actualIds].sort(), [...expectedIds].sort())
  else assert.deepEqual(actualIds, expectedIds)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.authoritativeSourceTotal, null)
  assert.equal(audit.authoritativeIndiaFacetCount, null)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.status, 'discovery-only')
  assert.equal(r.requests.some(url => url.includes('controlled-other-employer')), false)
  for (const original of expected) {
    const job = audit.observations.find(row => row.jobId === original.id)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    if (scenario !== 'missing-advertised-identity' || original.id !== missingId) {
      assert.deepEqual(job.sourceNativeListingRecord, original.originalFeedRecord)
      assert.ok(job.jobDescription.includes(original.bodyText))
    }
  }
  if (scenario === 'complete') {
    assert.equal(audit.opening.publisherQualified, true)
    assert.equal(audit.closing.publisherQualified, true)
    assert.equal(audit.opening.nativeListingComplete, true)
    assert.equal(audit.closing.nativeListingComplete, true)
  } else if (scenario === 'foreign-company-delegation' || scenario === 'script-only-declaration') {
    assert.equal(audit.opening.publisherQualified, false)
    assert.equal(audit.closing.publisherQualified, false)
    const pattern = scenario === 'foreign-company-delegation' ? /current primary career handoff changed/ : /active company-declared native asset changed/
    assert.ok(audit.opening.issues.some(issue => pattern.test(issue)))
    assert.ok(audit.closing.issues.some(issue => pattern.test(issue)))
    if (scenario === 'foreign-company-delegation') assert.ok(changedHandoffs >= 2)
    assert.equal(jobs.length, 0)
  } else {
    assert.equal(scenario, 'missing-advertised-identity')
    assert.equal(audit.opening.nativeListingComplete, false)
    assert.equal(audit.closing.nativeListingComplete, false)
    assert.equal(audit.opening.observedNativeRecordCount, expected.length - 1)
    assert.ok(audit.opening.nativePostIds.includes(missingId), 'The advertised identity is retained rather than disappearing into zero')
    assert.equal(audit.opening.originalNativeFeed.jobs.some(row => row.id === missingId), false)
  }
  return { jobs, audit, expected, requests: r.requests, missingId }
}
