import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'

globalThis.fetch = async () => { throw Error('Offline native-source tests prohibit HTTP') }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const id = '1425770600'
for (const row of fixture.responses) assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64, 'base64')).digest('hex'), row.sha256)

// Artificial title ownership controls; retained native fixture bytes stay exact.
test('an earlier unrelated title cannot suppress the role-owned h1 title', async () => {
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/(<body\b[^>]*>)/,
      '$1<section itemscope itemtype="https://schema.org/Organization"><span data-careersite-propertyid="title">Unrelated organization</span></section>')
    return page
  } })
  const role = audit.observations.find(job => job.jobId === id)
  assert.equal(role.sourceNativeRoleDetail.bound, true)
  assert.ok(role.jobDescription);assert.ok(jobs.some(job => job.jobId === id))
})

test('an unrelated h1 cannot authorize the role-owned title outside its required heading', async () => {
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/<h1>/g, '<div>').replace(/<\/h1>/g, '</div>')
      .replace(/(<body\b[^>]*>)/, '$1<section itemscope itemtype="https://schema.org/Organization"><h1><span data-careersite-propertyid="title">Unrelated organization</span></h1></section>')
    return page
  } })
  const role = audit.observations.find(job => job.jobId === id)
  assert.equal(role.sourceNativeRoleDetail.bound, false)
  assert.ok(role.sourceNativeRole.originalDescriptionHTML)
  assert.equal(jobs.some(job => job.jobId === id), false)
})
const execute = async ({ mutate = page => page, signal, onAudit, replayKnownRoleBytes = false } = {}) => {
  const queues = new Map(), calls = [], missing = [], audits = [], counts = new Map()
  for (const row of fixture.responses) {
    if (!queues.has(row.url)) queues.set(row.url, [])
    queues.get(row.url).push(row)
  }
  const get = async url => {
    calls.push(url)
    // Explicit offline controls may replay retained genuine role bytes after
    // changed/failing collection controls. This is not a fresh native response.
    const row = queues.get(url)?.shift() || (replayKnownRoleBytes && /\/Nomura\/job\//.test(url) ? fixture.responses.find(row => row.url === url) : null)
    if (!row) { missing.push(url);throw Error('No genuine retained response for ' + url) }
    const count = (counts.get(url) || 0) + 1;counts.set(url, count)
    const original = Buffer.from(row.bodyBase64, 'base64').toString('utf8')
    const page = mutate({ html: original, bodyBase64: row.bodyBase64, url: row.finalURL, status: row.status,
      headers: structuredClone(row.responseHeaders), purpose: row.purpose, count })
    // These explicit offline mutations are controls, not current native data.
    if (page.html !== original) page.bodyBase64 = Buffer.from(page.html).toString('base64')
    return page
  }
  const provider = getScraperCatalog().find(row => row.source === 'nomuraindia')
  const jobs = await createCatalogScraper(provider).run({ signal, now: () => '2026-10-31T03:00:00.000Z', fetchPage: get,
    fetchText: async url => (await get(url)).html, onAudit: async audit => { audits.push(audit);await onAudit?.(audit) } })
  assert.deepEqual(missing, [])
  return { jobs, audit: audits[0], calls, provider, evidence: readInventoryEvidence(jobs) }
}

test('registered Nomura reader replaces the old empty snapshot with every290 native role observation', async () => {
  const { jobs, audit, calls, evidence } = await execute()
  assert.equal(audit?.observations.length, 290)
  assert.equal(audit.rawPages.length, 298)
  assert.equal(jobs.length, 254)
  assert.equal(new Set(audit.observations.map(job => job.jobId)).size, 290)
  assert.equal(calls.filter(url => /\/Nomura\/job\//.test(url)).length, 290)
  assert.ok(audit.observations.every(job => job.sourceNativeRoleDetail.bound && job.country === 'India'))
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audit.authoritativeSourceTotal, null)
})

test('all native nested description markup remains exact rather than stopping at its first inner span', async () => {
  const { audit } = await execute()
  assert.equal(audit?.observations.length, 290)
  const records = audit.observations.map(job => [job.jobId, job.sourceNativeRole.originalDescriptionHTML]).sort((a, b) => a[0].localeCompare(b[0]))
  assert.equal(createHash('sha256').update(JSON.stringify(records)).digest('hex'), 'a0d0d13be2474c180bc22f007ab568597b07790852c0a2e361427220d250ffd1')
  assert.ok(audit.rawPages.every(page => page.bodyBase64 && page.bodySHA256))
})

test('real placeholder and held descriptions stay audited without becoming invented criteria', async () => {
  const { jobs, audit } = await execute()
  assert.equal(audit?.observations.length, 290)
  const incomplete = audit.observations.filter(job => job.sourceNativeCriteria.unavailable)
  assert.equal(incomplete.length, 36)
  assert.ok(incomplete.every(job => job.jobDescription === null && job.sourceNativeRole.originalDescriptionHTML))
  assert.ok(jobs.every(job => job.jobDescription && !job.sourceNativeCriteria.unavailable))
  assert.ok(audit.observations.find(job => job.jobId === '1423854000').sourceNativeAvailability.held)
})

test('explicit Country field, UTC source date and native publisher survive the real consumers', async () => {
  const { jobs, audit, provider } = await execute()
  const job = audit?.observations.find(job => job.jobId === id)
  assert.ok(job)
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Mumbai')
  assert.equal(job.postingDate, '2026-10-30T07:00:00.000Z')
  assert.equal(job.closingDate, null)
  assert.equal(job.company, 'Nomura Holdings, inc.')
  assert.equal(isIndiaJob(normalizeScrapedJob(job, provider)), true)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
})

test('Job Code stays separate from public posting ID and cannot fabricate a requisition or fulltime/onsite fields', async () => {
  const { audit } = await execute()
  const job = audit?.observations.find(job => job.jobId === id)
  assert.ok(job)
  assert.equal(job.jobId, '1425770600')
  assert.equal(job.requisitionId, null)
  assert.equal(job.sourceNativeRole.properties.find(field => field.id === 'customfield1').value, '14549')
  assert.equal(job.employmentType, null)
  assert.equal(job.remoteStatus, null)
})

test('unknown country cannot inherit India from Mumbai, the category or countryFilter', async () => {
  const { audit, provider } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/(data-careersite-propertyid="country"[^>]*>)\s*IN\s*(<\/span>)/, '$1ZZ$2')
    return page
  } })
  const job = audit?.observations.find(job => job.jobId === id)
  assert.ok(job)
  assert.equal(job.country, null)
  assert.equal(job.city, null)
  assert.equal(job.location, null)
  assert.deepEqual(job.locations, [])
  assert.equal(job.sourceCountryScopeUnresolved, true)
  assert.equal(job.sourceNativeRole.properties.find(field => field.id === 'country').value, 'ZZ')
  assert.equal(isIndiaJob(normalizeScrapedJob(job, provider)), false)
})

