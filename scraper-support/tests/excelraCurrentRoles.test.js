import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createExcelraKnowledgeSolutionsScraper, extractVisibleJobCards, extractWordpressRenderedContent } from '../../scraper/excelraknowledgesolutions/script.js'

const payload = JSON.parse(readFileSync(new URL('./fixtures/excelraknowledgesolutions/current-openings.json', import.meta.url), 'utf8'))
const html = payload[0].content.rendered
const rendered = readFileSync(new URL('./fixtures/excelraknowledgesolutions/darwinbox-openings.html', import.meta.url), 'utf8')
const shortcodePayload = JSON.parse(readFileSync(new URL('./fixtures/excelraknowledgesolutions/shortcode-openings.json', import.meta.url), 'utf8'))
const jobListings = JSON.parse(readFileSync(new URL('./fixtures/excelraknowledgesolutions/darwinbox-job-listings.json', import.meta.url), 'utf8'))
const run = (page = html) => createExcelraKnowledgeSolutionsScraper().run({ fetchJson: async () => [{ ...payload[0], content: { rendered: page } }], fetchText: () => assert.fail('Healthy API must not fall back') })

test('Excelra accounts for all eleven current cards and returns seven explicit India roles with real application URLs', async () => {
  const cards = extractVisibleJobCards(html)
  assert.equal(cards.length, 11)
  assert.equal(cards.filter(job => job.country === 'United States').length, 4)
  const jobs = await run()
  assert.equal(jobs.length, 7)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 7)
  assert.ok(jobs.every(job => job.country === 'India' && job.applyUrl === 'https://excelra.darwinbox.in/ms/candidatev2/main/careers/allJobs'))
  assert.ok(jobs.every(job => job.sourceUrl === 'https://www.excelra.com/careers/'))
  assert.equal(jobs.find(job => job.title === 'Sr Gen AI Engineer').experienceRequired, null)
  assert.equal(jobs.find(job => job.title === 'Software Developer').experienceRequired, '5 – 10 Years')
})

test('Excelra detects missing cards fields and never manufactures an undefined apply link', async () => {
  for (const page of [
    html.replace('Scientific Informatics Consultant</h4>', '</h4>'),
    html.replace('<strong> Massachusetts, United States</strong>', ''),
    html.replace('url=&#8221;https://excelra.darwinbox.in/ms/candidatev2/main/careers/allJobs&#8221;', 'url=&#8221;https://unrelated.example/apply&#8221;'),
  ]) await assert.rejects(run(page), /incomplete|card|application|location/i)
})

test('Excelra rejects unknown geography without publishing a partial India snapshot', async () => {
  await assert.rejects(run(html.replace('Hyderabad, India', 'Remote')), /location|scope/i)
  await assert.rejects(run(html.replace('Hyderabad, India', 'Indianapolis, IN')), /location|scope/i)
})

test('Excelra recognizes Bengaluru, Karnataka as a scoped India location', async () => {
  const jobs = await run(html.replace('Hyderabad, India', 'Bengaluru, Karnataka'))
  assert.equal(jobs.length, 7)
  assert.ok(jobs.some(job => job.location === 'Bengaluru, Karnataka' && job.country === 'India' && job.city === 'Bengaluru'))
})

test('Excelra requires an identified careers WordPress record and does not accept arbitrary API pages', () => {
  assert.equal(extractWordpressRenderedContent([{ ...payload[0], slug: 'contact' }]), '')
  assert.equal(extractWordpressRenderedContent([{ ...payload[0], link: 'https://unrelated.example/careers/' }]), '')
})

test('Excelra detects card class drift independently of the parser selector', async () => {
  await assert.rejects(run(html.replace('display-2 m-0 p-0 custom-theme-color', 'new-job-title')), /incomplete|card/i)
})

test('Excelra resolves the new WordPress shortcode through the rendered first-party page', async () => {
  const jobs = await createExcelraKnowledgeSolutionsScraper().run({
    fetchJson: async () => shortcodePayload,
    fetchText: async (url) => {
      assert.equal(url, 'https://www.excelra.com/careers/')
      return rendered
    },
  })
  assert.equal(jobs.length, 8)
  assert.deepEqual(jobs.map(job => job.title).sort(), [
    'Architect _ AI', 'CMC Data/Solutions Engineer', 'Computational Biology', 'Data Engineer',
    'Growth Analyst', 'Growth Manager', 'Manager', 'Senior Software Tester-I',
  ].sort())
  assert.ok(jobs.every(job => job.country === 'India' && !job.applicationUrlIsGeneric && job.sourceUrl === job.applyUrl))
  const manager = jobs.find(job => job.title === 'Manager')
  assert.equal(manager.applyUrl, 'https://excelra.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6abe17c549d2d')
  assert.equal(manager.jobId, 'a6abe17c549d2d')
  assert.equal(manager.experienceRequired, '3–5 years')
})

test('Excelra counts all fourteen rendered roles before excluding six explicit foreign jobs', () => {
  const cards = extractVisibleJobCards(rendered)
  assert.equal(cards.length, 14)
  assert.equal(cards.filter(job => job.country === 'United States').length, 5)
  assert.equal(cards.filter(job => job.country === 'Belgium').length, 1)
  assert.equal(new Set(cards.map(job => job.jobId)).size, 14)
})

