import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'

const companyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fundsroom | LinkedIn</title>
  </head>
  <body>
    <main>
      <span>urn:li:organization:71637338</span>
    </main>
  </body>
</html>
`

const zeroResultsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <span>0 jobs in India</span>
    </main>
  </body>
</html>
`

const loadFundsroomModule = async () => {
  try {
    return await import('../../scraper/fundsroom/script.js')
  } catch {
    assert.fail('Expected Fundsroom scraper module at ../../scraper/fundsroom/script.js')
  }
}

test('run validates the public Fundsroom LinkedIn company page and returns zero India jobs when the guest search is empty', async () => {
  const fundsroom = await loadFundsroomModule()
  const requestedUrls = []

  const jobs = await fundsroom.createFundsroomScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === fundsroom.LINKEDIN_COMPANY_PAGE_URL) return companyHtml
      if (url === fundsroom.LINKEDIN_INDIA_JOBS_URL) return zeroResultsHtml
      throw new Error(`Unexpected Fundsroom URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.linkedin.com/company/fundsroom/jobs/',
    'https://www.linkedin.com/jobs/search/?f_C=71637338&geoId=102713980',
  ])
  assert.deepEqual(jobs, [])
})

const jobCard = ({ id = '123', company = 'Fundsroom', dateClass = 'job-search-card__listdate--new' } = {}) => `
<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:${id}">
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${id}">View role</a>
  <h3 class="base-search-card__title">Software Engineer</h3>
  <h4 class="base-search-card__subtitle"><a>${company}</a></h4>
  <span class="job-search-card__location">Bengaluru, India</span>
  <time class="${dateClass}" datetime="2026-10-28">Today</time>
</div>`

test('Fundsroom reads current LinkedIn date classes and native job fields', async () => {
  const { extractSearchResults } = await loadFundsroomModule()
  const jobs = extractSearchResults(jobCard())
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '123')
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].company, 'Fundsroom')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].postingDate, '2026-10-28')
  assert.equal(jobs[0].applyUrl, 'https://www.linkedin.com/jobs/view/123')
})

test('Fundsroom never borrows missing fields from the next job card', async () => {
  const { extractSearchResults } = await loadFundsroomModule()
  const incomplete = '<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:111"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/111">View role</a></div>'
  const jobs = extractSearchResults(incomplete + jobCard({ id: '222', dateClass: 'job-search-card__listdate' }))
  assert.deepEqual(jobs.map(job => job.jobId), ['222'])
})

test('Fundsroom excludes other employers from LinkedIn recommended results', async () => {
  const { extractSearchResults } = await loadFundsroomModule()
  assert.deepEqual(extractSearchResults(jobCard({ company: 'Another Employer', dateClass: 'job-search-card__listdate' })), [])
})

test('Fundsroom parses a page of new-date cards within a bounded child process', () => {
  const moduleUrl = new URL('../../scraper/fundsroom/script.js', import.meta.url).href
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs';
    import { extractSearchResults } from ${JSON.stringify(moduleUrl)};
    console.log(extractSearchResults(readFileSync(0, 'utf8')).length);
  `], {
    input: Array.from({ length: 64 }, (_, index) => jobCard({ id: String(1000 + index) })).join(''),
    encoding: 'utf8', timeout: 5000, windowsHide: true,
  })
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), '64')
})

test('Fundsroom respects caller cancellation before requesting source pages', async () => {
  const { createFundsroomScraper } = await loadFundsroomModule()
  const controller = new AbortController()
  const reason = new Error('cancel Fundsroom')
  controller.abort(reason)
  await assert.rejects(createFundsroomScraper().run({
    signal: controller.signal,
    fetchText: async url => url.includes('/company/') ? companyHtml : zeroResultsHtml,
  }), error => error === reason)
})
