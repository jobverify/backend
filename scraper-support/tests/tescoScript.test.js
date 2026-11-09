import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadTescoModule = async () => {
  try {
    return await import('../../scraper/tesco/script.js')
  } catch {
    assert.fail('Expected Tesco scraper module at ../../scraper/tesco/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'tesco',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('Tesco builds bounded official Avature joboffset search URLs', async () => {
  const { buildSearchUrl } = await loadTescoModule()

  assert.equal(
    buildSearchUrl(),
    'https://careers.tesco.com/en_GB/careers/SearchJobs/?joboffset=0',
  )
  assert.equal(
    buildSearchUrl(10),
    'https://careers.tesco.com/en_GB/careers/SearchJobs/?joboffset=10',
  )
})

test('Tesco run emits only explicit India search locations and official Avature detail/apply URLs', async () => {
  const { buildSearchUrl, run } = await loadTescoModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchUrl()) return readFixture('search-results-page-0.html')
      if (url === 'https://careers.tesco.com/en_GB/careers/JobDetail/Software-Engineer/123456') {
        return readFixture('job-detail-123456.html')
      }
      throw new Error(`Unexpected Tesco fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchUrl(),
    'https://careers.tesco.com/en_GB/careers/JobDetail/Software-Engineer/123456',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual({ ...jobs[0], scrapedAt: undefined }, {
    jobId: '123456',
    requisitionId: '123456',
    title: 'Software Engineer',
    company: 'Tesco',
    department: 'Technology',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://careers.tesco.com/en_GB/careers/ApplicationMethods?jobId=123456',
    applyUrl: 'https://careers.tesco.com/en_GB/careers/ApplicationMethods?jobId=123456',
    sourceUrl: 'https://careers.tesco.com/en_GB/careers/JobDetail/Software-Engineer/123456',
    source: 'tesco',
    employmentType: 'Full Time',
    experienceRequired: null,
    jobDescription: 'Build resilient services for Tesco customers.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    scrapedAt: undefined,
  })
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
