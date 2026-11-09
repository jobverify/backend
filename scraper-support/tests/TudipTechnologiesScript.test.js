import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async () => {
  try {
    return await import('../../scraper/tudiptechnologies/script.js')
  } catch {
    assert.fail('Expected Tudip Technologies scraper module at ../../scraper/tudiptechnologies/script.js')
  }
}

const jobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings at Tudip | Explore Your Career</title>
    <link rel="canonical" href="https://tudip.com/jobs/" />
  </head>
  <body>
    <div class="category-tabs">
      <button type="button" class="category-btn active" data-category="india-en">India</button>
      <button type="button" class="category-btn" data-category="argentina">Argentina</button>
    </div>
    <ul class="job_listings">
      <li class="job_listing" data-category="argentina" data-title="global training delivery manager">
        <div class="job-title"><h3>Global Training Delivery Manager</h3></div>
        <a class="apply-btn" href="https://tudip.com/job/argentina/global-training-delivery-manager/" rel="noopener noreferrer">Apply Now</a>
      </li>
      <li class="job_listing" data-category="india-en" data-title="korean language expert">
        <div class="job-title"><h3>Korean Language Expert</h3></div>
        <a class="apply-btn" href="https://tudip.com/job/india/korean-language-expert/" rel="noopener noreferrer">Apply Now</a>
      </li>
      <li class="job_listing" data-category="india-en" data-title="data analyst">
        <div class="job-title"><h3>Data Analyst</h3></div>
        <a class="apply-btn" href="https://tudip.com/jobs/india/data-analyst/" rel="noopener noreferrer">Apply Now</a>
      </li>
    </ul>
  </body>
</html>
`

test('Tudip Technologies extracts India jobs from the verified first-party jobs board', async () => {
  const tudip = await loadModule()

  assert.equal(tudip.SOURCE, 'tudiptechnologies')
  assert.equal(tudip.COMPANY, 'Tudip Technologies')
  assert.equal(tudip.CAREERS_URL, 'https://tudip.com/jobs/')
  assert.equal(tudip.hasOfficialJobsSignal(jobsHtml), true)

  const extractedJobs = tudip.extractJobCards(jobsHtml)
  assert.equal(extractedJobs.length, 2)
  assert.deepEqual(extractedJobs[0], {
    title: 'Korean Language Expert',
    company: 'Tudip Technologies',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'tudiptechnologies-korean-language-expert',
    requisitionId: 'korean-language-expert',
    sourceUrl: 'https://tudip.com/job/india/korean-language-expert/',
    applyUrl: 'https://tudip.com/job/india/korean-language-expert/',
    employmentType: null,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('Tudip Technologies run decorates only India jobs from the verified board', async () => {
  const tudip = await loadModule()

  const jobs = await tudip.createTudipTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === tudip.CAREERS_URL) return jobsHtml
      const title = url.includes('korean-language-expert') ? 'Korean Language Expert' : 'Data Analyst'
      return { status: 200, url, html: `<html><head><link rel="canonical" href="${url}"></head><body>
        <h1>${title}</h1><h2>Position Summary</h2><p>Join Tudip Technologies and work with the engineering team to deliver reliable client projects.</p>
        <h2>Requirements</h2><p>Good communication skills and practical experience in the relevant technical discipline.</p>
        <div class="key-job-details"><h3>Key Job Details</h3><ul>
        <li><strong>Job Title:</strong><span class="key-job-meta">${title}</span></li>
        <li><strong>Country:</strong><span class="key-job-meta">India</span></li>
        <li><strong>Location:</strong><span class="key-job-meta">Pune</span></li></ul></div></body></html>` }
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Korean Language Expert',
    'Data Analyst',
  ])
  assert.equal(jobs[1].source, 'tudiptechnologies')
  assert.equal(jobs[1].companyDomain, 'tudip.com')
  assert.equal(jobs[1].atsPlatform, 'official-company-careers')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('Tudip Technologies fails closed when the verified India jobs surface changes materially', async () => {
  const tudip = await loadModule()

  await assert.rejects(
    tudip.createTudipTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /trusted first-party surface/i,
  )

  await assert.rejects(
    tudip.createTudipTechnologiesScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title>Current Job Openings at Tudip | Explore Your Career</title>
            <link rel="canonical" href="https://tudip.com/jobs/" />
          </head>
          <body>
            <button type="button" class="category-btn active" data-category="india-en">India</button>
          </body>
        </html>
      `,
    }),
    /verified India job listings/i,
  )
})
