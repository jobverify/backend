import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAlstomModule = async () => {
  try {
    return await import('../../scraper/alstom/script.js')
  } catch {
    assert.fail('Expected Alstom scraper module at ../../scraper/scraper/alstom/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'alstom',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildIndiaSearchUrl keeps Alstom listings on the official India search route', async () => {
  const { buildIndiaSearchUrl } = await loadAlstomModule()

  assert.equal(
    buildIndiaSearchUrl(),
    'https://jobsearch.alstom.com/search/?createNewAlert=false&q=&locationsearch=India&optionsFacetsDD_country=&optionsFacetsDD_department=&optionsFacetsDD_shifttype=&locale=en_GB',
  )
  assert.equal(
    buildIndiaSearchUrl(25),
    'https://jobsearch.alstom.com/search/?createNewAlert=false&q=&locationsearch=India&optionsFacetsDD_country=&optionsFacetsDD_department=&optionsFacetsDD_shifttype=&locale=en_GB&startrow=25',
  )
})

test('extractSearchResults parses Alstom India search rows into shared scraper fields', async () => {
  const { extractSearchResults } = await loadAlstomModule()
  const html = readFixture('india-search.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'HRO Admin Manager - India, Std Countries & L&D',
    location: 'Bangalore, KA, IN, 560066',
    city: 'Bangalore',
    jobId: '1407243033',
    requisitionId: '1407243033',
    sourceUrl: 'https://jobsearch.alstom.com/job/Bangalore-HRO-Admin-Manager-India%2C-Std-Countries-%26amp%3B-L%26amp%3BD/1407243033/',
    postingDate: null,
  })
  assert.equal(jobs[1].city, 'Bengaluru')
})

test('extractResultsSummary reads Alstom total result and page counts from the India listing chrome', async () => {
  const { extractResultsSummary } = await loadAlstomModule()
  const html = readFixture('india-search.html')

  assert.deepEqual(extractResultsSummary(html), {
    totalResults: 274,
    currentPage: 1,
    totalPages: 11,
    pageSize: 25,
  })
})

test('extractJobDetail pulls Alstom apply URL, description, and schema dates from the detail page', async () => {
  const { extractJobDetail } = await loadAlstomModule()
  const html = readFixture('job-detail-1407243033.html')
  const detail = extractJobDetail(html, {
    sourceUrl: 'https://jobsearch.alstom.com/job/Bangalore-HRO-Admin-Manager-India%2C-Std-Countries-%26amp%3B-L%26amp%3BD/1407243033/',
    title: 'HRO Admin Manager - India, Std Countries & L&D',
    location: 'Bangalore, KA, IN, 560066',
    city: 'Bangalore',
    jobId: '1407243033',
    requisitionId: '1407243033',
  })

  assert.equal(detail.title, 'HRO Admin Manager - India, Std Countries & L&D')
  assert.equal(detail.location, 'Bangalore, KA, IN, 560066')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.jobId, '1407243033')
  assert.equal(detail.requisitionId, '1407243033')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.postingDate, 'Tue Jun 23 00:00:00 UTC 2026')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://jobsearch.alstom.com/talentcommunity/apply/1407243033/?locale=en_GB',
  )
  assert.match(detail.jobDescription, /lead hr operations across india/i)
  assert.ok(Array.isArray(detail.requiredSkills))
  assert.ok(detail.requiredSkills.includes('Drive process excellence across shared services'))
})

test('extractJobDetail keeps the Alstom title clean when the itemprop title is rendered on a heading', async () => {
  const { extractJobDetail } = await loadAlstomModule()
  const html = readFixture('job-detail-live-title.html')
  const detail = extractJobDetail(html, {
    sourceUrl: 'https://jobsearch.alstom.com/job/Bangalore-HRO-Admin-Manager-India%2C-Std-Countries-%26amp%3B-L%26amp%3BD/1407243033/',
    title: 'HRO Admin Manager - India, Std Countries & L&D',
    location: 'Bangalore, IN',
    city: 'Bangalore',
    jobId: '1407243033',
    requisitionId: '1407243033',
  })

  assert.equal(detail.title, 'HRO Admin Manager - India, Std Countries & L&D')
})

