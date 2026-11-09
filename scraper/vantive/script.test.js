import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const readFixture = (name) => readFileSync(new URL(`../../scraper-support/tests/fixtures/${name}`, import.meta.url), 'utf8')

const indiaSearchPage1Html = readFixture('vantive-india-search.html')
const indiaSearchPage2Html = readFixture('vantive-india-search-page-2.html')
const indiaDetailHtml = readFixture('vantive-india-detail.html')

test('Vantive scraper builds verified India TalentBrew search URLs', async () => {
  const vantive = await loadModule()
  assert.ok(vantive, 'Expected scraper module at ./script.js')

  assert.equal(vantive.COMPANY_NAME, 'Vantive')
  assert.equal(vantive.SOURCE, 'vantive')
  assert.equal(vantive.ATS_PLATFORM, 'talentbrew-radancy')
  assert.equal(vantive.INDIA_FACET_ID, '1269750')
  assert.equal(
    vantive.CAREER_PAGE_URL,
    'https://jobs.vantive.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(
    vantive.buildSearchUrl({ page: 1 }),
    'https://jobs.vantive.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(
    vantive.buildSearchUrl({ page: 2 }),
    'https://jobs.vantive.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D&p=2',
  )
})

test('Vantive scraper parses the verified India TalentBrew listing pages', async () => {
  const vantive = await loadModule()
  assert.ok(vantive, 'Expected scraper module at ./script.js')

  const page1Jobs = vantive.extractSearchResults(indiaSearchPage1Html)
  const page1Summary = vantive.extractPaginationSummary(indiaSearchPage1Html)
  const page2Summary = vantive.extractPaginationSummary(indiaSearchPage2Html)

  assert.equal(page1Jobs.length, 15)
  assert.deepEqual(page1Jobs[0], {
    title: 'Associate Director, Business Enterprise',
    company: 'Vantive',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '97540864368',
    requisitionId: '97540864368',
    sourceUrl: 'https://jobs.vantive.com/job/bengaluru/associate-director-business-enterprise/47727/97540864368',
    applyUrl: 'https://jobs.vantive.com/job/bengaluru/associate-director-business-enterprise/47727/97540864368',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(page1Jobs[2], {
    title: 'HR Specialist, HR Shared Services',
    company: 'Vantive',
    department: null,
    location: 'Gurgaon, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: '96156156032',
    requisitionId: '96156156032',
    sourceUrl: 'https://jobs.vantive.com/job/gurgaon/hr-specialist-hr-shared-services/47727/96156156032',
    applyUrl: 'https://jobs.vantive.com/job/gurgaon/hr-specialist-hr-shared-services/47727/96156156032',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  assert.deepEqual(page1Summary, {
    hasNext: true,
    currentPage: 1,
    totalPages: 2,
    totalJobCount: 25,
  })
  assert.deepEqual(page2Summary, {
    hasNext: false,
    currentPage: 2,
    totalPages: 2,
    totalJobCount: 25,
  })
})

test('Vantive scraper enriches an India job detail page with JobPosting and Workday apply data', async () => {
  const vantive = await loadModule()
  assert.ok(vantive, 'Expected scraper module at ./script.js')

  const detail = vantive.extractJobDetail(indiaDetailHtml, {
    title: 'Associate Director, Business Enterprise',
    company: 'Vantive',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '97540864368',
    requisitionId: '97540864368',
    sourceUrl: 'https://jobs.vantive.com/job/bengaluru/associate-director-business-enterprise/47727/97540864368',
    applyUrl: 'https://jobs.vantive.com/job/bengaluru/associate-director-business-enterprise/47727/97540864368',
  })

  assert.equal(detail.title, 'Associate Director, Business Enterprise')
  assert.equal(detail.company, 'Vantive')
  assert.equal(detail.department, 'Software R&D')
  assert.equal(detail.location, 'Bengaluru, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '97540864368')
  assert.equal(detail.requisitionId, 'JR - 196226')
  assert.equal(
    detail.applyUrl,
    'https://vantive.wd108.myworkdayjobs.com/Vantive/job/Bangalore-Karnataka/Associate-Director--Business-Enterprise_JR-196226/apply',
  )
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '10+ years')
  assert.equal(detail.postingDate, '2026-07-09')
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [])
  assert.match(detail.jobDescription, /Lead of Digital Product Ownership/i)
  assert.match(detail.jobDescription, /What you will bring/i)
})

test('Vantive scraper run walks the verified India listing page and detail page', async () => {
  const vantive = await loadModule()
  assert.ok(vantive, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await vantive.createVantiveScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === vantive.CAREER_PAGE_URL) {
        return indiaSearchPage1Html
      }

      if (url === 'https://jobs.vantive.com/job/bengaluru/associate-director-business-enterprise/47727/97540864368') {
        return indiaDetailHtml
      }

      throw new Error(`Unexpected Vantive fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    vantive.CAREER_PAGE_URL,
    'https://jobs.vantive.com/job/bengaluru/associate-director-business-enterprise/47727/97540864368',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'vantive')
  assert.equal(jobs[0].title, 'Associate Director, Business Enterprise')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].requisitionId, 'JR - 196226')
  assert.ok(Date.parse(jobs[0].scrapedAt))
})
