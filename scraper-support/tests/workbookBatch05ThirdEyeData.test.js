import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_URL = 'https://thirdeyedata.ai/careers/'
const OPENINGS_URL = 'https://thirdeyedata.ai/current-openings'

const openingsHtml = `
  <main>
    <h3>List of Open Positions</h3>
    <article class="job-card">
      <h4><a href="https://thirdeyedata.ai/jobpost/product-manager">Product Manager</a></h4>
      <a href="https://thirdeyedata.ai/jobpost/product-manager">Apply Now</a>
      <p>Remote</p>
      <p>India</p>
    </article>
    <article class="job-card">
      <h4><a href="/jobpost/backend-java-development">Backend Java Developer</a></h4>
      <a href="/jobpost/backend-java-development">Apply Now</a>
      <p>On-site</p>
      <p>Delhi, Noida, Uttar Pradesh, India</p>
    </article>
    <article class="job-card">
      <h4><a href="/jobpost/ai-sales-head">Sr. Sales Manager</a></h4>
      <a href="/jobpost/ai-sales-head">Apply Now</a>
      <p>Hybrid</p>
      <p>Delhi, Noida, Uttar Pradesh, India</p>
    </article>
    <article class="job-card">
      <h4><a href="/jobpost/us-sales-executive">US Sales Executive</a></h4>
      <a href="/jobpost/us-sales-executive">Apply Now</a>
      <p>Hybrid</p>
      <p>California, United States</p>
    </article>
    <article class="job-card">
      <h4><a href="https://jobs.example.test/jobpost/external">External Job</a></h4>
      <a href="https://jobs.example.test/jobpost/external">Apply Now</a>
      <p>Remote</p>
      <p>India</p>
    </article>
  </main>
`

const detailPages = new Map([
  ['https://thirdeyedata.ai/jobpost/product-manager', `
    <main>
      <h3>Product Manager</h3>
      <p>Remote</p>
      <p>India</p>
      <p>Posted 3 weeks ago</p>
      <h2>Job Summary</h2>
      <p>Own the end-to-end product lifecycle for AI-powered enterprise products.</p>
      <h3>Job Features</h3>
      <h4>Job Category</h4>
      <p>Full Time</p>
      <h3>Apply Online</h3>
      <form><input name="full_name" /></form>
    </main>
  `],
  ['https://thirdeyedata.ai/jobpost/backend-java-development', `
    <main>
      <h3>Backend Java Developer</h3>
      <p>On-site</p>
      <p>Delhi, Noida, Uttar Pradesh, India</p>
      <p>Posted 8 months ago</p>
      <h2>Job Overview</h2>
      <p>Build enterprise-grade integrations with Java 8/9 and modern backend tooling.</p>
      <h3>Job Features</h3>
      <h4>Job Category</h4>
      <p>Full Time</p>
      <h3>Apply Online</h3>
      <form><input name="resume" /></form>
    </main>
  `],
  ['https://thirdeyedata.ai/jobpost/ai-sales-head', `
    <main>
      <h3>Sr. Sales Manager</h3>
      <p>Hybrid</p>
      <p>Delhi, Noida, Uttar Pradesh, India</p>
      <p>Posted 7 months ago</p>
      <h2>About the Role</h2>
      <p>Lead AI services and solutions sales efforts across India.</p>
      <h3>Job Features</h3>
      <h4>Job Category</h4>
      <p>Full Time</p>
      <h3>Apply Online</h3>
      <form><input name="linkedin_profile" /></form>
    </main>
  `],
  ['https://thirdeyedata.ai/jobpost/us-sales-executive', `
    <main>
      <h3>US Sales Executive</h3>
      <p>Hybrid</p>
      <p>California, United States</p>
      <p>Posted 7 months ago</p>
      <h2>Role Overview</h2>
      <p>Support and grow sales efforts in the United States.</p>
      <h3>Job Features</h3>
      <h4>Job Category</h4>
      <p>Full Time</p>
      <h3>Apply Online</h3>
      <form><input name="resume" /></form>
    </main>
  `],
])

test('ThirdEyeData emits only India jobpost roles from the verified public openings contract', async () => {
  const { createThirdEyeDataScraper } = await import('../../scraper/thirdeyedata/script.js')

  const jobs = await createThirdEyeDataScraper({
    now: () => '2026-07-25T10:00:00.000Z',
  }).run({
    fetchHtml: async (url) => {
      if (url === OPENINGS_URL) return openingsHtml
      return detailPages.get(url)
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    location: job.location,
    city: job.city,
    country: job.country,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    employmentType: job.employmentType,
    remoteStatus: job.remoteStatus,
    scrapedAt: job.scrapedAt,
  })), [
    {
      title: 'Product Manager',
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://thirdeyedata.ai/jobpost/product-manager',
      applyUrl: 'https://thirdeyedata.ai/jobpost/product-manager',
      employmentType: 'Full Time',
      remoteStatus: 'Remote',
      scrapedAt: '2026-07-25T10:00:00.000Z',
    },
    {
      title: 'Backend Java Developer',
      location: 'Delhi, Noida, Uttar Pradesh, India',
      city: 'Delhi, Noida, Uttar Pradesh',
      country: 'India',
      sourceUrl: 'https://thirdeyedata.ai/jobpost/backend-java-development',
      applyUrl: 'https://thirdeyedata.ai/jobpost/backend-java-development',
      employmentType: 'Full Time',
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-25T10:00:00.000Z',
    },
    {
      title: 'Sr. Sales Manager',
      location: 'Delhi, Noida, Uttar Pradesh, India',
      city: 'Delhi, Noida, Uttar Pradesh',
      country: 'India',
      sourceUrl: 'https://thirdeyedata.ai/jobpost/ai-sales-head',
      applyUrl: 'https://thirdeyedata.ai/jobpost/ai-sales-head',
      employmentType: 'Full Time',
      remoteStatus: 'Hybrid',
      scrapedAt: '2026-07-25T10:00:00.000Z',
    },
  ])
  assert.ok(jobs.every((job) => job.company === 'ThirdEyeData' && job.source === 'thirdeyedata'))
  assert.ok(jobs.every((job) => job.link === job.sourceUrl && job.link === job.applyUrl))
  assert.ok(jobs.every((job) => job.jobDescription?.length > 0))
})

test('ThirdEyeData fails closed when the verified current openings contract is absent', async () => {
  const { createThirdEyeDataScraper } = await import('../../scraper/thirdeyedata/script.js')

  const jobs = await createThirdEyeDataScraper().run({
    fetchHtml: async () => '<main><h3>Join Us</h3><a href="/jobpost/backend-java-development">Backend Java Developer</a></main>',
  })

  assert.deepEqual(jobs, [])
})
