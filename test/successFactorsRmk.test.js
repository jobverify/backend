import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { createSuccessFactorsRmkScraper, parseRmkListing, parseRmkDetail } from '../scraper-support/shared/successFactorsRmk.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const config = { source: 'exampleemployer', companyName: 'Example Employer', origin: 'https://careers.example.com', companyToken: 'C0013041173P' }
const listing = (ids = ['100'], { start = 1, total = ids.length, country = 'IN', token = config.companyToken } = {}) => `<script>var x={"ssoCompanyId":'${token}'}</script><span class="paginationLabel">Results <b>${start} – ${start + ids.length - 1}</b> of <b>${total}</b></span><table>${ids.map(id => `<tr class="data-row"><td><a class="jobTitle-link" href="/job/Mumbai-Engineer/${id}/">Engineer</a><a class="jobTitle-link" href="/job/Mumbai-Engineer/${id}/">Engineer</a></td><td><span class="jobLocation">Mumbai, MH, ${country}</span></td></tr>`).join('')}</table>${start + ids.length - 1 < total ? `<a href="?startrow=${start + ids.length - 1}">Next</a>` : ''}`
const detail = (id = '100', country = 'IN', description = '<p>Build <span>production</span> software services.</p>') => `<script>var x={"ssoCompanyId":'${config.companyToken}'}</script><span itemprop="title">Engineer</span><meta itemprop="addressCountry" content="${country}"><meta itemprop="addressLocality" content="Mumbai"><meta itemprop="datePosted" content="Tue Oct 20 07:00:00 UTC 2026"><meta itemprop="validThrough" content="Wed Oct 21 18:30:00 UTC 2026"><span class="jobGeoLocation">Mumbai, MH, ${country}</span><span itemprop="description">${description}</span><a href="/talentcommunity/apply/${id}/?locale=en_GB">Apply</a>`

test('native listing reconciles ranges and duplicate responsive anchors without duplicating jobs', () => {
  const page = parseRmkListing(listing(['100', '101']), config)
  assert.equal(page.total, 2)
  assert.equal(page.jobs.length, 2)
  assert.equal(page.jobs[0].country, 'India')
  assert.equal(page.nextUrl, null)
  assert.equal(parseRmkListing(listing(['100'], { country: 'IN, 400069' }), config).jobs[0].country, 'India')
})

test('listing rejects missing or inconsistent totals, wrong tenant, duplicate IDs and unknown countries', () => {
  for (const html of [listing().replace(/<span class="paginationLabel">.*?<\/span>/, ''), listing(['100'], { total: 0 }), listing(['100'], { token: 'different' }), listing(['100', '100']), listing(['100'], { country: 'Unknown' }), listing().replace('/job/Mumbai-Engineer/100/', 'https://evil.example/job/Mumbai-Engineer/100/')]) {
    assert.throws(() => parseRmkListing(html, config))
  }
})

test('native company token must come from active executable inline scripts without conflicts', () => {
  const fake = '<script>var stale={"ssoCompanyId":"C0013041173P"}</script>'
  const wrong = listing(['100'], { token: 'wrongActiveTenant' })
  for (const html of [
    `<template>${fake}</template>${wrong}`, `${fake}${wrong}`,
    fake.replace('<script>', '<script type="application/json">') + wrong,
    fake.replace('<script>', '<script src="/external.js">') + wrong,
    '<script>/* "ssoCompanyId":"C0013041173P" */</script>' + wrong,
  ]) assert.throws(() => parseRmkListing(html, config), /token/i)
  const missing = listing().replace(/<script>[\s\S]*?<\/script>/, '')
  for (const prefix of [fake.replace('<script>', '<script src="">'), fake.replace('<script>', '<script nomodule>'), '<script>var quoted=\'"ssoCompanyId":"C0013041173P"\';</script>']) {
    assert.throws(() => parseRmkListing(prefix + missing, config), /token/i)
  }
})