test('run keeps Alstom jobs on the public India search route and decorates shared runner fields', async () => {
  const {
    buildIndiaSearchUrl,
    createAlstomScraper,
  } = await loadAlstomModule()
  const scraper = createAlstomScraper()
  const listingHtml = readFixture('india-search.html')
  const detailHtml = readFixture('job-detail-1407243033.html')
  const requestedUrls = []

  const jobs = await scraper.run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildIndiaSearchUrl()) return listingHtml
      if (url === 'https://jobsearch.alstom.com/job/Bangalore-HRO-Admin-Manager-India%2C-Std-Countries-%26amp%3B-L%26amp%3BD/1407243033/') {
        return detailHtml
      }
      throw new Error(`Unexpected Alstom URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildIndiaSearchUrl(),
    'https://jobsearch.alstom.com/job/Bangalore-HRO-Admin-Manager-India%2C-Std-Countries-%26amp%3B-L%26amp%3BD/1407243033/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Alstom')
  assert.equal(jobs[0].source, 'alstom')
  assert.equal(
    jobs[0].applyUrl,
    'https://jobsearch.alstom.com/talentcommunity/apply/1407243033/?locale=en_GB',
  )
  assert.equal(
    jobs[0].sourceUrl,
    'https://jobsearch.alstom.com/job/Bangalore-HRO-Admin-Manager-India%2C-Std-Countries-%26amp%3B-L%26amp%3BD/1407243033/',
  )
})

test('run fetches Alstom detail pages concurrently within a listing page', async () => {
  const { createAlstomScraper } = await loadAlstomModule()
  const scraper = createAlstomScraper()
  const listingHtml = `
    <span class="paginationLabel">1 - 2 of 2 Jobs</span>
    <span class="srHelp">Page 1 of 1</span>
    <table>
      <tr class="data-row">
        <td><a class="jobTitle-link" href="/job/Bangalore-Role/1001/">Role One</a></td>
        <td><span class="jobLocation">Bangalore, KA, IN, 560066</span></td>
      </tr>
      <tr class="data-row">
        <td><a class="jobTitle-link" href="/job/Hyderabad-Role/1002/">Role Two</a></td>
        <td><span class="jobLocation">Hyderabad, TS, IN, 500081</span></td>
      </tr>
    </table>
  `
  const detailPages = new Map([
    ['https://jobsearch.alstom.com/job/Bangalore-Role/1001/', `
      <span itemprop="title">Role One</span>
      <span itemprop="description"><span><span>Own the Bangalore program<ul><li>Skill One</li></ul></span></span></span>
      <meta itemprop="datePosted" content="2026-07-01" />
      <meta itemprop="addressLocality" content="Bangalore" />
      <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/apply/1001/?locale=en_GB">Apply</a>
    `],
    ['https://jobsearch.alstom.com/job/Hyderabad-Role/1002/', `
      <span itemprop="title">Role Two</span>
      <span itemprop="description"><span><span>Support the Hyderabad team<ul><li>Skill Two</li></ul></span></span></span>
      <meta itemprop="datePosted" content="2026-07-02" />
      <meta itemprop="addressLocality" content="Hyderabad" />
      <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/apply/1002/?locale=en_GB">Apply</a>
    `],
  ])
  let activeDetailRequests = 0
  let maxActiveDetailRequests = 0

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async (url) => {
      if (url.includes('/search/')) {
        return listingHtml
      }

      if (!detailPages.has(url)) {
        throw new Error(`Unexpected Alstom URL: ${url}`)
      }

      activeDetailRequests += 1
      maxActiveDetailRequests = Math.max(maxActiveDetailRequests, activeDetailRequests)
      await new Promise((resolve) => setTimeout(resolve, 25))
      activeDetailRequests -= 1
      return detailPages.get(url)
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(maxActiveDetailRequests, 2)
})
