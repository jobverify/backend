import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadElitmusModule = async () => {
  try {
    return await import('../../scraper/elitmus/script.js')
  } catch {
    return null
  }
}

const listingHtml = `
  <section class="jobs-list">
    <div class="job-card">
      <h6><a href="/jobs/33172">Associate/ Senior Associate</a></h6>
      <div>eLitmus Evaluation Pvt Ltd</div>
      <div>Full Time</div>
      <div>Bangalore, Karnataka, India</div>
      <div>2 Years to 5 Years</div>
      <h6>Event Details</h6>
      <div>Bangalore</div>
      <div>Software, Business</div>
      <a href="/jobs/33172">Show details</a>
    </div>
    <div class="job-card">
      <h6><a href="https://www.elitmus.com/jobs/software-developer-associate-consultant?job_id=33259">Software Developer/Associate consultant</a></h6>
      <div>eLitmus Evaluation Pvt Ltd</div>
      <div>Full Time</div>
      <div>Bangalore, Karnataka, India</div>
      <div>Fresher (2026)</div>
      <div>₹ 12,00,000 | Internship Stipend is ₹ 29,000 per month</div>
      <h6>Event Details</h6>
      <div>Bangalore</div>
      <div>Software Developer, Associate Consultant</div>
      <a href="/jobs/33259">Show details</a>
    </div>
  </section>
`

const experiencedDetailHtml = `
  <article>
    <a href="/jobs">See all jobs</a>
    <img alt="eLitmus Evaluation Pvt Ltd" />
    <h1>Associate/ Senior Associate</h1>
    <div>eLitmus Evaluation Pvt Ltd</div>
    <a href="https://www.elitmus.com">www.elitmus.com</a>
    <div>Full Time</div>
    <div>Bangalore, Karnataka, India</div>
    <div>2 Years to 5 Years</div>
    <div>Drive Location: Bangalore</div>
    <div>Job Roles: Software, Business</div>
    <ul>
      <li>Description</li>
    </ul>
    <section>
      <h2>About the opportunity</h2>
      <p>eLitmus is a provider of talent technology solutions.</p>
      <p>We are entering a phase to reinvent ourselves for new reality.</p>
      <h3>Job roles</h3>
      <ul>
        <li>Software /Technology roles</li>
        <li>Business roles (Customer Success / Delivery / Government certifications)</li>
      </ul>
      <h3>About the role</h3>
      <p>We are hiring for two tracks.</p>
    </section>
  </article>
`

const fresherDetailHtml = `
  <article>
    <a href="/jobs">See all jobs</a>
    <img alt="eLitmus Evaluation Pvt Ltd" />
    <h1>Software Developer/Associate consultant</h1>
    <div>eLitmus Evaluation Pvt Ltd</div>
    <a href="https://www.elitmus.com">www.elitmus.com</a>
    <div>Full Time</div>
    <div>Bangalore, Karnataka, India</div>
    <div>₹ 12,00,000 | Internship Stipend is ₹ 29,000 per month</div>
    <div>Fresher (2026)</div>
    <div>Last Date To Apply: Friday, 26th Dec, 2025</div>
    <div>Drive Date: Tuesday, 30th Dec, 2025</div>
    <div>Drive Location: eLitmus Bangalore</div>
    <div>Job Roles: Software Developer, Associate Consultant</div>
    <section>
      <h2>Job families</h2>
      <p>We are hiring for two tracks. In either track you get to be an all rounder.</p>
      <ul>
        <li>Associate Consultant</li>
        <li>Software Developer</li>
      </ul>
      <h2>What this job offers / Why look at this job?</h2>
      <ul>
        <li>Freedom</li>
        <li>Create history/ change the world</li>
      </ul>
    </section>
  </article>
`

test('buildSearchUrl keeps eLitmus on the public all jobs index', async () => {
  const elitmus = await loadElitmusModule()
  assert.ok(elitmus)

  assert.equal(
    elitmus.buildSearchUrl(),
    'https://www.elitmus.com/jobs?experience_category=all',
  )
})

