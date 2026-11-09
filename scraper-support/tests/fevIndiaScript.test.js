import assert from 'node:assert/strict'
import test from 'node:test'

const loadFevIndiaModule = async () => {
  try {
    return await import('../../scraper/fevindia/script.js')
  } catch {
    assert.fail('Expected FEV India scraper module at ../../scraper/fevindia/script.js')
  }
}

const verifiedDetailUrl =
  'https://www.linkedin.com/posts/fev-india_cybersecurity-senior-process-engineers-activity-7477951524346814465-7fuL'

const officialHandoffHtml = `
  <main>
    <a href="https://in.linkedin.com/company/fev-india">FEV India on LinkedIn</a>
  </main>
`

const companyFeedHtml = `
  <article data-urn="urn:li:activity:1">
    <a href="https://www.linkedin.com/posts/fev-india_company-update-activity-1">FEV India's post</a>
    <div class="feed-shared-update-v2__description">
      FEV India shared an event update for Auto Shanghai.
    </div>
  </article>
  <article data-urn="urn:li:activity:7477951524346814465">
    <a href="${verifiedDetailUrl}">FEV India's post</a>
    <div class="feed-shared-update-v2__description">
      FEV India is hiring for its cybersecurity practice.
      Position: Senior Process Engineer - Cyber Security
      Location: Pune, Maharashtra, India
      Department: Engineering
    </div>
  </article>
  <article data-urn="urn:li:activity:3">
    <a href="https://www.linkedin.com/posts/fev-india_global-hiring-activity-3">FEV India's post</a>
    <div class="feed-shared-update-v2__description">
      FEV India is hiring.
      Position: Validation Engineer
      Location: Aachen, Germany
    </div>
  </article>
`

const detailHtml = `
  <main>
    <p>Join FEV India Pvt Ltd's cybersecurity practice supporting software-defined vehicle programs.</p>
    <a href="mailto:careers.india@fev.com?subject=Senior%20Process%20Engineer%20-%20Cyber%20Security">
      Share your resume
    </a>
  </main>
`

test('extractJobPostings keeps only India hiring posts from the public FEV India company feed', async () => {
  const fevIndia = await loadFevIndiaModule()
  const jobs = fevIndia.extractJobPostings(companyFeedHtml)

  assert.equal(fevIndia.pageIndicatesFevIndiaLinkedinHandoff(officialHandoffHtml), true)
  assert.deepEqual(jobs, [{
    title: 'Senior Process Engineer - Cyber Security',
    company: 'FEV India Pvt Ltd',
    department: 'Engineering',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    sourceUrl: verifiedDetailUrl,
    applyUrl: null,
    jobDescription: 'FEV India is hiring for its cybersecurity practice.',
  }])
})

test('extractJobDetail captures the recruiter email handoff from a public FEV India post detail page', async () => {
  const fevIndia = await loadFevIndiaModule()
  const detail = fevIndia.extractJobDetail(detailHtml)

  assert.deepEqual(detail, {
    applyUrl: 'mailto:careers.india@fev.com?subject=Senior%20Process%20Engineer%20-%20Cyber%20Security',
    jobDescription: "Join FEV India Pvt Ltd's cybersecurity practice supporting software-defined vehicle programs.",
  })
})

test('run validates the official careers handoff and decorates FEV India jobs with the recruiter email link', async () => {
  const fevIndia = await loadFevIndiaModule()
  const requestedUrls = []
  const jobs = await fevIndia.createFevIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === fevIndia.OFFICIAL_CAREERS_HANDOFF_URL) return officialHandoffHtml
      if (url === fevIndia.LINKEDIN_COMPANY_URL) return companyFeedHtml
      if (url === verifiedDetailUrl) return detailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    fevIndia.OFFICIAL_CAREERS_HANDOFF_URL,
    fevIndia.LINKEDIN_COMPANY_URL,
    verifiedDetailUrl,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'fevindia')
  assert.equal(jobs[0].company, 'FEV India Pvt Ltd')
  assert.equal(jobs[0].title, 'Senior Process Engineer - Cyber Security')
  assert.equal(jobs[0].location, 'Pune, Maharashtra, India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(
    jobs[0].applyUrl,
    'mailto:careers.india@fev.com?subject=Senior%20Process%20Engineer%20-%20Cyber%20Security',
  )
  assert.equal(
    jobs[0].link,
    'mailto:careers.india@fev.com?subject=Senior%20Process%20Engineer%20-%20Cyber%20Security',
  )
  assert.equal(jobs[0].sourceUrl, verifiedDetailUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