test('native detail retains complete nested content, exact apply identity and native expiry', () => {
  const row = parseRmkListing(listing(), config).jobs[0]
  const job = parseRmkDetail(detail(), row, config)
  assert.match(job.jobDescription, /production.*software/)
  assert.equal(job.applyUrl, `${config.origin}/talentcommunity/apply/100/?locale=en_GB`)
  assert.equal(job.sourceClosingDateIsExact, true)
  assert.equal(job.closingDate, '2026-10-21T18:30:00.000Z')
  assert.equal(job.sourceDetailComplete, true)
  for (const html of [detail('999'), detail('100', 'US'), detail().replace('>Engineer<', '>Manager<'), detail().replace('Mumbai, MH, IN', 'Bengaluru, KA, IN')]) assert.throws(() => parseRmkDetail(html, row, config))
  assert.equal(parseRmkDetail(detail('100', 'IN', ''), row, config).sourceDetailComplete, false)
  assert.notEqual(parseRmkDetail(detail().replace('Wed Oct 21 18:30:00 UTC 2026', '2026-10-21'), row, config).sourceClosingDateIsExact, true)
})

test('commented or inert content cannot repair missing native descriptions', () => {
  const row = parseRmkListing(listing(), config).jobs[0]
  for (const prefix of ['<!-- <span itemprop="description">Invented description text.</span> -->', '<script>const x=\'<span itemprop="description">Invented description text.</span>\'</script>', '<template><span itemprop="description">Invented description text.</span></template>', ...['noscript', 'xmp', 'iframe', 'noembed', 'noframes'].map(tag => `<${tag}><span itemprop="description">Invented description text.</span></${tag}>`)]) {
    assert.equal(parseRmkDetail(prefix + detail('100', 'IN', ''), row, config).sourceDetailComplete, false)
  }
  assert.throws(() => parseRmkDetail('<plaintext><span itemprop="description">Invented description text.</span>' + detail('100', 'IN', ''), row, config))
  assert.equal(parseRmkDetail('<template>before</template>' + detail() + '<template>after</template>', row, config).sourceDetailComplete, true)
})

test('required native attributes cannot be supplied by data attributes or quoted attribute values', () => {
  const row = parseRmkListing(listing(), config).jobs[0]
  for (const html of [detail().replaceAll('href=', 'data-href='), detail().replaceAll('itemprop=', 'data-itemprop='), detail().replace('href="/talentcommunity', 'data-note=\'href="/talentcommunity').replace('/?locale=en_GB">Apply', '/?locale=en_GB"\'>Apply')]) assert.throws(() => parseRmkDetail(html, row, config))
})

test('continuation cannot silently change native keyword or location filters', async () => {
  for (const query of ['q=changed-scope', 'locationsearch=selected-subset', 'optionsFacetsDD_country=US', 'locale=en_US']) {
    await assert.rejects(createSuccessFactorsRmkScraper(config).run({ fetchText: async url => url.includes('/job/') ? detail(new URL(url).pathname.split('/').at(-2)) : url.includes('startrow=1') ? listing(['101'], { start: 2, total: 2 }) : listing(['100'], { total: 2 }).replace('?startrow=1', `?${query}&amp;startrow=1`) }))
  }
})