test('buildDetailUrl normalizes numeric and slug/query eLitmus public detail routes', async () => {
  const elitmus = await loadElitmusModule()
  assert.ok(elitmus)

  assert.equal(
    elitmus.buildDetailUrl({ jobId: '33172' }),
    'https://www.elitmus.com/jobs/33172',
  )
  assert.equal(
    elitmus.buildDetailUrl({
      jobId: '33259',
      sourceUrl: 'https://www.elitmus.com/jobs/software-developer-associate-consultant?job_id=33259',
    }),
    'https://www.elitmus.com/jobs/33259',
  )
})

test('extractSearchResults maps eLitmus public cards into the shared listing contract', async () => {
  const elitmus = await loadElitmusModule()
  assert.ok(elitmus)

  const jobs = elitmus.extractSearchResults(listingHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Associate/ Senior Associate',
    company: 'eLitmus Evaluation Pvt Ltd',
    department: 'Software, Business',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    jobId: '33172',
    requisitionId: '33172',
    sourceUrl: 'https://www.elitmus.com/jobs/33172',
    applyUrl: 'https://www.elitmus.com/jobs/33172',
    employmentType: 'Full Time',
    experienceRequired: '2 Years to 5 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  assert.equal(jobs[1].jobId, '33259')
  assert.equal(jobs[1].sourceUrl, 'https://www.elitmus.com/jobs/33259')
})

test('extractJobDetail reads public eLitmus detail pages without assuming private apply flows', async () => {
  const elitmus = await loadElitmusModule()
  assert.ok(elitmus)

  const detail = elitmus.extractJobDetail(experiencedDetailHtml, {
    title: 'Associate/ Senior Associate',
    company: 'eLitmus Evaluation Pvt Ltd',
    department: 'Software, Business',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    jobId: '33172',
    requisitionId: '33172',
    sourceUrl: 'https://www.elitmus.com/jobs/33172',
    applyUrl: 'https://www.elitmus.com/jobs/33172',
  })

  assert.equal(detail.title, 'Associate/ Senior Associate')
  assert.equal(detail.company, 'eLitmus Evaluation Pvt Ltd')
  assert.equal(detail.location, 'Bangalore, Karnataka, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '2 Years to 5 Years')
  assert.equal(detail.postingDate, null)
  assert.equal(detail.closingDate, null)
  assert.deepEqual(detail.requiredSkills, [
    'Software /Technology roles',
    'Business roles (Customer Success / Delivery / Government certifications)',
  ])
  assert.match(detail.jobDescription, /provider of talent technology solutions/i)
  assert.equal(detail.applyUrl, 'https://www.elitmus.com/jobs/33172')
})

test('normalizeScrapedJob composes eLitmus fresher job types from public detail cues', async () => {
  const elitmus = await loadElitmusModule()
  assert.ok(elitmus)

  const detail = elitmus.extractJobDetail(fresherDetailHtml, {
    title: 'Software Developer/Associate consultant',
    company: 'eLitmus Evaluation Pvt Ltd',
    department: 'Software Developer, Associate Consultant',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    jobId: '33259',
    requisitionId: '33259',
    sourceUrl: 'https://www.elitmus.com/jobs/33259',
    applyUrl: 'https://www.elitmus.com/jobs/33259',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'elitmus',
    companyName: 'eLitmus Evaluation Pvt Ltd',
    companyCareerPage: 'https://www.elitmus.com/jobs?experience_category=all',
    atsPlatform: 'official-elitmus-jobs',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Entry Level')
  assert.equal(normalized.jobType, 'Full-time Fresher')
})

test('run fetches the public listing and detail pages and decorates shared runner fields', async () => {
  const elitmus = await loadElitmusModule()
  assert.ok(elitmus)

  const requested = []
  const scraper = elitmus.createElitmusScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requested.push(url)

      if (url === 'https://www.elitmus.com/jobs?experience_category=all') {
        return listingHtml
      }

      if (url === 'https://www.elitmus.com/jobs/33172') {
        return experiencedDetailHtml
      }

      if (url === 'https://www.elitmus.com/jobs/33259') {
        return fresherDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [
    'https://www.elitmus.com/jobs?experience_category=all',
    'https://www.elitmus.com/jobs/33172',
    'https://www.elitmus.com/jobs/33259',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'elitmus')
  assert.equal(jobs[0].company, 'eLitmus Evaluation Pvt Ltd')
  assert.equal(jobs[0].link, 'https://www.elitmus.com/jobs/33172')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
