import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'jyesta',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')

const loadJyestaModule = async () => {
  try {
    return await import('../../scraper/jyesta/script.js')
  } catch {
    assert.fail('Expected Jyesta scraper module at ../../scraper/jyesta/script.js')
  }
}

test('Jyesta scraper recognizes the verified homepage and first-party careers listings shell', async () => {
  const jyesta = await loadJyestaModule()

  assert.equal(jyesta.SOURCE, 'jyesta')
  assert.equal(jyesta.COMPANY, 'Jyesta Corporate Entity')
  assert.equal(jyesta.HOMEPAGE_URL, 'https://www.jyesta.com/')
  assert.equal(jyesta.CAREERS_URL, 'https://www.jyesta.com/careers')
  assert.equal(jyesta.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(jyesta.hasOfficialCareersSignal(verifiedCareersHtml), true)

  const jobs = jyesta.extractPublicJobs(verifiedCareersHtml)

  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Business Development Associate Intern',
      'Digital Marketing Intern',
      'HR Intern',
      'Operations Executive Intern',
      'Software Engineer Intern (Fullstack)',
    ],
  )
  assert.deepEqual(
    jobs.map((job) => job.department),
    [
      'Business Development',
      'Digital Marketing',
      'Human Resources',
      'Operations',
      'Engineering',
    ],
  )
  assert.ok(
    jobs.every((job) =>
      job.location === 'Bangalore, India'
      && job.country === 'India'
      && job.employmentType === 'Internship'
      && job.workplaceType === 'On-site'
      && job.applyUrl === job.sourceUrl
      && job.sourceUrl.startsWith('https://www.jyesta.com/careers#jd-')),
  )
})

test('Jyesta scraper returns the public first-party roles from the verified careers page', async () => {
  const jyesta = await loadJyestaModule()
  const requestedUrls = []

  const jobs = await jyesta.createJyestaScraper({ now: () => '2026-07-10T00:00:00.000Z' }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === jyesta.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === jyesta.CAREERS_URL) return verifiedCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [jyesta.HOMEPAGE_URL, jyesta.CAREERS_URL])
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].source, 'jyesta')
  assert.equal(jobs[0].company, 'Jyesta Corporate Entity')
  assert.equal(jobs[0].companyCareerPage, 'https://www.jyesta.com/careers')
  assert.equal(jobs[0].companyDomain, 'jyesta.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('Jyesta scraper fails closed when the verified homepage or careers shell drifts materially', async () => {
  const jyesta = await loadJyestaModule()

  await assert.rejects(
    jyesta.createJyestaScraper().run({
      fetchText: async (url) => {
        if (url === jyesta.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    jyesta.createJyestaScraper().run({
      fetchText: async (url) => {
        if (url === jyesta.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          'Open Positions',
          'Open Opportunities',
        )
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    jyesta.createJyestaScraper().run({
      fetchText: async (url) => {
        if (url === jyesta.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          '>Internship</span>',
          '>Seasonal</span>',
        )
      },
    }),
    /jyesta verified careers job cards changed shape/i,
  )
})
