import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'prdcprivatelimited',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const careersHtml = readFixture('career.html')
const vacancyHubHtml = readFixture('category-wise-vacancy.html')
const allCategoriesHtml = readFixture('job-listing-all-categories.html')

const emptyAllCategoriesHtml = `<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8" />
    <title>Job Listing &#8211; ALL CATEGORIES &#8211; prdcinfotech</title>
    <link rel="canonical" href="https://beta.prdcinfotech.com/job-listing-all-categories/" />
  </head>
  <body>
    <table>
      <tbody>
        <tr>
          <th width="30%">Title</th>
          <th>Domain</th>
          <th>Experience</th>
          <th>Location</th>
          <th></th>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const loadPrdcModule = async () => {
  try {
    return await import('../../scraper/prdcprivatelimited/script.js')
  } catch {
    assert.fail('Expected PRDC Private Limited scraper module at ../../scraper/prdcprivatelimited/script.js')
  }
}

test('PRDC helpers verify the careers handoff, vacancy hub, and all-categories listing surface', async () => {
  const prdc = await loadPrdcModule()

  assert.equal(prdc.SOURCE, 'prdcprivatelimited')
  assert.equal(prdc.COMPANY, 'Power Research and Development Consultants Private Limited')
  assert.equal(prdc.CAREERS_URL, 'https://beta.prdcinfotech.com/career/')
  assert.equal(prdc.VACANCY_HUB_URL, 'https://beta.prdcinfotech.com/category-wise-vacancy/')
  assert.equal(prdc.ALL_CATEGORIES_URL, 'https://beta.prdcinfotech.com/job-listing-all-categories/')
  assert.equal(prdc.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(prdc.extractVacancyHubUrl(careersHtml), prdc.VACANCY_HUB_URL)
  assert.equal(prdc.hasOfficialVacancyHubSignal(vacancyHubHtml), true)
  assert.equal(prdc.extractAllCategoriesUrl(vacancyHubHtml), prdc.ALL_CATEGORIES_URL)
  assert.equal(prdc.hasOfficialAllCategoriesSignal(allCategoriesHtml), true)
})

test('extractJobsFromAllCategoriesPage maps the verified PRDC public jobs table into the shared listing contract', async () => {
  const prdc = await loadPrdcModule()

  const jobs = prdc.extractJobsFromAllCategoriesPage(allCategoriesHtml, {
    scrapedAt: '2026-07-11T04:30:00.000Z',
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Electrical Engineer - System Studies',
    company: 'Power Research and Development Consultants Private Limited',
    location: 'Bengaluru',
    city: 'Bengaluru',
    state: null,
    country: 'India',
    jobId: 'electrical-engineer-system-studies',
    requisitionId: 'electrical-engineer-system-studies',
    sourceUrl: 'https://beta.prdcinfotech.com/job-listing-all-categories/',
    applyUrl: null,
    department: 'Electrical',
    employmentType: 'Full-time',
    experienceRequired: '1 - 3 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Domain: Electrical\nExperience: 1 - 3 Years\nLocation: Bengaluru',
    source: 'prdcprivatelimited',
    link: 'https://beta.prdcinfotech.com/job-listing-all-categories/',
    scrapedAt: '2026-07-11T04:30:00.000Z',
  })

  assert.deepEqual(jobs[2], {
    title: 'Developer, Software (MCA)',
    company: 'Power Research and Development Consultants Private Limited',
    location: 'Bengaluru',
    city: 'Bengaluru',
    state: null,
    country: 'India',
    jobId: 'developer-software-mca',
    requisitionId: 'developer-software-mca',
    sourceUrl: 'https://beta.prdcinfotech.com/job-listing-all-categories/',
    applyUrl: null,
    department: 'Software',
    employmentType: 'Full-time',
    experienceRequired: '1 - 3 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Domain: Software\nExperience: 1 - 3 Years\nLocation: Bengaluru',
    source: 'prdcprivatelimited',
    link: 'https://beta.prdcinfotech.com/job-listing-all-categories/',
    scrapedAt: '2026-07-11T04:30:00.000Z',
  })
})

test('PRDC scraper validates the verified handoff pages before returning current public jobs', async () => {
  const prdc = await loadPrdcModule()
  const requestedUrls = []

  const jobs = await prdc.createPrdcPrivateLimitedScraper({
    now: () => new Date('2026-07-11T04:30:00.000Z'),
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === prdc.CAREERS_URL) return careersHtml
      if (url === prdc.VACANCY_HUB_URL) return vacancyHubHtml
      if (url === prdc.ALL_CATEGORIES_URL) return allCategoriesHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    prdc.CAREERS_URL,
    prdc.VACANCY_HUB_URL,
    prdc.ALL_CATEGORIES_URL,
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[1].title, 'Marketing Professionals')
  assert.equal(jobs[1].source, 'prdcprivatelimited')
  assert.equal(jobs[1].link, prdc.ALL_CATEGORIES_URL)
})

test('PRDC scraper fails closed when the verified handoff changes or the public jobs table empties out', async () => {
  const prdc = await loadPrdcModule()

  await assert.rejects(
    prdc.createPrdcPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === prdc.CAREERS_URL) {
          return '<html><head><title>Unexpected</title></head><body>No careers handoff</body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    prdc.createPrdcPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === prdc.CAREERS_URL) return careersHtml
        if (url === prdc.VACANCY_HUB_URL) return vacancyHubHtml
        if (url === prdc.ALL_CATEGORIES_URL) return emptyAllCategoriesHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /returned no public jobs/i,
  )
})
