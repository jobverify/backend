import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { createSocieteGeneraleScraper, extractSearchResults, CAREER_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../../scraper-support/utils/scraperOutcome.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/full-native-20261105.json.gz', import.meta.url))))
const bodies = new Map(captured.entries.map(entry => [entry.url, entry]))
const frenchURL = 'https://careers.societegenerale.com/fr/Technical/toutes-les-offres'
const nativeReader = async url => {
  const entry = bodies.get(url)
  assert.ok(entry, `Uncaptured URL: ${url}`)
  return { status: entry.status, url: entry.url, html: entry.body }
}
const settle = promise => promise.then(value => ({ status: 'resolved', value }), reason => ({ status: 'rejected', reason }))

test('native English listings retain both country-only India roles without inventing a city', () => {
  // Break caught: requiring a city prefix silently drops employer-owned India refs.
  const jobs = extractSearchResults(bodies.get(CAREER_PAGE_URL).body)
  assert.equal(jobs.length, 213)
  assert.equal(jobs.find(job => job.jobId === '260009M6').location, 'India')
  assert.equal(jobs.find(job => job.jobId === '260009M6').city, null)
  assert.equal(jobs.find(job => job.jobId === '260008BN').country, 'India')
})

test('a result limit keeps bilingual native counts separate from returned jobs and blocks completion', async () => {
  // Break caught: one English page/count or a limited result claims complete coverage.
  const requests = []
  const jobs = await createSocieteGeneraleScraper({ maxJobs: 1 }).run({ fetchText: async url => {
    requests.push(url)
    return nativeReader(url)
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '260009KF')
  assert.equal(jobs.sourceAudit.nativeGlobalDistinct, 1052)
  assert.equal(jobs.sourceAudit.nativeIndiaDistinct, 214)
  assert.equal(jobs.sourceAudit.nativeIndiaLanguageRows, 220)
  assert.equal(jobs.sourceAudit.nativeLanguageRows, 1106)
  assert.ok(requests.includes(frenchURL))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /limit/)
})

test('an already aborted caller starts no read and retains its opaque reason', async () => {
  // Break caught: falling through pre-abort, or wrapping/coercing a falsey reason.
  for (const reason of [null, false, 0, 'cancel', Object.freeze({ code: 'opaque' })]) {
    const controller = new AbortController()
    controller.abort(reason)
    let reads = 0
    const result = await settle(createSocieteGeneraleScraper().run({ signal: controller.signal, fetchText: async () => {
      reads += 1
      return bodies.get(CAREER_PAGE_URL).body
    } }))
    assert.equal(result.status, 'rejected')
    assert.equal(result.reason, reason)
    assert.equal(reads, 0)
  }
})

test('an abort settles promptly when the listing reader ignores cancellation and starts no late details', async () => {
  // Break caught: awaiting an ignored reader forever or hydrating after cancellation.
  const controller = new AbortController()
  const reason = Object.freeze({ code: 'stop-ignored-reader' })
  let release
  let reads = 0
  const run = settle(createSocieteGeneraleScraper().run({ signal: controller.signal, fetchText: () => {
    reads += 1
    return new Promise(resolve => { release = resolve })
  } }))
  await new Promise(resolve => setImmediate(resolve))
  controller.abort(reason)
  const result = await Promise.race([run, new Promise(resolve => setTimeout(() => resolve({ status: 'pending' }), 100))])
  release({ status: 200, url: CAREER_PAGE_URL, html: bodies.get(CAREER_PAGE_URL).body })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(result.status, 'rejected')
  assert.equal(result.reason, reason)
  assert.equal(reads, 1)
})

test('a rejecting reader cannot replace the exact caller abort reason', async () => {
  // Break caught: a transport rejection shadows caller ownership of cancellation.
  const controller = new AbortController()
  const reason = false
  const result = await settle(createSocieteGeneraleScraper().run({ signal: controller.signal, fetchText: async () => {
    controller.abort(reason)
    throw new Error('Transport-specific abort')
  } }))
  assert.equal(result.status, 'rejected')
  assert.equal(result.reason, reason)
})

test('all 214 India details survive while missing native country counters keep full-source coverage incomplete', async () => {
  // Break caught: English-only coverage, duplicate language rows, truncated JD, or no final reconciliation.
  const requests = []
  const jobs = await createSocieteGeneraleScraper({ detailConcurrency: 3 }).run({ fetchText: async url => {
    requests.push(url)
    return nativeReader(url)
  } })
  assert.equal(jobs.length, 214)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 214)
  assert.equal(jobs.find(job => job.jobId === '260009M6').city, null)
  const french = jobs.find(job => job.jobId === '26000EP3')
  assert.equal(french.country, 'India')
  assert.equal(french.city, 'Bangalore')
  assert.equal(french.source, 'societegenerale')
  assert.match(french.jobDescription, /Minimum 10\+ Years/)
  assert.match(french.jobDescription, /Business|Société Générale|Environnement/i)
  assert.equal(french.closingDate, null)
  assert.equal(jobs[0].postingDate, '2026-11-04')
  assert.equal(requests.length, 218)
  assert.deepEqual(requests.slice(-2), [CAREER_PAGE_URL, frenchURL])
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /country-facet/)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence:readInventoryEvidence(jobs),detailHealth:extractionDetailHealth(jobs) }), { replaceExisting:false })
  assert.equal(jobs.sourceAudit.nativeGlobalDistinct, 1052)
  assert.equal(jobs.sourceAudit.nativeIndiaDistinct, 214)
  assert.equal(jobs.sourceAudit.detailRequests, 214)
})

