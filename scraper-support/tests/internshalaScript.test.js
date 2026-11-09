import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'internshala')
const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const careersHtml = readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')
const insideSalesHtml = readFileSync(path.join(fixturesDir, 'inside-sales-associate.html'), 'utf8')
const trainingDevelopmentHtml = readFileSync(path.join(fixturesDir, 'training-development.html'), 'utf8')

const loadInternshalaModule = async () => {
  try {
    return await import('../../scraper/internshala/script.js')
  } catch {
    assert.fail('Expected Internshala scraper module at ../../scraper/internshala/script.js')
  }
}

test('Internshala extracts career categories from the verified first-party careers page and decorates detail pages', async () => {
  const internshala = await loadInternshalaModule()

  assert.equal(internshala.SOURCE, 'internshala')
  assert.equal(internshala.COMPANY_NAME, 'Internshala')
  assert.equal(internshala.COMPANY, 'Internshala')
  assert.equal(internshala.VERIFIED_ON, '2026-07-25')
  assert.equal(internshala.OFFICIAL_SITE_URL, 'https://internshala.com/')
  assert.equal(internshala.CAREERS_PAGE_URL, 'https://internshala.com/careers/')
  assert.equal(internshala.hasOfficialCareersPageSignal(careersHtml), true)

  const categories = internshala.extractCareerCategories(careersHtml)
  assert.deepEqual(Object.keys(categories), ['Business', 'Technical'])
  assert.equal(categories.Business.length, 5)
  assert.equal(categories.Technical.length, 1)
  assert.equal(categories.Business[0].title, 'VP Growth – Talent Marketplace (Supply)')
  assert.equal(categories.Business[2].link, 'https://internshala.com/job/detail/fresher-inside-sales-associate-job-in-gurgaon-at-internshala1784811688')

  const detailJob = internshala.extractJobFromDetailPage({
    categoryName: 'Business',
    item: categories.Business[2],
    detailUrl: categories.Business[2].link,
    detailHtml: insideSalesHtml,
  })
  assert.deepEqual(detailJob, {
    title: 'Inside Sales Associate',
    company: 'Internshala',
    department: 'Business',
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: 'fresher-inside-sales-associate-job-in-gurgaon-at-internshala1784811688',
    requisitionId: 'fresher-inside-sales-associate-job-in-gurgaon-at-internshala1784811688',
    sourceUrl: 'https://internshala.com/job/detail/fresher-inside-sales-associate-job-in-gurgaon-at-internshala1784811688',
    applyUrl: 'https://internshala.com/student/interstitial/application/fresher-inside-sales-associate-job-in-gurgaon-at-internshala1784811688',
    employmentType: 'Full-time',
    experienceRequired: 'No experience required',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Negotiation',
      'Problem Solving',
      'English Proficiency (Spoken)',
      'Sales',
      'Effective Communication',
    ],
    postingDate: '2026-07-24',
    closingDate: '2026-08-22 23:59:59',
    jobDescription: 'About the job: Drive sales conversations, close candidates, and help learners choose the right opportunity. Skills required: Negotiation, Problem Solving, English Proficiency (Spoken), Sales, Effective Communication.',
    remoteStatus: null,
  })

  const internshipJob = internshala.extractJobFromDetailPage({
    categoryName: 'Business',
    item: categories.Business[3],
    detailUrl: categories.Business[3].link,
    detailHtml: trainingDevelopmentHtml,
  })
  assert.equal(internshipJob.employmentType, 'Internship')
  assert.equal(internshipJob.location, 'Gurgaon, India')
  assert.equal(internshipJob.applyUrl, 'https://internshala.com/student/interstitial/application/training-development-internship-in-gurgaon-at-internshala1784868844')
  assert.match(internshipJob.jobDescription, /day-to-day responsibilities include coordinating training delivery/i)
})

test('Internshala run validates the careers page, fetches detail pages, and falls back cleanly for external notion links', async () => {
  const internshala = await loadInternshalaModule()
  const requestedUrls = []

  const jobs = await internshala.createInternshalaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === internshala.CAREERS_PAGE_URL) return careersHtml
      if (url === 'https://internshala.com/job/detail/fresher-inside-sales-associate-job-in-gurgaon-at-internshala1784811688') {
        return insideSalesHtml
      }
      if (url === 'https://internshala.com/internship/detail/training-development-internship-in-gurgaon-at-internshala1784868844') {
        return trainingDevelopmentHtml
      }
      if (url === 'https://internshala.com/internship/detail/business-development-sales-internship-in-gurgaon-at-internshala1784873533') {
        return trainingDevelopmentHtml.replace('Training and Development', 'Business Development (Sales)')
      }
      if (url === 'https://internshala.com/job/detail/fresher-marketing-designer-associate-job-in-gurgaon-at-internshala1782900067') {
        return insideSalesHtml.replace(/Inside Sales Associate/g, 'Marketing Designer Associate')
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://internshala.com/careers/',
    'https://internshala.com/job/detail/fresher-inside-sales-associate-job-in-gurgaon-at-internshala1784811688',
    'https://internshala.com/internship/detail/training-development-internship-in-gurgaon-at-internshala1784868844',
    'https://internshala.com/internship/detail/business-development-sales-internship-in-gurgaon-at-internshala1784873533',
    'https://internshala.com/job/detail/fresher-marketing-designer-associate-job-in-gurgaon-at-internshala1782900067',
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'internshala')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].title, 'VP Growth – Talent Marketplace (Supply)')
  assert.equal(jobs[0].sourceUrl, 'https://internshala.notion.site/VP-Growth-Talent-Marketplace-Supply-3119a3fd5b7080c4b86ae15fd96f935e?source=copy_link')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].experienceRequired, '7-12 years')
  assert.equal(jobs[0].department, 'Business')
  assert.equal(jobs[2].title, 'Inside Sales Associate')
  assert.equal(jobs[2].location, 'Gurgaon, Haryana, India')
  assert.equal(jobs[5].title, 'Marketing Designer Associate')
})

test('Internshala fails closed when the verified careers surface changes materially', async () => {
  const internshala = await loadInternshalaModule()

  await assert.rejects(
    internshala.createInternshalaScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified internshala careers page/i,
  )
})
