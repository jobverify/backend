import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAppleModule = async () => {
  try {
    return await import('../../scraper/apple/script.js')
  } catch {
    assert.fail('Expected Apple scraper module at ../../scraper/scraper/apple/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'apple',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Apple on the India jobs search flow and adds page numbers after page 1', async () => {
  const { CAREER_PAGE_URL, buildSearchUrl } = await loadAppleModule()

  assert.equal(CAREER_PAGE_URL, 'https://jobs.apple.com/en-in/search?location=india-INDC')
  assert.equal(buildSearchUrl(), 'https://jobs.apple.com/en-in/search?location=india-INDC')
  assert.equal(buildSearchUrl({ page: 2 }), 'https://jobs.apple.com/en-in/search?location=india-INDC&page=2')
})

test('extractSearchResults maps Apple hydration results into shared scraper fields', async () => {
  const { extractPaginationSummary, extractSearchResults } = await loadAppleModule()
  const html = readHtmlFixture('search-page-1.html')
  const jobs = extractSearchResults(html)
  const summary = extractPaginationSummary(html)

  assert.equal(jobs.length, 20)
  assert.deepEqual(summary, {
    page: 1,
    pageSize: 20,
    totalRecords: 166,
    totalPages: 9,
    hasNext: true,
  })

  const bengaluruRole = jobs.find((job) => job.jobId === '200656479-0321')
  assert.ok(bengaluruRole)
  assert.deepEqual(bengaluruRole, {
    title: 'Project Manager',
    company: 'Apple',
    department: 'Software and Services',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    jobId: '200656479-0321',
    requisitionId: '200656479-0321',
    sourceUrl: 'https://jobs.apple.com/en-in/details/200656479-0321/project-manager?team=SFTWR',
    applyUrl: 'https://jobs.apple.com/en-in/details/200656479-0321/project-manager?team=SFTWR',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '25 Jun 2026',
    closingDate: null,
    jobDescription: bengaluruRole.jobDescription,
  })
  assert.match(bengaluruRole.jobDescription, /Join Apple.s Information Systems and Technology/i)

  const retailPipelineRole = jobs.find((job) => job.jobId === 'PIPE-200313970')
  assert.ok(retailPipelineRole)
  assert.equal(retailPipelineRole.location, 'India')
  assert.equal(retailPipelineRole.city, null)
  assert.equal(retailPipelineRole.department, 'Apple Retail')
})

test('extractJobDetail reads Apple detail hydration and derives experience evidence', async () => {
  const { extractJobDetail } = await loadAppleModule()
  const detailHtml = readHtmlFixture('detail-software-engineer-data-ai.html')

  assert.deepEqual(extractJobDetail(detailHtml), {
    minimumQualification: "* Bachelor's degree or equivalent experience, with 4+ years in data engineering and applied AI/ML engineering\n* Strong Python and SQL skills",
    preferredQualification: '* Experience with AWS, GCP, or Azure\n* Experience with React or FastAPI',
    experienceRequired: '4+ years',
    jobDescription: 'Build data and AI platforms at Apple.\n\nDesign scalable data pipelines for enterprise analytics.\n\nShip production systems with strong governance and observability.',
  })
})

test('run paginates Apple search pages, hydrates detail pages, and decorates shared runner fields', async () => {
  const { buildSearchUrl, createAppleScraper, extractSearchResults } = await loadAppleModule()
  const page1Html = readHtmlFixture('search-page-1.html')
  const page2Html = readHtmlFixture('search-page-2.html')
  const detailHtml = readHtmlFixture('detail-software-engineer-data-ai.html')
  const requests = []
  const firstPageJobs = extractSearchResults(page1Html)
  const expectedDetailUrls = firstPageJobs.slice(0, 2).map((job) => job.sourceUrl)
  const scraper = createAppleScraper({ maxPages: 2, maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === buildSearchUrl()) return page1Html
      if (url === buildSearchUrl({ page: 2 })) return page2Html
      if (expectedDetailUrls.includes(url)) {
        // Bind the synthetic detail to the requested role. One unrelated
        // Software Engineer fixture must not hydrate several different jobs.
        const job = firstPageJobs.find(job => job.sourceUrl === url)
        const native = { loaderData: { jobDetails: { jobsData: {
          reqId: job.jobId, postingTitle: job.title,
          jobSummary: `Build production services as ${job.title}.`,
          description: 'Design scalable data pipelines for enterprise analytics.',
          minimumQualifications: 'Bachelor degree with 4+ years in data engineering.',
          preferredQualifications: 'Experience with AWS, GCP, or Azure.',
        } } } }
        return `<script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify(native))});</script>`
      }
      throw new Error(`Unexpected Apple URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildSearchUrl(),
    ...expectedDetailUrls,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'apple')
  assert.equal(jobs[0].company, 'Apple')
  assert.ok(jobs.every((job) => job.link === job.applyUrl))
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
  assert.ok(jobs.every((job) => job.minimumQualification?.includes('4+ years')))
  assert.ok(jobs.every((job) => job.preferredQualification?.includes('AWS, GCP, or Azure')))
  assert.ok(jobs.every((job) => job.experienceRequired === '4+ years'))
})
