import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { document } from './nativeHtml.js'
import { readSearchConfiguration } from './nativeData.js'

globalThis.fetch = async () => { throw Error('Offline genuine-corpus tests prohibit HTTP') }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const assets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-declared-search-assets-20261031.json.gz', import.meta.url))))
const id = '1430629133'
for (const row of fixture.responses)
  assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64, 'base64')).digest('hex'), row.sha256)

export const execute = async ({ mutate = page => page, signal, onAudit, replayKnownRoleBytes = false, maxJobs, artificialPagingControl = false } = {}) => {
  const queues = new Map(), calls = [], missing = [], audits = [], counts = new Map()
  for (const row of fixture.responses) {
    if (!queues.has(row.url)) queues.set(row.url, [])
    queues.get(row.url).push(row)
  }
  const get = async url => {
    calls.push(url)
    // Explicit artificial closing/failure controls may replay retained genuine
    // role bytes offline. Such a replay is never current native HTTP proof.
    let row = queues.get(url)?.shift() || (replayKnownRoleBytes && /\/job\//.test(url) ? fixture.responses.find(row => row.url === url) : null)
    if (!row && artificialPagingControl) {
      row = assets.responses.find(row => row.url === url && row.purpose.includes('script'))
      if (!row && url === 'https://jobs.schaeffler.com/tile-search-results/?q=&locationsearch=India&startrow=100') {
        // Explicit artificial HTTP-route control: reuse an unchanged genuine
        // HTML body at the source-declared paging URL. This is NOT a captured
        // native API response, feed or current proof. Original files stay exact.
        const original = fixture.responses[0]
        row = { ...original, finalURL: url, purpose: 'artificial-offline-paging-route-control-not-native-HTTP-proof' }
      }
    }
    if (!row) { missing.push(url);throw Error('No genuine retained response for ' + url) }
    const count = (counts.get(url) || 0) + 1;counts.set(url, count)
    const original = Buffer.from(row.bodyBase64, 'base64').toString('utf8')
    const page = mutate({ html: original, bodyBase64: row.bodyBase64, url: row.finalURL, status: row.status,
      headers: structuredClone(row.responseHeaders), purpose: row.purpose, count })
    if (page.html !== original) page.bodyBase64 = Buffer.from(page.html).toString('base64')
    return page
  }
  const provider = getScraperCatalog().find(row => row.source === 'schaeffler')
  const jobs = await createCatalogScraper(provider).run({ signal, maxJobs, now: () => '2026-10-31T03:30:00.000Z',
    fetchPage: get, fetchText: async url => (await get(url)).html,
    onAudit: async audit => { audits.push(audit);await onAudit?.(audit) } })
  assert.deepEqual(missing, [])
  return { jobs, audit: audits[0], calls, provider, evidence: readInventoryEvidence(jobs) }
}

test('registered Schaeffler reader recovers every native tile and all ten real public roles', async () => {
  const { audit, jobs, calls, evidence } = await execute()
  assert.equal(audit?.observations.length, 10)
  assert.equal(audit.rawPages.length, 12)
  assert.equal(jobs.length, 10)
  assert.equal(new Set(audit.observations.map(job => job.jobId)).size, 10)
  assert.equal(calls.filter(url => /\/job\//.test(url)).length, 10)
  assert.ok(audit.observations.every(job => job.sourceNativeRoleDetail.bound && job.jobDescription))
  assert.equal(evidence.listingComplete, false);assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null);assert.equal(audit.authoritativeSourceTotal, null)
})

test('all nested native description markup and criterion-bearing records survive intact', async () => {
  const { audit } = await execute()
  assert.equal(audit?.observations.length, 10)
  const pairs = audit.observations.map(job => [job.jobId, job.sourceNativeRole.originalDescriptionHTML]).sort((a,b) => a[0].localeCompare(b[0]))
  assert.equal(createHash('sha256').update(JSON.stringify(pairs)).digest('hex'), '18a6d76da11055c044717c32af01eea95d0a8d52208e306ecb03c27ec2eaf016')
  assert.ok(audit.observations.every(job => job.jobDescription.length > 1000))
  assert.ok(audit.rawPages.every(page => page.bodyBase64 && page.bodySHA256))
})

test('India search, provider filter and unstructured location text cannot authorize job country', async () => {
  const { audit, jobs, provider } = await execute()
  assert.equal(audit?.observations.length, 10)
  for (const job of audit.observations) {
    assert.equal(job.country, null);assert.equal(job.city, null);assert.equal(job.state, null)
    assert.equal(job.location, null);assert.deepEqual(job.locations, [])
    assert.equal(job.sourceCountryScopeUnresolved, true)
    assert.equal(isIndiaJob(normalizeScrapedJob(job, provider)), false)
    assert.match(job.sourceNativeRole.properties.find(field => field.id === 'location').value, /, IN, /)
  }
  assert.equal(jobs.length, 10)
})

test('explicit native requisition IDs stay separate from public posting IDs without invented employment fields', async () => {
  const { audit } = await execute()
  const job = audit?.observations.find(job => job.jobId === id)
  assert.ok(job)
  assert.equal(job.jobId, id);assert.equal(job.requisitionId, '46510')
  const field = job.sourceNativeRole.properties.find(field => field.id === 'customfield3')
  assert.equal(field.value, '46510');assert.match(field.label, /^Job Requisition ID:/i)
  assert.equal(job.employmentType, null);assert.equal(job.remoteStatus, null);assert.deepEqual(job.requiredSkills, [])
  assert.ok(audit.observations.every(job => job.requisitionId && job.requisitionId !== job.jobId))
})

test('genuine explicit UTC posting and closing dates survive actual normalization', async () => {
  const { audit, provider } = await execute()
  const job = audit?.observations.find(job => job.jobId === id)
  assert.ok(job)
  assert.equal(job.postingDate, '2026-10-31T02:00:00.000Z')
  assert.equal(job.closingDate, '2026-11-07T18:30:00.000Z')
  const normalized = normalizeScrapedJob(job, provider)
  assert.equal(new Date(normalized.postingDate).toISOString(), job.postingDate)
  assert.equal(new Date(normalized.closingDate).toISOString(), job.closingDate)
  assert.equal(job.sourceNativeAvailability.activeRecruitmentVerified, false)
  assert.equal(job.sourceNativeAvailability.deadlinePassed, false)
})

test('genuine microdata and canonical field ranges retain exactly their original tags', async () => {
  const { audit } = await execute()
  assert.equal(audit?.observations.length, 10)
  for (const job of audit.observations) {
    const raw = Buffer.from(fixture.responses.find(row => row.url === job.sourceUrl).bodyBase64, 'base64').toString('utf8')
    assert.deepEqual(job.sourceNativeRole.microdataMetas.map(meta => meta.originalHTML), raw.match(/<meta\b[^>]*itemprop="[^"]+"[^>]*>/g))
    assert.deepEqual(job.sourceNativeRole.canonicals.map(meta => meta.originalHTML), raw.match(/<link\b[^>]*rel="canonical"[^>]*>/g))
    assert.equal(job.sourceDetailComplete, false);assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
})

test('an unrelated Organization footer country cannot resolve these role countries', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace('</body>',
      '<footer itemscope itemtype="https://schema.org/Organization"><span data-careersite-propertyid="country">IN</span></footer></body>')
    return page
  } })
  const job = audit?.observations.find(job => job.jobId === id)
  assert.ok(job);assert.equal(job.country, null)
  assert.equal(job.sourceNativeRole.properties.find(field => field.id === 'country').roleOwned, false)
})

