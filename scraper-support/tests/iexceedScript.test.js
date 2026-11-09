import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadIExceedModule = async () => {
  try {
    return await import('../../scraper/iexceed/script.js')
  } catch {
    assert.fail('Expected i-exceed scraper module at ../../scraper/iexceed/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'iexceed',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl stays pinned to the official i-exceed careers page', async () => {
  const iexceed = await loadIExceedModule()

  assert.equal(iexceed.CAREERS_PAGE_URL, 'https://www.i-exceed.com/careers/')
  assert.equal(iexceed.COMPANY, 'i-exceed technology solutions')
  assert.equal(iexceed.SOURCE, 'iexceed')
  assert.equal(iexceed.buildSearchUrl(), 'https://www.i-exceed.com/careers/')
})

test('extractSearchResults parses official i-exceed cards and keeps only India jobs', async () => {
  const iexceed = await loadIExceedModule()
  const jobs = iexceed.extractSearchResults(readFixture('careers.html'))

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Technical Project Manager – Java',
    company: 'i-exceed technology solutions',
    department: 'Technical Project Manager – Java',
    location: 'Bangalore, India; NCR, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '49639',
    requisitionId: '49639',
    sourceUrl: 'https://www.i-exceed.com/careers/technical-project-manager-java/',
    applyUrl: 'https://www.i-exceed.com/careers/technical-project-manager-java/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Microservices',
      'spring boot',
      'core java',
      'J2ee',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Microservices, spring boot, core java, J2ee',
  })
  assert.equal(jobs[1].title, 'Sr. Software Engineer – Java')
  assert.equal(jobs[1].location, 'Bangalore, India')
  assert.equal(jobs.some((job) => job.title === 'Software Developer'), false)
})

test('extractJobDetail reads first-party metadata from the i-exceed detail page', async () => {
  const iexceed = await loadIExceedModule()
  const [listing] = iexceed.extractSearchResults(readFixture('careers.html'))
  const detail = iexceed.extractJobDetail(
    readFixture('job-detail-technical-project-manager-java.html'),
    listing,
  )

  assert.equal(detail.title, 'Technical Project Manager – Java')
  assert.equal(detail.jobId, '49639')
  assert.equal(detail.postingDate, '2024-11-20')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.jobDescription,
    'Hands on experience in architecture, design and implementation of Java /J2EE based projects',
  )
  assert.deepEqual(detail.requiredSkills, [
    'Microservices',
    'spring boot',
    'core java',
    'J2ee',
  ])
})

test('run fetches the official i-exceed careers page and detail pages, then decorates India jobs', async () => {
  const iexceed = await loadIExceedModule()
  const requestedUrls = []

  const jobs = await iexceed.createIExceedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === iexceed.CAREERS_PAGE_URL) return readFixture('careers.html')
      if (url === 'https://www.i-exceed.com/careers/technical-project-manager-java/') {
        return readFixture('job-detail-technical-project-manager-java.html')
      }
      if (url === 'https://www.i-exceed.com/careers/sr-software-engineer-java/') {
        return readFixture('job-detail-technical-project-manager-java.html').replace(
          /Technical Project Manager/g,
          'Sr. Software Engineer',
        )
      }

      assert.fail(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.i-exceed.com/careers/',
    'https://www.i-exceed.com/careers/technical-project-manager-java/',
    'https://www.i-exceed.com/careers/sr-software-engineer-java/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'iexceed')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run fails closed when the verified official i-exceed careers surface changes', async () => {
  const iexceed = await loadIExceedModule()

  await assert.rejects(
    iexceed.createIExceedScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /official i-exceed careers page/i,
  )
})