test('Excelra rejects shortcode snapshots whose rendered cards are missing or incomplete', async () => {
  for (const page of [
    rendered.replace('class="dbx-job-card"', 'class="unrecognized-card"'),
    rendered.replace('class="dbx-job-title"', 'class="unrecognized-title"'),
    rendered.replace('14 open positions', '15 open positions'),
    rendered.replace('Location:</strong>&nbsp;Cambridge, United States', 'Location:</strong>&nbsp;Remote'),
    rendered.replace('a6abe17c549d2d', 'a6a96be6d8dd3c'),
    rendered.replace('https://excelra.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6abe17c549d2d', 'https://unrelated.example/apply'),
  ]) {
    await assert.rejects(createExcelraKnowledgeSolutionsScraper().run({
      fetchJson: async () => shortcodePayload,
      fetchText: async () => page,
    }), /incomplete|scope|duplicate|application|card/i)
  }
})

test('Excelra propagates rendered-page fetch failures instead of using disabled historical cards', async () => {
  await assert.rejects(createExcelraKnowledgeSolutionsScraper().run({
    fetchJson: async (url) => {
      if (url.includes('slug=careers')) return shortcodePayload
      throw new Error('HTTP 403 for job API')
    },
    fetchText: async () => { throw new Error('HTTP 403') },
  }), /HTTP 403/)
})

const envelope = (body, total = body.length) => ({ body, status: 200, headers: { 'X-WP-Total': total, 'X-WP-TotalPages': Math.ceil(total / 100) } })
const runBlockedRenderedPage = (fetchJobPage) => createExcelraKnowledgeSolutionsScraper().run({
  fetchJson: async (url) => {
    if (url.includes('slug=careers')) return shortcodePayload
    const result = await fetchJobPage(new URL(url))
    return Array.isArray(result) ? envelope(result) : result
  },
  fetchText: async () => { throw new Error('HTTP 403 for careers page') },
})

test('Excelra uses the public shortcode job API when Cloudflare blocks rendered HTML', async () => {
  const jobs = await runBlockedRenderedPage(async (url) => {
    assert.equal(url.origin + url.pathname, 'https://www.excelra.com/wp-json/wp/v2/job_listing')
    assert.equal(url.searchParams.get('per_page'), '100')
    assert.equal(url.searchParams.get('page'), '1')
    assert.equal(url.searchParams.get('_envelope'), '1')
    return jobListings
  })
  assert.equal(jobs.length, 8)
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription.length > 100 && !job.applicationUrlIsGeneric))
  const manager = jobs.find(job => job.title === 'Manager')
  assert.equal(manager.jobId, 'a6abe17c549d2d')
  assert.equal(manager.city, 'Hyderabad')
  assert.equal(manager.state, 'Telangana')
  assert.equal(manager.location, 'Uppal, Hyderabad, Telangana, India')
  assert.equal(jobs.find(job => job.title === 'Computational Biology').city, 'Bengaluru')
})

test('Excelra exhausts public job API pages and rejects an interrupted snapshot', async () => {
  const closedPage = Array.from({ length: 100 }, (_, index) => ({ ...jobListings[0], id: 100000 + index, meta: { ...jobListings[0].meta, job_status: 'closed' } }))
  const jobs = await runBlockedRenderedPage(async (url) => envelope(url.searchParams.get('page') === '1' ? closedPage : [jobListings[2]], 101))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Manager')
  await assert.rejects(runBlockedRenderedPage(async (url) => {
    if (url.searchParams.get('page') === '1') return envelope(closedPage, 101)
    throw new Error('Job API page two unavailable')
  }), /page two unavailable/)
})

test('Excelra honors WordPress totals for exact full pages and rejects truncated bodies', async () => {
  const closed = Array.from({ length: 99 }, (_, index) => ({ ...jobListings[0], id: 200000 + index, meta: { ...jobListings[0].meta, job_status: 'closed' } }))
  const jobs = await runBlockedRenderedPage(async (url) => {
    assert.equal(url.searchParams.get('page'), '1', 'Exact full pages must not request an invalid next page')
    return envelope([...closed, jobListings[2]], 100)
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Manager')
  await assert.rejects(runBlockedRenderedPage(async () => envelope(jobListings.slice(1), 14)), /incomplete.*(?:count|snapshot|pagination)/i)
})

test('Excelra rejects invalid or ambiguous shortcode API records before returning India jobs', async () => {
  for (const rows of [
    [],
    [...jobListings, jobListings[2]],
    [{ ...jobListings[2], type: 'page' }],
    [{ ...jobListings[2], meta: { ...jobListings[2].meta, location: 'Remote' } }],
    [{ ...jobListings[2], meta: { ...jobListings[2].meta, darwinbox_job_id: 'unrelated-role' } }],
    [{ ...jobListings[2], meta: { ...jobListings[2].meta, apply_url: 'https://unrelated.example/apply' } }],
  ]) await assert.rejects(runBlockedRenderedPage(async () => rows), /incomplete|scope|duplicate|application|identity/i)
})