test('full pagination reconciles native totals and keeps global versus India scope separate', async () => {
  const urls = []
  const jobs = await createSuccessFactorsRmkScraper(config).run({ fetchText: async url => {
    urls.push(url)
    if (url.includes('/job/')) return detail()
    return url.includes('startrow=1') ? listing(['101'], { start: 2, total: 2, country: 'US' }) : listing(['100'], { total: 2 })
  } })
  assert.equal(jobs.length, 1)
  assert.equal(urls.length, 3)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('changed total and repeated IDs across pages fail closed', async () => {
  for (const second of [listing(['101'], { start: 2, total: 3 }), listing(['100'], { start: 2, total: 2 })]) {
    await assert.rejects(createSuccessFactorsRmkScraper(config).run({ fetchText: async url => url.includes('startrow=1') ? second : listing(['100'], { total: 2 }) }))
  }
})

test('empty native description preserves partial row and blocks lifecycle completeness', async () => {
  const jobs = await createSuccessFactorsRmkScraper(config).run({ fetchText: async url => url.includes('/job/') ? detail('100', 'IN', '') : listing() })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('caller abort and native HTTP errors never return a successful empty board', async () => {
  const signal = AbortSignal.abort(new Error('caller stop'))
  await assert.rejects(createSuccessFactorsRmkScraper(config).run({ signal, fetchText: async () => listing() }), /caller stop/)
  await assert.rejects(createSuccessFactorsRmkScraper(config).run({ fetchText: async () => { throw new Error('HTTP 403') } }), /403/)
})

test('explicit native locale search is preserved instead of certifying a different default board', async () => {
  let firstUrl
  await createSuccessFactorsRmkScraper({ ...config, searchUrl: `${config.origin}/search?locale=en_GB` }).run({ fetchText: async url => {
    firstUrl ??= url
    return url.includes('/job/') ? detail() : listing()
  } })
  assert.equal(firstUrl, `${config.origin}/search?locale=en_GB`)
})

test('known additional employer surface prevents company completeness and lifecycle cleanup', async () => {
  const jobs = await createSuccessFactorsRmkScraper({ ...config, sourceScopeComplete: false }).run({ fetchText: async url => url.includes('/job/') ? detail() : listing() })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})

test('grouped locations require every native detail address, including India behind foreign primary', async () => {
  const grouped = listing(['100'], { country: 'US' }).replace('Mumbai, MH, US', 'Boston, MA, US <small>+1 more…</small>')
  const row = parseRmkListing(grouped, config).jobs[0]
  const html = detail().replace('Mumbai, MH, IN', 'Boston, MA, US</span><span class="jobGeoLocation"><span class="icon"></span>Mumbai, MH, IN')
  const job = parseRmkDetail(html, row, config)
  assert.equal(job.country, 'India')
  assert.equal(job.location, 'Mumbai, MH, IN')
  assert.throws(() => parseRmkDetail(detail().replace('Mumbai, MH, IN', 'Boston, MA, US'), row, config), /location/)
  const jobs = await createSuccessFactorsRmkScraper(config).run({ fetchText: async url => url.includes('/job/') ? html : grouped })
  assert.equal(jobs.length, 1)
})

test('grouped native address count includes repeated explicit country-only addresses', () => {
  const row = parseRmkListing(listing().replace('Mumbai, MH, IN', 'Mumbai, MH, IN <small>+2 more…</small>'), config).jobs[0]
  const html = detail().replace('Mumbai, MH, IN', 'Mumbai, MH, IN</span><span class="jobGeoLocation">IN</span><span class="jobGeoLocation">IN')
  assert.equal(parseRmkDetail(html, row, config).country, 'India')
  assert.throws(() => parseRmkDetail(html.replace(/<span class="jobGeoLocation">IN<\/span>/, ''), row, config))
})

test('fresh actual Astellas HTML uses native totals and exact role identity', () => {
  for (const [source, origin, companyToken, total] of [['astellaspharma', 'https://careers.astellas.com', 'astellasT5', 59]]) {
    const capture = kind => JSON.parse(readFileSync(new URL(`./fixtures/successFactorsRmk/${source}-${kind}-http.json`, import.meta.url)))
    const cfg = { ...config, source, origin, companyToken }
    const page = parseRmkListing(capture('native-session').body, cfg)
    assert.equal(page.total, total)
    assert.equal(page.jobs.length, 25)
    const native = capture('sample-detail')
    const row = page.jobs.find(job => job.sourceUrl === native.requestedURL)
    assert.ok(row)
    const job = parseRmkDetail(native.body, row, cfg)
    assert.ok(job.jobDescription.length > 100)
    assert.equal(job.sourceDetailComplete, true)
  }
})

test('Astellas English-GB role uses its native h1 title and India address', () => {
  const cfg = { ...config, origin: 'https://careers.astellas.com', companyToken: 'astellasT5' }
  const capture = file => JSON.parse(readFileSync(new URL(`./fixtures/successFactorsRmk/${file}`, import.meta.url)))
  const page = parseRmkListing(capture('astellaspharma-en_GB-search-http.json').body, cfg)
  const row = page.jobs.find(job => job.jobId === '1433303100')
  const job = parseRmkDetail(capture('astellaspharma-capture-001/http-0003.json').body, row, cfg)
  assert.equal(job.country, 'India')
  assert.match(job.title, /Government Affairs/)
  assert.equal(job.sourceDetailComplete, true)
})


test('RMK source wrappers replace historical Workday sentinels without adding company sources', () => {
  const catalog = getScraperCatalog()
  for (const source of ['astellaspharma']) {
    const matches = catalog.filter(provider => provider.source === source)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].atsPlatform, 'successfactors-rmk')
    assert.ok(matches[0].modulePath.replaceAll('\\', '/').endsWith(`/scraper/${source}/script.js`))
    assert.equal(matches[0].verifiedIndiaJobCount, null)
  }
})