test('a conflicting canonical clears normalized authority while preserving its original role data', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/(<link\b[^>]*rel="canonical"[^>]*href=")[^"]+("[^>]*>)/,
      '$1https://unrelated.example/job/' + id + '/$2')
    return page
  } })
  const job = audit?.observations.find(job => job.jobId === id)
  assert.ok(job)
  assert.equal(job.sourceNativeRoleDetail.bound, false)
  assert.equal(job.country, null)
  assert.ok(job.sourceNativeRole.originalDescriptionHTML)
  assert.ok(job.sourceUrl.startsWith('https://careers.nomura.com/Nomura/job/'))
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 289)
})

test('effective provider no longer advertises a July verified-zero snapshot', () => {
  const provider = getScraperCatalog().find(row => row.source === 'nomuraindia')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.atsPlatform, 'successfactors-rmk-public-native')
})

test('awaited audit errors propagate after all genuine native observations', async () => {
  const reason = Error('Audit sink refused source')
  await assert.rejects(execute({ onAudit: audit => { assert.equal(audit.observations.length, 290);throw reason } }), error => error === reason)
})

test('caller cancellation before entry performs no native fetch and propagates', async () => {
  const reason = Error('Caller cancelled')
  await assert.rejects(execute({ signal: AbortSignal.abort(reason) }), error => error === reason)
})

test('failed opening category page recovers every known positive from closing pages', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.includes('/100/') && page.count === 1) page.status = 503
    return page
  } })
  assert.equal(audit.observations.length, 290)
  assert.ok(audit.observations.every(job => job.sourceNativeRoleDetail.bound))
  assert.ok(audit.issues.some(issue => issue.kind === 'native-category-unqualified'))
})

test('failed closing category page retains full earlier criteria and cannot authorize cleanup', async () => {
  const { jobs, audit, evidence } = await execute({ mutate: page => {
    if (page.url.includes('/100/') && page.count === 2) page.status = 503
    return page
  } })
  assert.equal(audit.observations.length, 290)
  assert.equal(jobs.length, 254)
  assert.equal(audit.observations.filter(job => !job.sourceCurrentNativeRoleQualified).length, 100)
  assert.equal(evidence.listingComplete, false)
  assert.ok(audit.observations.every(job => job.lifecycleCleanupAllowed === false))
})

