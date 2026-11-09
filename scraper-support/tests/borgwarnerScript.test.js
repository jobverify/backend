import assert from 'node:assert/strict'
import test from 'node:test'

const loadBorgwarnerModule = async () => {
  try {
    return await import('../../scraper/borgwarner/script.js')
  } catch {
    return null
  }
}

const indiaJobsHtml = `
<!DOCTYPE html>
<html>
  <body>
    <span id="resultsStats" class="sfsearchResultStatistics">11 results for:</span>

    <div class="workday-job-result row widget-row">
      <div class="column widget-block large-12">
        <div class="meta-info mb-4">
          <div id="divDate" class="h5">Jun 30, 2026</div>
          <div class="h5">R2026-2571</div>
        </div>
        <div class="bw-global-list-h3 h3 mb-6">
          <a class="link" href="https://www.borgwarner.com/careers/job-search?country=india&amp;id=R2026-2571">
            Supplier Development Engineer, Staff
          </a>
        </div>
        <p class="bw-global-list-p">
          <span class="location mr-8">
            <svg></svg>
            Bengaluru (Primeco Unioncity) - India
          </span>
        </p>
      </div>
    </div>
    <hr/>

    <div class="workday-job-result row widget-row">
      <div class="column widget-block large-12">
        <div class="meta-info mb-4">
          <div id="divDate" class="h5">Jun 25, 2026</div>
          <div class="h5">R2026-2036</div>
        </div>
        <div class="bw-global-list-h3 h3 mb-6">
          <a class="link" href="https://www.borgwarner.com/careers/job-search?country=india&amp;id=R2026-2036">
            Deputy Manager - Operational Excellence &amp; Lean
          </a>
        </div>
        <p class="bw-global-list-p">
          <span class="location mr-8">
            <svg></svg>
            Chennai - India
          </span>
        </p>
      </div>
    </div>
    <hr/>
  </body>
</html>
`

test('extractIndiaJobs parses public BorgWarner India jobs from the official job search page', async () => {
  const borgwarner = await loadBorgwarnerModule()
  assert.ok(borgwarner)

  const jobs = borgwarner.extractIndiaJobs(indiaJobsHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Supplier Development Engineer, Staff',
    company: 'BorgWarner',
    department: null,
    location: 'Bengaluru (Primeco Unioncity) - India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'R2026-2571',
    requisitionId: 'R2026-2571',
    sourceUrl: 'https://www.borgwarner.com/careers/job-search?country=india&id=R2026-2571',
    applyUrl: 'https://www.borgwarner.com/careers/job-search?country=india&id=R2026-2571',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-30',
    closingDate: null,
    jobDescription: 'Official BorgWarner India opening listed on the public job search page.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].title, 'Deputy Manager - Operational Excellence & Lean')
  assert.equal(jobs[1].city, 'Chennai')
  assert.equal(jobs[1].jobId, 'R2026-2036')
  assert.equal(jobs[1].postingDate, '2026-06-25')
})

test('run fetches the India-filtered BorgWarner job page and decorates the jobs', async () => {
  const borgwarner = await loadBorgwarnerModule()
  assert.ok(borgwarner)

  const requestedTexts = []
  const scraper = borgwarner.createBorgwarnerScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === borgwarner.INDIA_JOBS_PAGE_URL) return indiaJobsHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [borgwarner.INDIA_JOBS_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'borgwarner')
  assert.equal(jobs[0].link, 'https://www.borgwarner.com/careers/job-search?country=india&id=R2026-2571')
  assert.equal(jobs[0].company, 'BorgWarner')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
