import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'insolareenergy',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')

const loadInsolareEnergyModule = async () => {
  try {
    return await import('../../scraper/insolareenergy/script.js')
  } catch {
    assert.fail('Expected InSolare Energy scraper module at ../../scraper/insolareenergy/script.js')
  }
}

test('InSolare Energy recognizes the verified official homepage, careers shell, and published roles', async () => {
  const insolare = await loadInsolareEnergyModule()

  assert.equal(insolare.SOURCE, 'insolareenergy')
  assert.equal(insolare.COMPANY, 'InSolare Energy')
  assert.equal(insolare.HOMEPAGE_URL, 'https://insolare.com/')
  assert.equal(insolare.CAREERS_URL, 'https://insolare.com/careers/')
  assert.equal(insolare.APPLICATION_EMAIL, 'hr@insolare.com')
  assert.equal(insolare.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(insolare.extractCareersUrl(verifiedHomepageHtml), insolare.CAREERS_URL)
  assert.equal(insolare.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.deepEqual(
    insolare.extractRoleTitles(verifiedCareersHtml),
    ['Project Engineer', 'Business Analyst', 'HR Executive', 'Solar Design Lead'],
  )
})

test('InSolare Energy emits first-party form-backed openings from the verified careers page', async () => {
  const insolare = await loadInsolareEnergyModule()
  const requestedUrls = []

  const jobs = await insolare.createInsolareEnergyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === insolare.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === insolare.CAREERS_URL) return verifiedCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [insolare.HOMEPAGE_URL, insolare.CAREERS_URL])
  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      link: job.link,
      location: job.location,
      country: job.country,
    })),
    [
      {
        title: 'Project Engineer',
        company: 'InSolare Energy',
        jobId: 'insolareenergy-project-engineer',
        sourceUrl: 'https://insolare.com/careers/',
        applyUrl: 'https://insolare.com/careers/',
        link: 'https://insolare.com/careers/',
        location: 'India',
        country: 'India',
      },
      {
        title: 'Business Analyst',
        company: 'InSolare Energy',
        jobId: 'insolareenergy-business-analyst',
        sourceUrl: 'https://insolare.com/careers/',
        applyUrl: 'https://insolare.com/careers/',
        link: 'https://insolare.com/careers/',
        location: 'India',
        country: 'India',
      },
      {
        title: 'HR Executive',
        company: 'InSolare Energy',
        jobId: 'insolareenergy-hr-executive',
        sourceUrl: 'https://insolare.com/careers/',
        applyUrl: 'https://insolare.com/careers/',
        link: 'https://insolare.com/careers/',
        location: 'India',
        country: 'India',
      },
      {
        title: 'Solar Design Lead',
        company: 'InSolare Energy',
        jobId: 'insolareenergy-solar-design-lead',
        sourceUrl: 'https://insolare.com/careers/',
        applyUrl: 'https://insolare.com/careers/',
        link: 'https://insolare.com/careers/',
        location: 'India',
        country: 'India',
      },
    ],
  )
})

test('InSolare Energy fails closed when the official homepage handoff or careers role picker changes materially', async () => {
  const insolare = await loadInsolareEnergyModule()

  await assert.rejects(
    insolare.createInsolareEnergyScraper().run({
      fetchText: async (url) => {
        if (url === insolare.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No careers link</body></html>'
        }

        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    insolare.createInsolareEnergyScraper().run({
      fetchText: async (url) => {
        if (url === insolare.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          /(<select[^>]+)name="job_designation"/i,
          '$1name="job_role"',
        )
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    insolare.createInsolareEnergyScraper().run({
      fetchText: async (url) => {
        if (url === insolare.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          '<option value="Solar Design Lead">Solar Design Lead</option>',
          '',
        )
      },
    }),
    /public role options/i,
  )
})