test('a foreign canonical cannot grant authority but all original role fields remain auditable', async () => {
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(/(<link\b[^>]*rel="canonical"[^>]*href=")[^"]+("[^>]*>)/,
      '$1https://unrelated.example/job/' + id + '/$2')
    return page
  } })
  const job = audit?.observations.find(job => job.jobId === id)
  assert.ok(job);assert.equal(job.sourceNativeRoleDetail.bound, false)
  assert.equal(job.country, null);assert.ok(job.sourceNativeRole.originalDescriptionHTML)
  assert.equal(jobs.some(job => job.jobId === id), false)
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 9)
})

test('closing collection failures preserve all earlier full positives without authorizing cleanup', async () => {
  const { audit, jobs, evidence } = await execute({ mutate: page => {
    if (page.url.includes('/search/') && page.count === 2) page.status = 503
    return page
  } })
  assert.equal(audit?.observations.length, 10);assert.equal(jobs.length, 10)
  assert.ok(audit.observations.every(job => job.jobDescription && !job.sourceCurrentNativeRoleQualified))
  assert.equal(evidence.listingComplete, false);assert.equal(audit.lifecycleCleanupAllowed, false)
})

test('maxJobs limits returned records while retaining every known native role observation', async () => {
  const { audit, jobs } = await execute({ maxJobs: 1 })
  assert.equal(audit?.observations.length, 10);assert.equal(audit.rawPages.length, 12)
  assert.equal(jobs.length, 1)
})

test('awaited audit sink failures propagate after all genuine role observations', async () => {
  const reason = Error('Audit sink refused source')
  await assert.rejects(execute({ onAudit: audit => { assert.equal(audit.observations.length, 10);throw reason } }), error => error === reason)
})

