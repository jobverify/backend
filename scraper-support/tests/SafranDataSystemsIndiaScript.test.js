import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/safrandatasystems/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const captured = JSON.parse(readFileSync(new URL('./fixtures/safrandatasystems-india/native-group-india.json', import.meta.url), 'utf8'))
const expectedIds = [...captured.verifiedSdsIndiaIds].sort()
const indiaUrl = captured.publishedSearchUrl
const targetUrl = Object.keys(captured.details).find((url) => url.includes('_186333.'))
const otherUrl = Object.keys(captured.details).find((url) => url.includes('_179392.'))
const fetcher = (mutate = (body) => body, calls = []) => async (url, options) => {
  calls.push({ url, signal: options?.signal })
  const parsed = new URL(url)
  const body = parsed.pathname.endsWith('liste-offres.aspx')
    ? captured.pages[Number(parsed.searchParams.get('page') || 1) - 1] : captured.details[url]
  assert.ok(body, 'Unknown fixture URL ' + url)
  return mutate(body, url, options)
}
test('default Safran source audits all176 native India cards and publishes only six exact SDS India employers as partial', async () => {
  const calls = []
  const jobs = await source.run({ fetchText: fetcher(undefined, calls) })
  assert.deepEqual(jobs.map((job) => job.jobId).sort(), expectedIds)
  assert.ok(jobs.every((job) => job.country === 'India' && job.city === null
    && job.sourceListingComplete === false && job.jobDescription.length > 200
    && job.sourceUrl === job.applyUrl && job.employerLegalName.startsWith('Safran Data Systems India')))
  assert.equal(calls.filter((call) => /_([0-9]+)\.aspx$/.test(call.url)).length, 176)
  const listingCalls = calls.filter((call) => call.url.includes('liste-offres.aspx'))
  assert.equal(listingCalls.length, 10)
  assert.ok(listingCalls.every((call) => new URL(call.url).searchParams.get('facet_Country') === '81'))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /group India.*176.*6.*global.*unknown/i)
})
test('India search URL preserves the employer-published country facet on every page', () => {
  assert.equal(source.buildIndiaSearchUrl(1), indiaUrl)
  const page = new URL(source.buildIndiaSearchUrl(9))
  assert.equal(page.searchParams.get('page'), '9')
  assert.equal(page.searchParams.get('lcid'), '1036')
  assert.equal(page.searchParams.get('facet_Country'), '81')
})
test('country-search guard rejects changed country, page number, total, and malformed cards', async () => {
  for (const mutation of [
    (body, url) => url === indiaUrl ? body.replace('Asie-->Inde', 'Europe-->France') : body,
    (body, url) => url.includes('page=2') ? body.replace('page 2)', 'page 1)') : body,
    (body, url) => url.includes('page=2') ? body.replace('176 offres', '177 offres') : body,
    (body, url) => url.includes('page=9') ? body.replace(/<li class="ts-offer-list-item offerlist-item [\s\S]*?<\/ul>/, '') : body,
    (body, url) => url.includes('page=2') ? captured.pages[0] : body,
  ]) await assert.rejects(source.run({ fetchText: fetcher(mutation) }), /Safran.*(?:country|listing|count|page|duplicate|inventory)/i)
})
test('SDS membership uses the exact native employer, rather than a description mention', async () => {
  const jobs = await source.run({ fetchText: fetcher((body, url) => url === otherUrl
    ? body.replace('</body>', '<p>Work with Safran Data Systems India (Captronic)</p></body>') : body) })
  assert.deepEqual(jobs.map((job) => job.jobId).sort(), expectedIds)
})
test('an unverified SDS India legal-employer alias is a contract failure', async () => {
  await assert.rejects(source.run({ fetchText: fetcher((body, url) => url === targetUrl
    ? body.replace(/Safran Data Systems India \(Captronic\)/g, 'Safran Data Systems India Unknown Division') : body) }), /Safran.*employer/i)
})
test('matching SDS details require country, title, requisition, native application action and full body', async () => {
  for (const mutate of [
    (body) => body.replace('Asia, India', 'Europe, France'),
    (body) => body.replace('2026-186333', '2026-186334'),
    (body) => body.replace(/id="fldjobdescription_jobtitle">[^<]+/, 'id="fldjobdescription_jobtitle">Different role'),
    (body) => body.replace('value="Je postule à cette offre"', 'value="Closed"'),
    (body) => body.replace(/<p id="fldjobdescription_description1">[\s\S]*?<\/p>/, '<p id="fldjobdescription_description1">Apply here</p>'),
    (body) => body.replace(/<p id="fldlocation_joblocation">[\s\S]*?<\/p>/, ''),
  ]) await assert.rejects(source.run({ fetchText: fetcher((body, url) => url === targetUrl ? mutate(body) : body) }), /Safran.*detail/i)
})
test('unavailable unrelated details retain the six validated jobs and disclose partial audit bounds', async () => {
  const jobs = await source.run({ fetchText: fetcher((body, url) => {
    if (url === otherUrl) throw new Error('HTTP 403 for ' + url)
    return body
  }) })
  assert.equal(jobs.length, 6)
  assert.ok(jobs.every((job) => job.sourceListingComplete === false))
  assert.match(readInventoryEvidence(jobs).reason, /1.*unavailable/i)
})
test('unavailable SDS detail is not published or counted as definitely foreign', async () => {
  const jobs = await source.run({ fetchText: fetcher((body, url) => {
    if (url === targetUrl) throw new DOMException('Request timed out', 'TimeoutError')
    return body
  }) })
  assert.equal(jobs.length, 5)
  assert.ok(!jobs.some((job) => job.jobId === '186333'))
  assert.match(readInventoryEvidence(jobs).reason, /1.*unavailable/i)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
test('zero matching SDS jobs remains a coverage gap and never verified empty', async () => {
  const jobs = await source.run({ fetchText: fetcher((body) => body.replace(/Safran Data Systems India(?:\s+- Hoodi|\s+- West Shenoy Nagar)?\s*\(Captronic\)/g, 'Another Native Employer')) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
test('listing is rechecked after detail audit and changes to consumed identity fields abort publication', async () => {
  let firstPageReads = 0
  await assert.rejects(source.run({ fetchText: fetcher((body, url) => {
    if (url === indiaUrl && ++firstPageReads === 2) return body.replace('Pilotage maintenance', 'Changed native department')
    return body
  }) }), /Safran.*snapshot/i)
})
test('caller cancellation aborts traversal rather than becoming an unavailable partial detail', async () => {
  const controller = new AbortController()
  let details = 0
  const failure = new Error('caller cancelled')
  await assert.rejects(source.run({ signal: controller.signal, fetchText: fetcher((body, url, options) => {
    assert.equal(options.signal, controller.signal)
    if (url.includes('_') && ++details === 2) controller.abort(failure)
    return body
  }) }), /caller cancelled/)
  assert.ok(details < 176)
})
test('detail concurrency is bounded and pre-aborted callers perform no fetches', async () => {
  let active = 0
  let highest = 0
  const base = fetcher()
  await source.run({ detailConcurrency: 3, fetchText: async (url, options) => {
    if (url.includes('liste-offres.aspx')) return base(url, options)
    active += 1
    highest = Math.max(highest, active)
    await new Promise((resolve) => setTimeout(resolve, 1))
    active -= 1
    return base(url, options)
  } })
  assert.equal(highest, 3)
  const controller = new AbortController()
  controller.abort(new Error('pre-aborted'))
  let reads = 0
  await assert.rejects(source.run({ signal: controller.signal, fetchText: async () => { reads += 1 } }), /pre-aborted/)
  assert.equal(reads, 0)
})

test('country scan rejects a duplicate identity even when both page headers and local cardinality are valid', async () => {
  const firstId = source.extractJobCards(captured.pages[0])[0].jobId
  const secondPageId = source.extractJobCards(captured.pages[1])[0].jobId
  await assert.rejects(source.run({fetchText: fetcher((body, url) => url.includes('page=2')
    ? body.replaceAll(secondPageId, firstId) : body)}), /Safran.*duplicate/i)
})

test('an explicit native zero group-country surface still cannot certify the company India inventory', async () => {
  const body = '<title>Safran - Résultat de votre recherche (0 offres, page 1) / Pays : Asie-->Inde</title>'
    + '<span id="ctl00_ctl00_corpsRoot_corps_Pagination_TotalOffers" class="gras">0 offre(s)</span>'
    + '<a href="../handlers/offerRss.ashx?lcid=1036&amp;Rss_Country=81">Flux RSS</a>'
  const jobs = await source.run({fetchText:async()=>body})
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('native workplace conflicts in other employers remain hard failures instead of exclusions', async () => {
  await assert.rejects(source.run({fetchText:fetcher((body,url)=>url===otherUrl
    ? body.replace('Asia, India','Europe, France') : body)}), /Safran.*country.*conflict/i)
})

test('native fetch refuses an off-authority redirect while retaining strict TLS defaults', async () => {
  const fetchText = source.createDefaultFetchText({fetchImpl:async()=>({
    ok:true,url:'https://another-employer.example/offre-de-emploi/emploi-role_1.aspx',
    text:async()=>captured.pages[0],
  })})
  await assert.rejects(fetchText(indiaUrl), /Safran.*redirect.*authority/i)
})

test('SDS native address cannot contradict its workplace-country hierarchy', async () => {
  for (const address of ['Les Ulis, France', 'Seattle, United States', 'London, United Kingdom']) {
    await assert.rejects(source.run({fetchText:fetcher((body,url)=>url===targetUrl
      ? body.replace(/<p id="fldlocation_joblocation">[\s\S]*?<\/p>/,
        '<p id="fldlocation_joblocation">' + address + '</p>') : body)}),
    /Safran.*(?:location|workplace|country).*conflict/i)
  }
})
