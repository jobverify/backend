import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'rdcconcreteindialtd')

const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')

const customProviders = JSON.parse(
  fs.readFileSync(path.join(currentDir, '..', 'providers', 'customProviders.json'), 'utf8'),
)
const companyAliases = JSON.parse(
  fs.readFileSync(path.join(currentDir, '..', 'providers', 'companyAliases.json'), 'utf8'),
)

const loadRdcModule = async () => {
  try {
    return await import('../../scraper/rdcconcreteindialtd/script.js')
  } catch {
    assert.fail('Expected RDC Concrete (India) Ltd scraper module at ../../scraper/rdcconcreteindialtd/script.js')
  }
}

test('RDC Concrete (India) Ltd exposes the exact provider and alias mappings for this scraper lane', () => {
  const provider = customProviders.find((entry) => entry.source === 'rdcconcreteindialtd')
  assert.ok(provider)

  assert.equal(provider.companyName, 'RDC Concrete (India) Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, '../rdcconcreteindialtd/script.js')
  assert.equal(provider.companyCareerPage, 'https://www.rdc.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'rdc.in')

  assert.equal(companyAliases['RDC Concrete (India) Ltd'], 'rdcconcreteindialtd')
  assert.equal(companyAliases['RDC Concrete (India) Limited'], 'rdcconcreteindialtd')
})

test('RDC Concrete (India) Ltd validates the verified homepage and public careers surface contract', async () => {
  const rdc = await loadRdcModule()

  assert.equal(rdc.SOURCE, 'rdcconcreteindialtd')
  assert.equal(rdc.COMPANY, 'RDC Concrete (India) Ltd')
  assert.equal(rdc.HOMEPAGE_URL, 'https://www.rdc.in/')
  assert.equal(rdc.CAREERS_URL, 'https://www.rdc.in/careers')

  assert.equal(rdc.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(rdc.hasOfficialCareersSignal(careersHtml), true)

  const jobs = rdc.extractPublicJobs(careersHtml)
  assert.equal(jobs.length, 8)

  assert.deepEqual(jobs[0], {
    title: 'Trainee Engineers',
    company: 'RDC Concrete (India) Ltd',
    location: 'PAN India',
    city: null,
    country: 'India',
    jobId: 'rdcconcreteindialtd-trainee-engineers-pan-india',
    requisitionId: 'rdcconcreteindialtd-trainee-engineers-pan-india',
    sourceUrl: 'https://www.rdc.in/careers',
    applyUrl: 'https://www.rdc.in/career-apply.php?id=66',
    employmentType: 'Full-time',
    experienceRequired: 'Freshers',
    minimumQualification: 'B.E / B. Tech - Civil, Mechanical, Electrical',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2024-05-16',
    closingDate: null,
    jobDescription: 'Vacancies: 20\nQualification: B.E / B. Tech - Civil, Mechanical, Electrical\nExperience: Freshers',
    vacancyCount: 20,
  })

  assert.equal(jobs[1].title, 'Safety Officer')
  assert.equal(jobs[1].location, 'South')
  assert.equal(jobs[1].applyUrl, 'https://www.rdc.in/career-apply.php?id=65')
  assert.equal(jobs[5].title, 'QA/QC')
  assert.equal(jobs[5].location, 'PAN India')
  assert.equal(jobs[6].title, 'Chartered Accountant')
  assert.equal(jobs[6].city, 'Thane')
  assert.equal(jobs[6].postingDate, '2023-09-13')
  assert.equal(jobs[7].title, 'Officer / Senior Officer - Sales')
  assert.equal(jobs[7].applyUrl, 'https://www.rdc.in/career-apply.php?id=59')
})

test('RDC Concrete (India) Ltd run validates the official surfaces and decorates the current public jobs', async () => {
  const rdc = await loadRdcModule()
  const requestedUrls = []

  const jobs = await rdc.createRdcConcreteIndiaLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === rdc.HOMEPAGE_URL) return homepageHtml
      if (url === rdc.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [rdc.HOMEPAGE_URL, rdc.CAREERS_URL])
  assert.equal(jobs.length, 8)
  assert.equal(jobs[0].source, 'rdcconcreteindialtd')
  assert.equal(jobs[0].company, 'RDC Concrete (India) Ltd')
  assert.equal(jobs[0].companyCareerPage, 'https://www.rdc.in/careers')
  assert.equal(jobs[0].companyDomain, 'rdc.in')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].jobType, 'Full-time Fresher')
  assert.equal(jobs[0].link, 'https://www.rdc.in/career-apply.php?id=66')
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[1].jobType, 'Full-time Experienced')
})

test('RDC Concrete (India) Ltd fails closed when the homepage identity or careers contract drifts', async () => {
  const rdc = await loadRdcModule()

  await assert.rejects(
    rdc.createRdcConcreteIndiaLtdScraper().run({
      fetchText: async (url) => {
        if (url === rdc.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No official company markers.</body></html>'
        }

        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    rdc.createRdcConcreteIndiaLtdScraper().run({
      fetchText: async (url) => {
        if (url === rdc.HOMEPAGE_URL) return homepageHtml
        if (url === rdc.CAREERS_URL) {
          return careersHtml.replace('Current <span>Vacancies</span>', 'Current <span>Openings</span>')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public careers surface/i,
  )

  await assert.rejects(
    rdc.createRdcConcreteIndiaLtdScraper().run({
      fetchText: async (url) => {
        if (url === rdc.HOMEPAGE_URL) return homepageHtml
        if (url === rdc.CAREERS_URL) {
          return careersHtml.replace(/career-apply\.php\?id=\d+/g, 'apply-now')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public careers surface|returned no public jobs/i,
  )
})