test('caller cancellation before entry performs no native request', async () => {
  const reason = Error('Caller cancelled')
  await assert.rejects(execute({ signal: AbortSignal.abort(reason) }), error => error === reason)
})

test('failed opening search still recovers every closing positive', async () => {
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.includes('/search/') && page.count === 1) page.status = 503
    return page
  } })
  assert.equal(audit.observations.length, 10);assert.equal(jobs.length, 10)
  assert.ok(audit.observations.every(job => job.sourceNativeRoleDetail.bound))
})

test('failed role transport retries its actual declared URL at closing', async () => {
  const { audit, calls } = await execute({ replayKnownRoleBytes: true, mutate: page => {
    if (page.url.endsWith('/' + id + '/') && page.count === 1) page.status = 503
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.ok(job.jobDescription && job.sourceNativeRoleDetail.bound)
  assert.equal(calls.filter(url => url.endsWith('/' + id + '/')).length, 2)
  assert.equal(job.sourceNativeObservationHistory.length, 2)
})

test('native tile data-url remains a declared positive when its title link becomes plain text', async () => {
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.includes('/search/')) page.html = page.html.replace(
      /<li\b[^>]*class="job-tile\b[^"]*"[^>]*>[\s\S]*?<\/li>/g,
      tile => tile.includes('/' + id + '/') ? tile.replace(/<a\b[^>]*class="jobTitle-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1') : tile)
    return page
  } })
  assert.equal(audit.observations.length, 10)
  const job = audit.observations.find(job => job.jobId === id)
  assert.ok(job?.sourceNativeRoleDetail.bound)
  assert.ok(jobs.some(job => job.jobId === id))
  assert.ok(job.sourceNativeDiscovery.originalListingRows.some(row => row.discoveryKind === 'native-tile-data-url'))
})

test('closing native requisition-field changes trigger fresh detail and retain both original positives', async () => {
  const { audit, calls, jobs } = await execute({ replayKnownRoleBytes: true, mutate: page => {
    if (page.url.includes('/search/') && page.count === 2) page.html = page.html.replace(
      /<li\b[^>]*class="job-tile\b[^"]*"[^>]*>[\s\S]*?<\/li>/g,
      tile => tile.includes('/' + id + '/') ? tile.replace(/>46510(\s*<)/g, '>77777$1') : tile)
    if (page.url.endsWith('/' + id + '/') && page.count === 2) page.html = page.html.replace(
      /(data-careersite-propertyid="customfield3"[^>]*>)\s*46510\s*(<\/span>)/, '$177777$2')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(calls.filter(url => url.endsWith('/' + id + '/')).length, 2)
  assert.equal(job.requisitionId, '46510')
  assert.equal(job.sourceNativeClosingObservation.requisitionId, '77777')
  assert.equal(job.sourceNativeObservationHistory.length, 2)
  assert.equal(job.sourceCurrentNativeRoleQualified, false)
  assert.ok(jobs.some(job => job.jobId === id))
})

test('conflicting own and tile requisition fields stay literal without choosing a false normalized ID', async () => {
  const { audit } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace(
      /(data-careersite-propertyid="customfield3"[^>]*>)\s*46510\s*(<\/span>)/, '$199999$2')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.requisitionId, null)
  assert.equal(job.sourceNativeRequisitionEvidence.qualified, false)
  assert.equal(job.sourceNativeRole.properties.find(field => field.id === 'customfield3').value, '99999')
  assert.ok(job.jobDescription)
})

test('meaningful held-transaction prose cannot manufacture a vacancy status or discard criteria', async () => {
  const { audit, jobs } = await execute({ mutate: page => {
    if (page.url.endsWith('/' + id + '/')) page.html = page.html.replace('Schaeffler is a dynamic',
      'Transactions may need to be on hold during review. Schaeffler is a dynamic')
    return page
  } })
  const job = audit.observations.find(job => job.jobId === id)
  assert.equal(job.sourceNativeAvailability.held, null)
  assert.ok(job.jobDescription.includes('Transactions may need to be on hold'))
  assert.ok(jobs.some(job => job.jobId === id))
})

test('artificial more-results control follows the actually declared GET pagination contract as inert data', async () => {
  const { audit, calls } = await execute({ artificialPagingControl: true, mutate: page => {
    if (page.url.includes('/search/')) page.html = page.html
      .replace(/jobRecordsFound:\s*parseInt\("10"\)/, 'jobRecordsFound: parseInt("110")')
      .replaceAll('of 10 Jobs', 'of 110 Jobs')
      .replace(/<li\b[^>]*class="job-tile\b[^"]*"[^>]*>[\s\S]*?<\/li>/g, tile => tile.includes('/' + id + '/') ? '' : tile)
    return page
  } })
  assert.equal(audit.observations.length, 10)
  assert.ok(audit.observations.find(job => job.jobId === id)?.sourceNativeRoleDetail.bound)
  assert.equal(calls.filter(url => url.includes('/tile-search-results/')).length, 2)
  assert.ok(calls.some(url => url.includes('/platform/js/j2w/min/j2w.searchResults.min.js?')))
  assert.equal(audit.sourceScopeComplete, false)
})

test('genuine missing structured employment fields remain unresolved through the actual normalizer', async () => {
  const { audit, provider } = await execute()
  for (const job of audit.observations) {
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(normalized.employmentType, null)
    assert.equal(normalized.sourceEmploymentType, null)
    assert.equal(job.sourceEmploymentTypeUnresolved, true)
  }
})

test('genuine missing native work-arrangement fields retain their unresolved scope', async () => {
  const { audit, provider } = await execute()
  for (const job of audit.observations) {
    assert.equal(normalizeScrapedJob(job, provider).remoteStatus, null)
    assert.equal(job.sourceRemoteStatusUnresolved, true)
  }
})

// Artificial ownership controls change only in-memory copies of genuine pages.
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

const pagingContextControl = async context => execute({ artificialPagingControl: true, mutate: page => {
  if (page.url.includes('/search/')) {
    page.html = page.html.replace(/jobRecordsFound:\s*parseInt\("10"\)/, 'jobRecordsFound: parseInt("110")')
      .replaceAll('of 10 Jobs', 'of 110 Jobs')
      .replace(/<li\b[^>]*class="job-tile\b[^"]*"[^>]*>[\s\S]*?<\/li>/g, tile => tile.includes('/' + id + '/') ? '' : tile)
    const active = [...page.html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].find(match => match[0].includes('j2w.SearchResults.init'))?.[0]
    assert.ok(active)
    const dead = active.replace('$(function () {', 'function neverCalled() {').replace(/\}\);(\s*\/\/\]\]>)/, '}$1')
    if (context === 'dead-only') page.html = page.html.replace(active, dead)
    if (context === 'false-branch-only') page.html = page.html.replace(active, dead.replace('function neverCalled() {', 'if (false) {'))
    if (context === 'genuine-plus-dead') page.html = page.html.replace(active, active + dead)
    if (context === 'qualified-conflict') page.html = page.html.replace(active, active + active.replace('parseInt("110")', 'parseInt("210")'))
  }
  return page
} })