test('failed opening role retries its declared URL during closing reconciliation', async () => {
  const { audit, calls } = await execute({ replayKnownRoleBytes: true, mutate: page => {
    if (page.url.endsWith('/' + id + '/') && page.count === 1) page.status = 503
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.ok(job.sourceNativeRoleDetail.bound && job.jobDescription)
  assert.equal(calls.filter(url => url.endsWith('/' + id + '/')).length, 2)
  assert.equal(audit.rawPages.length, 299)
})

test('closing-only native rows are read without erasing other earlier positives', async () => {
  const { audit } = await execute({ mutate: page => {
    if (!page.url.includes('/Nomura/job/') && page.count === 1)
      page.html = page.html.replace(/<tr\b[^>]*class="data-row"[^>]*>[\s\S]*?<\/tr>/g, row => row.includes('/' + id + '/') ? '' : row)
    return page
  } })
  assert.equal(audit.observations.length, 290)
  assert.ok(audit.observations.find(job => job.jobId === id).sourceNativeRoleDetail.bound)
  assert.ok(audit.issues.some(issue => issue.kind === 'native-closing-new-or-changed-role' && issue.id === id))
})

test('duplicate native Country fields cannot pick one value while inert fields supply no authority', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/(<span\b[^>]*data-careersite-propertyid="country"[^>]*>[\s\S]*?<\/span>)/,
      '$1<span data-careersite-propertyid="country">US</span><template><span data-careersite-propertyid="country">IN</span></template>')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.country, null);assert.equal(job.city, null);assert.deepEqual(job.locations, [])
  assert.deepEqual(job.sourceNativeRole.properties.filter(field => field.id === 'country').map(field => field.value), ['IN', 'US'])
})

test('a template-only replacement Country field cannot authorize India', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/(<span\b[^>]*data-careersite-propertyid="country"[^>]*>[\s\S]*?<\/span>)/, '<template>$1</template>')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.country, null);assert.equal(job.city, null)
})

test('impossible UTC dates remain literal source data and never become a guessed timestamp', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace('Fri Oct 30 07:00:00 UTC 2026', 'Fri Feb 30 07:00:00 UTC 2026')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.postingDate, null)
  assert.equal(job.sourceNativeRole.microdataMetas.find(field => field.itemprop === 'datePosted').content, 'Fri Feb 30 07:00:00 UTC 2026')
})

test('uninvoked native init code cannot authorize a job identity', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace('j2w.Apply.init({', 'function neverCalled() { j2w.Apply.init({')
      .replace(/(sourceId\s*:\s*'JATS-nomurahold'[\s\S]*?\}\);)/, '$1 }')
    return page
  } })
  assert.equal(audit.observations.find(job => job.jobId === id).sourceNativeRoleDetail.bound, false)
})

test('duplicate native init identity keys stay unqualified', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/jobID\s*:\s*1425770600,/, 'jobID: 1425770600, jobID: 999,')
    return page
  } })
  assert.equal(audit.observations.find(job => job.jobId === id).sourceNativeRoleDetail.bound, false)
})

test('duplicate attributes on the published init script cannot provide identity authority', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/<script type="text\/javascript">(\s*\/\/<!\[CDATA\[\s*j2w\.Apply\.init)/,
      '<script type="text/javascript" type="application/json">$1')
    return page
  } })
  assert.equal(audit.observations.find(job => job.jobId === id).sourceNativeRoleDetail.bound, false)
})

test('review R1 unrelated Organization footer cannot replace the role country', async () => {
  const { audit, provider } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html
      .replace(/<span\b[^>]*data-careersite-propertyid="country"[^>]*>[\s\S]*?<\/span>/, '')
      .replace('</body>', '<footer itemscope itemtype="https://schema.org/Organization"><span data-careersite-propertyid="country">IN</span></footer></body>')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.country, null);assert.equal(job.city, null);assert.deepEqual(job.locations, [])
  assert.equal(isIndiaJob(normalizeScrapedJob(job, provider)), false)
  const original = job.sourceNativeRole.properties.find(field => field.id === 'country')
  assert.equal(original.value, 'IN');assert.equal(original.roleOwned, false)
})

test('review R1 nested unrelated entity cannot supply role country', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html
      .replace(/(<span\b[^>]*data-careersite-propertyid="country"[^>]*>[\s\S]*?<\/span>)/,
        '<div itemscope itemtype="https://schema.org/Organization">$1</div>')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.country, null);assert.equal(job.city, null)
  assert.equal(job.sourceNativeRole.properties.find(field => field.id === 'country').roleOwned, false)
})

test('review R1 unrelated footer description cannot become missing role criteria', async () => {
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html
      .replace('data-careersite-propertyid="description"', 'data-original-careersite-propertyid="description"')
      .replace('</body>', '<footer><span data-careersite-propertyid="description">Unrelated office reception and corporate information.</span></footer></body>')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.jobDescription, null)
  assert.equal(jobs.some(job => job.jobId === id), false)
  assert.equal(job.sourceNativeRole.properties.find(field => field.id === 'description').roleOwned, false)
})

