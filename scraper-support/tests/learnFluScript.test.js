import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'learnflu',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')

const loadLearnFluModule = async () => {
  try {
    return await import('../../scraper/learnflu/script.js')
  } catch {
    assert.fail('Expected LearnFlu scraper module at ../../scraper/learnflu/script.js')
  }
}

test('LearnFlu scraper recognizes the verified homepage and first-party careers listings shell', async () => {
  const learnFlu = await loadLearnFluModule()

  assert.equal(learnFlu.SOURCE, 'learnflu')
  assert.equal(learnFlu.COMPANY, 'LearnFlu')
  assert.equal(learnFlu.HOMEPAGE_URL, 'https://learnflu.com/')
  assert.equal(learnFlu.CAREERS_URL, 'https://learnflu.com/careers/')
  assert.equal(learnFlu.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(learnFlu.hasOfficialCareersSignal(verifiedCareersHtml), true)

  const jobs = learnFlu.extractPublicJobs(verifiedCareersHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Business Analyst',
      'Business Development Executive (B2C)',
      'Content Writer',
      'Digital Marketing Executive',
      'Marketing Intern',
      'Relationship Manager',
    ],
  )
  assert.deepEqual(jobs[0], {
    title: 'Business Analyst',
    company: 'LearnFlu',
    department: 'Sales',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'learnflu-sales-business-analyst-bengaluru',
    requisitionId: 'learnflu-sales-business-analyst-bengaluru',
    sourceUrl: 'https://learnflu.com/careers/',
    applyUrl: 'https://learnflu.com/careers/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjE0ODYiLCJ0b2dnbGUiOmZhbHNlfQ%3D%3D',
    employmentType: 'Full Time',
    workplaceType: null,
    experienceRequired: '1 Years Experience',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: '₹16000 - ₹20000 /Month',
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.ok(
    jobs.every((job) =>
      job.company === 'LearnFlu'
      && job.country === 'India'
      && job.location === 'Bengaluru, India'
      && job.employmentType === 'Full Time'
      && job.experienceRequired === '1 Years Experience'
      && job.applyUrl === 'https://learnflu.com/careers/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjE0ODYiLCJ0b2dnbGUiOmZhbHNlfQ%3D%3D'
      && job.sourceUrl === 'https://learnflu.com/careers/',
    ),
  )
})

test('LearnFlu scraper returns the public first-party roles from the verified careers page', async () => {
  const learnFlu = await loadLearnFluModule()
  const requestedUrls = []

  const jobs = await learnFlu.createLearnFluScraper({
    now: () => '2026-07-11T07:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === learnFlu.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === learnFlu.CAREERS_URL) return verifiedCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [learnFlu.HOMEPAGE_URL, learnFlu.CAREERS_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'learnflu')
  assert.equal(jobs[0].company, 'LearnFlu')
  assert.equal(jobs[0].companyCareerPage, 'https://learnflu.com/careers/')
  assert.equal(jobs[0].companyDomain, 'learnflu.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T07:30:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('LearnFlu still extracts the verified job cards when the legacy section markers drift', async () => {
  const learnFlu = await loadLearnFluModule()
  const markerlessCareersHtml = verifiedCareersHtml
    .replace('Why Employers Trust Our Candidate', 'Why learners choose us')

  const jobs = learnFlu.extractPublicJobs(markerlessCareersHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Business Analyst',
      'Business Development Executive (B2C)',
      'Content Writer',
      'Digital Marketing Executive',
      'Marketing Intern',
      'Relationship Manager',
    ],
  )
})

test('LearnFlu scraper fails closed when the verified homepage or careers shell drifts materially', async () => {
  const learnFlu = await loadLearnFluModule()

  await assert.rejects(
    learnFlu.createLearnFluScraper().run({
      fetchText: async (url) => {
        if (url === learnFlu.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    learnFlu.createLearnFluScraper().run({
      fetchText: async (url) => {
        if (url === learnFlu.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace('Careers at LearnFlu', 'Careers at Learn Flu')
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    learnFlu.createLearnFluScraper().run({
      fetchText: async (url) => {
        if (url === learnFlu.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          /View Apply/g,
          'Apply Now',
        )
      },
    }),
    /job cards changed shape/i,
  )
})