test('dormant search configuration cannot veto the genuine published ready callback', async () => {
  const { audit, calls } = await pagingContextControl('genuine-plus-dead')
  assert.equal(audit.observations.length, 10)
  assert.equal(calls.filter(url => url.includes('/tile-search-results/')).length, 2)
  assert.equal(audit.navigationEvidence.length, 2)
})

for (const context of ['dead-only', 'false-branch-only']) test('unqualified paging context cannot authorize navigation: ' + context, async () => {
  const { audit, calls } = await pagingContextControl(context)
  assert.equal(audit.observations.length, 9)
  assert.equal(calls.filter(url => url.includes('/tile-search-results/')).length, 0)
  assert.equal(audit.navigationEvidence.length, 0)
})

test('conflicting qualified search configurations fail closed with an explicit issue', async () => {
  const { audit, calls } = await pagingContextControl('qualified-conflict')
  assert.equal(audit.observations.length, 9)
  assert.equal(calls.filter(url => url.includes('/tile-search-results/')).length, 0)
  assert.ok(audit.issues.some(issue => issue.kind === 'native-declared-pagination-unqualified'
    && /multiple|conflict/i.test(issue.message)))
})

test('only direct initialization in the observed top-level ready callback supplies paging authority', () => {
  const init = 'j2w.SearchResults.init({apiEndpoint:"tile-search-results",jobRecordsFound:110,jobRecordsPerPage:100})'
  for (const source of ['function neverCalled(){' + init + ';}', 'if(false){' + init + ';}',
    '$(function(){if(false){' + init + ';}});', init + ';']) {
    const config = readSearchConfiguration(document('<script>' + source + '</script>'))
    assert.equal(config.calls.length, 0)
    assert.equal(config.unqualifiedCalls.length, 1)
    assert.equal(config.unqualifiedCalls[0].originalCall, init)
  }
  assert.equal(readSearchConfiguration(document('<script>$(function(){' + init + ';});</script>')).calls.length, 1)
})