test('a consistently wrong non-India country counter cannot be certified by stable opening and closing pages', async () => {
  const jobs = await createSocieteGeneraleScraper().run({ fetchText: async url => {
    const page = await nativeReader(url)
    if (url === CAREER_PAGE_URL || url === frenchURL) page.html = mutateSettings(page.html, data => {
      data.quantum.quantum_filters.refLocation.en.France.count += 1
      data.quantum.quantum_filters.refLocation.fr.France.count += 1
    })
    return page
  } })
  assert.equal(jobs.length, 214)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /country-facet-count/)
  assert.ok(jobs.sourceAudit.issues.some(issue => /FRA/.test(issue)))
})

test('a positive country facet without a matching native role cannot disappear from all-country reconciliation', async () => {
  const jobs = await createSocieteGeneraleScraper().run({ fetchText: async url => {
    const page = await nativeReader(url)
    if (url === CAREER_PAGE_URL || url === frenchURL) page.html = mutateSettings(page.html, data => {
      const reference = data.quantum.quantum_filters.refLocation
      reference.id.AFG = {en:'Afghanistan',fr:'Afghanistan'}
      reference.en.Afghanistan = {id:'AFG',count:1}
      reference.fr.Afghanistan = {id:'AFG',count:1}
    })
    return page
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.sourceAudit.issues.some(issue => /country-facet-count-unreconciled:AFG/.test(issue)))
})

test('reciprocal employer labels cannot turn an unknown typed country into a recognized foreign country', async () => {
  let unknownId
  const jobs = await createSocieteGeneraleScraper().run({ fetchText: async url => {
    const page = await nativeReader(url)
    if (url === CAREER_PAGE_URL || url === frenchURL) {
      page.html = mutateSettings(page.html, data => {
        unknownId ||= Object.entries(data.quantum.all_offers).find(([,role]) => role.country === 'FRA')[0]
        data.quantum.all_offers[unknownId].country = 'ZZZ'
        data.quantum.quantum_filters.refLocation.id.ZZZ = {en:'Unknown territory',fr:'Unknown territory'}
      })
      const card = new RegExp(`(<div\\s+data-offer-id=["']${unknownId}["'][\\s\\S]*?)(?=\\s*<div\\s+data-offer-id=|<\\/main>)`, 'g')
      page.html = page.html.replace(card, segment => segment.replace(/France(\s*<\/span>)/, 'Unknown territory$1'))
    }
    return page
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /country-identity/)
})

test('recognized country codes must also agree with independently recognized English country labels', async () => {
  const jobs = await createSocieteGeneraleScraper().run({ fetchText: async url => {
    const page = await nativeReader(url)
    if (url === CAREER_PAGE_URL || url === frenchURL) {
      page.html = mutateSettings(page.html, data => {
        const reference = data.quantum.quantum_filters.refLocation
        reference.id.FRA = {en:'Unknown territory',fr:'Unknown territory'}
        reference.en['Unknown territory'] = reference.en.France
        reference.fr['Unknown territory'] = reference.fr.France
        delete reference.en.France
        delete reference.fr.France
      }).replace(/France(\s*<\/span>)/g, 'Unknown territory$1')
    }
    return page
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /country-identity/)
})

test('the real default source transport cannot retry HTTP GETs past a one-request caller budget', async () => {
  const previous = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, init) => {
    requests.push({url:String(url),redirect:init.redirect})
    return {ok:false,status:503,url:String(url),headers:new Headers(),text:async () => 'temporary unavailable'}
  }
  try {
    await assert.rejects(createSocieteGeneraleScraper().run({maxRequests:1}))
    assert.equal(requests.length, 1)
    assert.ok(requests.every(request => request.redirect === 'error'))
  } finally { globalThis.fetch = previous }
})

function mutateSettings(html, change) {
  return html.replace(/(<script\b[^>]*data-drupal-selector=["']drupal-settings-json["'][^>]*>)([\s\S]*?)(<\/script>)/,
    (_, start, body, end) => { const data = JSON.parse(body); change(data); return start + JSON.stringify(data) + end })
}

test('same-count closing model changes cannot retain complete evidence', async () => {
  // Adversarial mutation of genuine native model: cardinalities stay constant while a location changes.
  let englishReads = 0
  const jobs = await createSocieteGeneraleScraper().run({ fetchText: async url => {
    const page = await nativeReader(url)
    if (url === CAREER_PAGE_URL && ++englishReads > 1) page.html = page.html.replace('"260009KF":{"city":"IND_A37"', '"260009KF":{"city":"IND_A38"')
    return page
  } })
  assert.equal(jobs.length, 214)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('closing criteria retain complete quoted employer attributes, including apostrophes', async () => {
  // Adversarial attribute-only mutation: a quote inside a double-quoted value
  // must not hide a later change from the closing comparison.
  let englishReads = 0
  const jobs = await createSocieteGeneraleScraper().run({ fetchText: async url => {
    const page = await nativeReader(url)
    if (url === CAREER_PAGE_URL) page.html = page.html.replace('data-offer-term-entity="SG Global Solution Centre"',
      `data-offer-term-entity="SG Global's ${++englishReads > 1 ? 'changed' : 'original'} entity"`)
    return page
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('one unresolved native country blocks inventory completion even when all known India details load', async () => {
  // Adversarial mutation: an omitted country cannot be assumed to exclude India.
  const jobs = await createSocieteGeneraleScraper().run({ fetchText: async url => {
    const page = await nativeReader(url)
    if (url === CAREER_PAGE_URL || url === frenchURL) page.html = page.html.replace('"country":"FRA"', '"country":""')
    return page
  } })
  assert.equal(jobs.length, 214)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /country/)
})

test('an unavailable French inventory stays incomplete and cannot hide the French-only India ref', async () => {
  const jobs = await createSocieteGeneraleScraper().run({ fetchText: async url => url === frenchURL
    ? { status: 404, url, html: '<html>Unavailable</html>' } : nativeReader(url) })
  assert.equal(jobs.length, 213)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /French|fr|response|missing/i)
})

test('role-owned identity, country, employer and complete sections must agree before a role is returned', async t => {
  const url = 'https://careers.societegenerale.com/en/job-offers/senior-analyst-260009KF-en'
  const mutations = [
    ['identity', html => html.replace('"value":"260009KF"', '"value":"26000FAKE"')],
    ['country', html => html.replace('"addressCountry":"India"', '"addressCountry":"France"')],
    ['employer', html => html.replace('"sameAs":"https://careers.societegenerale.com"', '"sameAs":"https://example.invalid"')],
    ['sections', html => html.replace(/<section\b[^>]*id="job-detail-profile"[^>]*>[\s\S]*?<\/section>/, '')],
  ]
  for (const [kind, mutate] of mutations) await t.test(kind, async () => {
    // Only an intentionally corrupted response differs from the genuine receipt.
    const jobs = await createSocieteGeneraleScraper({ maxJobs: 1 }).run({ fetchText: async requested => {
      const page = await nativeReader(requested)
      if (requested === url) page.html = mutate(page.html)
      return page
    } })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.match(readInventoryEvidence(jobs).reason, /detail/)
  })
})

test('explicit zero result and request budgets cannot be interpreted as unlimited inventory', async () => {
  let reads = 0
  const zero = await createSocieteGeneraleScraper().run({ maxJobs: 0, fetchText: async url => { reads += 1; return nativeReader(url) } })
  assert.equal(zero.length, 0)
  assert.equal(reads, 0)
  assert.equal(readInventoryEvidence(zero).listingComplete, false)
  const bounded = await createSocieteGeneraleScraper().run({ maxRequests: 3, fetchText: nativeReader })
  assert.equal(bounded.length, 1)
  assert.equal(bounded.sourceAudit.requests, 3)
  assert.equal(readInventoryEvidence(bounded).listingComplete, false)
  assert.match(readInventoryEvidence(bounded).reason, /budget/)
})

test('an ignored detail reader cannot schedule closing reads after caller cancellation', async () => {
  const controller = new AbortController()
  const reason = Object.freeze({ code: 'stop-detail' })
  let release
  let started
  const detailStarted = new Promise(resolve => { started = resolve })
  const requests = []
  const run = settle(createSocieteGeneraleScraper({ maxJobs: 1 }).run({ signal: controller.signal, fetchText: async url => {
    requests.push(url)
    if (url === CAREER_PAGE_URL || url === frenchURL) return nativeReader(url)
    started()
    return new Promise(resolve => { release = () => nativeReader(url).then(resolve) })
  } }))
  await detailStarted
  controller.abort(reason)
  const result = await Promise.race([run, new Promise(resolve => setTimeout(() => resolve({ status: 'pending' }), 100))])
  await release()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(result.status, 'rejected')
  assert.equal(result.reason, reason)
  assert.equal(requests.length, 3)
})
