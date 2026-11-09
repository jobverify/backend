import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const linkedinIndiaJobsHtml = readFixture('linkedin-india-jobs.html')
const softwareEngineerDetailHtml = readFixture('software-engineer-ii.html')
const mechanicalAssemblyDetailHtml = readFixture('mechanical-assembly-engineer.html')

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Yield Engineering Systems India scraper module at ./script.js')
  }
}

test('Yield Engineering Systems India scraper pins the verified official homepage and LinkedIn handoff', async () => {
  const yes = await loadModule()

  assert.equal(yes.SOURCE, 'yieldengineeringsystemsindia')
  assert.equal(yes.COMPANY, 'Yield Engineering Systems India P Ltd')
  assert.equal(yes.HOMEPAGE_URL, 'https://www.yes.tech/')
  assert.equal(
    yes.LINKEDIN_COMPANY_JOBS_URL,
    'https://www.linkedin.com/company/yield-engineering-systems/jobs?trk=nav_type_jobs',
  )
  assert.equal(
    yes.LINKEDIN_INDIA_JOBS_API_URL,
    'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?f_C=109619&geoId=102713980',
  )
  assert.equal(yes.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    yes.extractOfficialJobsHandoff(homepageHtml),
    'https://www.linkedin.com/company/yield-engineering-systems/jobs?trk=nav_type_jobs',
  )
  assert.equal(
    yes.buildSearchUrl(),
    'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?f_C=109619&geoId=102713980&start=0',
  )
  assert.equal(
    yes.buildSearchUrl({ start: 25 }),
    'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?f_C=109619&geoId=102713980&start=25',
  )
})

test('extractSearchResults keeps only India jobs from the verified LinkedIn guest feed', async () => {
  const yes = await loadModule()

  const jobs = yes.extractSearchResults(linkedinIndiaJobsHtml)

  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
    })),
    [
      {
        title: 'Software Engineer II',
        location: 'Coimbatore, Tamil Nadu, India',
        city: 'Coimbatore',
        country: 'India',
        jobId: '4432637650',
      },
      {
        title: 'Mechanical Assembly Engineer',
        location: 'Coimbatore, Tamil Nadu, India',
        city: 'Coimbatore',
        country: 'India',
        jobId: '4424349146',
      },
      {
        title: 'Software Engineer I',
        location: 'Coimbatore, Tamil Nadu, India',
        city: 'Coimbatore',
        country: 'India',
        jobId: '4432645531',
      },
      {
        title: 'Electrical Assembly Engineer',
        location: 'Coimbatore, Tamil Nadu, India',
        city: 'Coimbatore',
        country: 'India',
        jobId: '4424356028',
      },
    ],
  )
  assert.ok(
    jobs.every((job) =>
      job.company === 'Yield Engineering Systems India P Ltd'
      && job.applyUrl === job.sourceUrl
      && job.requiredSkills.length === 0
      && job.postingDate != null),
  )
})

test('extractJobDetail parses LinkedIn public detail JSON-LD and criteria fields', async () => {
  const yes = await loadModule()

  assert.deepEqual(yes.extractJobDetail(softwareEngineerDetailHtml), {
    title: 'Software Engineer II',
    listedCompany: 'Yield Engineering Systems',
    location: 'Coimbatore, Tamil Nadu, India',
    city: 'Coimbatore',
    country: 'India',
    department: 'Engineering and Information Technology',
    employmentType: 'Full-time',
    experienceRequired: 'Mid-Senior level',
    preferredQualification: 'Semiconductor Manufacturing',
    postingDate: '2026-06-25',
    jobDescription:
      'Job Title: Software Engineer II Location: Coimbatore Design, develop, test and integrate software for semiconductor equipment. Develop C#/C++ DLL interfaces for external customers to control equipment. Experience with version control systems such as GitHub, Azure Devops.',
  })
})

test('run follows the official YES homepage, paginates the LinkedIn India guest feed, and enriches jobs', async () => {
  const yes = await loadModule()
  const requestedUrls = []

  const jobs = await yes.createYieldEngineeringSystemsIndiaScraper({
    maxPages: 2,
    pageSize: 25,
    now: () => '2026-07-12T18:45:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === yes.HOMEPAGE_URL) return homepageHtml
      if (url === yes.buildSearchUrl({ start: 0 })) return linkedinIndiaJobsHtml
      if (url === yes.buildSearchUrl({ start: 25 })) return '<!DOCTYPE html>'
      if (url.includes('software-engineer-ii-at-yield-engineering-systems-4432637650')) {
        return softwareEngineerDetailHtml
      }
      if (url.includes('mechanical-assembly-engineer-at-yield-engineering-systems-4424349146')) {
        return mechanicalAssemblyDetailHtml
      }
      if (url.includes('software-engineer-i-at-yield-engineering-systems-4432645531')) {
        return softwareEngineerDetailHtml.replaceAll('Software Engineer II', 'Software Engineer I')
      }
      if (url.includes('electrical-assembly-engineer-at-yield-engineering-systems-4424356028')) {
        return mechanicalAssemblyDetailHtml
          .replaceAll('Mechanical Assembly Engineer', 'Electrical Assembly Engineer')
          .replace('Engineering and Production', 'Engineering')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    yes.HOMEPAGE_URL,
    yes.buildSearchUrl({ start: 0 }),
    yes.buildSearchUrl({ start: 25 }),
    'https://in.linkedin.com/jobs/view/software-engineer-ii-at-yield-engineering-systems-4432637650?position=1&pageNum=0',
    'https://in.linkedin.com/jobs/view/mechanical-assembly-engineer-at-yield-engineering-systems-4424349146?position=2&pageNum=0',
    'https://in.linkedin.com/jobs/view/software-engineer-i-at-yield-engineering-systems-4432645531?position=3&pageNum=0',
    'https://in.linkedin.com/jobs/view/electrical-assembly-engineer-at-yield-engineering-systems-4424356028?position=4&pageNum=0',
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'yieldengineeringsystemsindia')
  assert.equal(jobs[0].company, 'Yield Engineering Systems India P Ltd')
  assert.equal(jobs[0].companyCareerPage, yes.LINKEDIN_COMPANY_JOBS_URL)
  assert.equal(jobs[0].companyDomain, 'yes.tech')
  assert.equal(jobs[0].atsPlatform, 'linkedin-guest-search')
  assert.equal(jobs[0].scrapedAt, '2026-07-12T18:45:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(
    jobs.find((job) => job.jobId === '4424349146')?.department,
    'Engineering and Production',
  )
})
