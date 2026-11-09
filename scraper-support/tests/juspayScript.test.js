import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadJuspayModule = async () => {
  try {
    return await import('../../scraper/juspay/script.js')
  } catch {
    assert.fail('Expected Juspay scraper module at ../../scraper/scraper/juspay/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'juspay',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Juspay on the official careers page', async () => {
  const { CAREER_PAGE_URL, buildSearchUrl } = await loadJuspayModule()

  assert.equal(CAREER_PAGE_URL, 'https://juspay.io/careers')
  assert.equal(buildSearchUrl(), 'https://juspay.io/careers')
})

test('extractSearchResults maps the Juspay embedded careers payload into shared scraper fields', async () => {
  const { extractSearchResults } = await loadJuspayModule()
  const html = readHtmlFixture('careers.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Software Development Engineer Backend',
    company: 'Juspay',
    department: 'Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: 'DEV-BE02',
    requisitionId: 'DEV-BE02',
    sourceUrl: 'https://juspay.io/careers/DEV-BE02',
    applyUrl: 'https://juspay.io/careers/DEV-BE02',
    employmentType: 'Internship',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
  })
  assert.match(jobs[0].jobDescription, /Juspay is a leading multinational payments technology company/i)
  assert.match(jobs[0].jobDescription, /What you.ll be doing/i)
  assert.equal(jobs[1].jobId, 'DEV-BE01')
  assert.equal(jobs[1].employmentType, 'Full-time')
  assert.equal(jobs[1].city, 'Bangalore')
})

test('run fetches the Juspay careers page once and decorates shared runner fields', async () => {
  const { buildSearchUrl, createJuspayScraper } = await loadJuspayModule()
  const html = readHtmlFixture('careers.html')
  const requests = []
  const scraper = createJuspayScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === buildSearchUrl()) return html
      throw new Error(`Unexpected Juspay URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [buildSearchUrl()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'juspay')
  assert.equal(jobs[0].company, 'Juspay')
  assert.equal(jobs[0].link, 'https://juspay.io/careers/DEV-BE02')
  assert.equal(jobs[0].employmentType, 'Internship')
})