const changedClosingTitle = page => {
  if (!page.url.includes('/Nomura/job/') && page.count === 2)
    page.html = page.html.replace(/<tr\b[^>]*class="data-row"[^>]*>[\s\S]*?<\/tr>/g,
      row => row.includes('/' + id + '/') ? row.replace(/>Quants</g, '>Quants Updated<') : row)
  if (page.url.endsWith('/' + id + '/') && page.count === 2)
    page.html = page.html.replace(/>Quants(\s*<\/span>)/, '>Quants Updated$1')
  return page
}

test('review R2 changed closing country retains earlier India discovery and both original projections', async () => {
  const { audit, jobs } = await execute({ replayKnownRoleBytes: true, mutate: page => {
    page = changedClosingTitle(page)
    if (page.url.endsWith('/' + id + '/') && page.count === 2)
      page.html = page.html.replace(/(data-careersite-propertyid="country"[^>]*>)\s*IN\s*(<\/span>)/, '$1US$2')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.country, 'India');assert.equal(job.sourceCurrentNativeRoleQualified, false)
  assert.ok(jobs.some(job => job.jobId === id))
  assert.equal(job.sourceNativeClosingObservation.country, 'United States')
  assert.equal(job.sourceNativeClosingObservation.title, 'Quants Updated')
  assert.equal(job.sourceNativeObservationHistory.length, 2)
  assert.deepEqual(job.sourceNativeObservationHistory.map(row => row.observation.country), ['India', 'United States'])
  assert.notEqual(job.sourceNativeObservationHistory[0].observation.sourceNativeRoleDetail.bodySHA256,
    job.sourceNativeObservationHistory[1].observation.sourceNativeRoleDetail.bodySHA256)
})

test('review R2 changed closing criteria preserve both original descriptions', async () => {
  const { audit } = await execute({ replayKnownRoleBytes: true, mutate: page => {
    page = changedClosingTitle(page)
    if (page.url.endsWith('/' + id + '/') && page.count === 2)
      page.html = page.html.replace('Nomura Overview:', 'Updated native responsibilities: Nomura Overview:')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.sourceCurrentNativeRoleQualified, false)
  assert.equal(job.title, 'Quants')
  assert.equal(job.sourceNativeObservationHistory.length, 2)
  assert.ok(job.jobDescription.includes('Nomura Overview:'))
  assert.equal(job.jobDescription.includes('Updated native responsibilities:'), false)
  assert.ok(job.sourceNativeClosingObservation.jobDescription.includes('Updated native responsibilities:'))
  assert.notEqual(job.sourceNativeObservationHistory[0].observation.sourceNativeRole.originalDescriptionHTML,
    job.sourceNativeObservationHistory[1].observation.sourceNativeRole.originalDescriptionHTML)
})

test('review R3 meaningful responsibilities about held transactions remain complete native criteria', async () => {
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace('Nomura Overview:',
      'Responsibilities: identify transactions expected to be on hold during review. Nomura Overview:')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.sourceNativeAvailability.held, false)
  assert.equal(job.sourceNativeCriteria.unavailable, false)
  assert.ok(job.jobDescription.includes('transactions expected to be on hold'))
  assert.ok(jobs.some(job => job.jobId === id))
  assert.equal(audit.observations.find(job => job.jobId === '1423854000').sourceNativeAvailability.held, true)
})

test('review R4 every genuine canonical and microdata originalHTML is exactly its original opening tag', async () => {
  const { audit } = await execute()
  for (const job of audit.observations) {
    const original = Buffer.from(fixture.responses.find(row => row.url === job.sourceUrl).bodyBase64, 'base64').toString('utf8')
    const originalMetaTags = original.match(/<meta\b[^>]*itemprop="[^"]+"[^>]*>/g) || []
    const originalCanonicals = original.match(/<link\b[^>]*rel="canonical"[^>]*>/g) || []
    assert.deepEqual(job.sourceNativeRole.microdataMetas.map(meta => meta.originalHTML), originalMetaTags)
    assert.deepEqual(job.sourceNativeRole.canonicals.map(link => link.originalHTML), originalCanonicals)
  }
})

test('a missing Nomura employment field cannot acquire a generic full-time default in the real consumer', async () => {
  const { audit, provider } = await execute()
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(normalizeScrapedJob(job, provider).employmentType, null)
  assert.equal(job.sourceEmploymentTypeUnresolved, true)
  assert.ok(audit.observations.every(job => job.sourceEmploymentTypeUnresolved && job.employmentType === null))
})

test('Nomura job cities cannot turn absent work arrangements into an on-site claim', async () => {
  const { audit, provider } = await execute()
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(normalizeScrapedJob(job, provider).remoteStatus, null)
  assert.equal(job.sourceRemoteStatusUnresolved, true)
  assert.ok(audit.observations.every(job => job.sourceRemoteStatusUnresolved && job.remoteStatus === null))
})
