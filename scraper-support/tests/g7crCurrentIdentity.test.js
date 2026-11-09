import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { CAREERS_URL, run } from '../../scraper/g7cr/script.js'

const origin = 'https://noventiqai.com'
const fixture = (name) => readFile(new URL('./fixtures/g7cr/' + name, import.meta.url), 'utf8')
const [homepage, about, privacy, listing, sitemap, detailsJson] = await Promise.all([
  'current-homepage.html', 'current-about.html', 'current-privacy.html',
  'current-listing.html', 'current-sitemap.xml', 'current-details.json',
].map(fixture))
const details = JSON.parse(detailsJson)
const firstJobUrl = Object.keys(details)[0]
const pagesForCurrentEmployer = () => new Map([
  [origin + '/', homepage], [origin + '/about/', about],
  [origin + '/privacy-policy/', privacy], [origin + '/job-listings/', listing],
  [origin + '/careers-sitemap.xml', sitemap], ...Object.entries(details),
])
const fetchPages = (pages, requested = []) => async (url) => {
  requested.push(url)
  if (url === CAREERS_URL) throw new Error('HTTP 403 for ' + url)
  if (url === 'https://g7cr.com/') throw new Error('certificate has expired: CERT_HAS_EXPIRED')
  if (pages.has(url)) return pages.get(url)
  throw new Error('Unexpected URL: ' + url)
}

test('current Noventiq authority verifies all seven native G7CR roles without the expired alias', async () => {
  const requested = []
  const jobs = await run({ fetchText: fetchPages(pagesForCurrentEmployer(), requested), now: () => '2026-10-09T00:00:00.000Z' })
  assert.equal(jobs.length, 7)
  assert.deepEqual(jobs.map((job) => job.sourceUrl), Object.keys(details))
  assert.deepEqual(jobs.map((job) => job.city).sort(), ['Bangalore', 'Bangalore', 'Bangalore', 'Bangalore', 'Bangalore', 'Bangalore', 'Mumbai'])
  assert.ok(jobs.every((job) => job.company === 'G7 CR Technologies' && job.country === 'India' && job.jobDescription.length > 1000))
  assert.ok(jobs.every((job) => job.applyUrl === job.sourceUrl + '#career_detail' && job.scrapedAt === '2026-10-09T00:00:00.000Z'))
  assert.ok(!requested.includes('https://g7cr.com/'))
  assert.deepEqual(requested.slice(1, 4), [origin + '/', origin + '/about/', origin + '/privacy-policy/'])
})

const invalidIdentityCases = [
  ['homepage canonical belongs to another employer', origin + '/', (html) => html.replace('href="https://noventiqai.com/"', 'href="https://unrelated.example/"')],
  ['homepage brand is missing', origin + '/', (html) => html.replace(/Noventiq Global AI Solutions/g, 'Another Company')],
  ['homepage social link is a lookalike company', origin + '/', (html) => html.replace(/g7cr-technologies/g, 'g7cr-technologies-unrelated')],
  ['About canonical belongs to another employer', origin + '/about/', (html) => html.replace('href="https://noventiqai.com/about/"', 'href="https://unrelated.example/about/"')],
  ['About no longer confirms the G7CR relationship', origin + '/about/', (html) => html.replace('G7 CR Technologies is proudly part of Noventiq Global', 'Another Company is part of Noventiq Global')],
  ['privacy canonical belongs to another employer', origin + '/privacy-policy/', (html) => html.replace('href="https://noventiqai.com/privacy-policy/"', 'href="https://unrelated.example/privacy-policy/"')],
  ['privacy legal employer is missing', origin + '/privacy-policy/', (html) => html.replace(/NOVENTIQ GLOBAL AI SOLUTIONS PVT\. LTD\./g, 'Another Company')],
  ['privacy no longer confirms G7CR personnel', origin + '/privacy-policy/', (html) => html.replace(/G7CR TECHNOLOGIES PVT\.LTD\./g, 'Another Company')],
]
for (const [name, url, change] of invalidIdentityCases) {
  test('G7CR fails closed when ' + name, async () => {
    const pages = pagesForCurrentEmployer()
    pages.set(url, change(pages.get(url)))
    await assert.rejects(run({ fetchText: fetchPages(pages) }), /current official employer identity/)
  })
}

test('current G7CR sitemap must still cover the entire published board', async () => {
  const pages = pagesForCurrentEmployer()
  pages.set(origin + '/careers-sitemap.xml', sitemap.replace(/<url>[\s\S]*?<\/url>/i, ''))
  await assert.rejects(run({ fetchText: fetchPages(pages) }), /sitemap and listings disagree/)
})

const invalidDetailCases = [
  ['unrelated employer', (html) => html.replace(/\bG7\b/gi, 'Another Company')],
  ['unknown location', (html) => html.replace('Location: Bangalore', 'Location: Undisclosed')],
  ['foreign location', (html) => html.replace('Location: Bangalore', 'Location: London, United Kingdom')],
  ['missing native apply form', (html) => html.replace(/id="career_detail"/g, 'id="other_form"')],
]
for (const [name, change] of invalidDetailCases) {
  test('current G7CR details reject ' + name, async () => {
    const pages = pagesForCurrentEmployer()
    pages.set(firstJobUrl, change(pages.get(firstJobUrl)))
    await assert.rejects(run({ fetchText: fetchPages(pages) }), /job detail no longer confirms/)
  })
}

test('caller job cap retains full board and sitemap verification before selecting details', async () => {
  const requested = []
  const jobs = await run({ maxJobs: 2, fetchText: fetchPages(pagesForCurrentEmployer(), requested) })
  assert.equal(jobs.length, 2)
  assert.ok(requested.includes(origin + '/careers-sitemap.xml'))
  assert.deepEqual(requested.filter((url) => url.includes('/job-details/')), Object.keys(details).slice(0, 2))
})
