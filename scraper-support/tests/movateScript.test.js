import assert from 'node:assert/strict'
import test from 'node:test'

const loadMovateModule = async () => {
  try {
    return await import('../../scraper/movate/script.js')
  } catch {
    return null
  }
}

const HOMEPAGE_HTML = `
  <html>
    <head><title>Careers at Movate | Rewarding and Flexible Career Paths</title></head>
    <body>
      <h1>Careers at Movate</h1>
      <a href="https://www.movate.com/careers/latest-job-openings/">Latest Job Openings</a>
    </body>
  </html>
`

const JOBS_PAGE_HTML = `
  <html>
    <head><title>Latest Job Openings India - Movate</title></head>
    <body>
      <script>
        var arrayList = ${JSON.stringify([
          {
            job_id: 'a695e221105b23',
            job_title: 'Senior Technical Support Engineer',
            location: ['Ambit, Chennai, Tamil Nadu, India (IN_Ambit_2)'],
            location_country: 'India',
            department: 'Customer Success',
            experience: '3 - 5 Years',
            post_on_careers_page: 1,
            posted_date: '2026-07-08',
          },
          {
            job_id: 'a695e221105b24',
            job_title: 'Enterprise Sales Director',
            location: ['Dallas, Texas, United States'],
            location_country: 'United States',
            department: 'Sales',
            experience: '8 - 10 Years',
            post_on_careers_page: 1,
            posted_date: '2026-07-07',
          },
          {
            job_id: 'a695e221105b25',
            job_title: 'Hidden QA Engineer',
            location: ['Bangalore, Karnataka, India (IN_ITPL -Bangalore_6)'],
            location_country: 'India',
            department: 'Engineering',
            experience: '2 - 4 Years',
            post_on_careers_page: 0,
            posted_date: '2026-07-06',
          },
        ])};
      </script>
    </body>
  </html>
`

const DETAIL_HTML = `
  <html>
    <head><title>Job Details | Movate</title></head>
    <body>
      <h1>Latest Job Openings India</h1>
      <div class="col-md-8">
        <h5 class="mb-1">Senior Technical Support Engineer</h5>
      </div>
      <div class="border rounded-start p-3">
        <p class="text-muted mb-0 fs-13">Department</p>
        <p class="fw-medium fs-15 mb-0">Customer Success</p>
      </div>
      <div class="job-detail-desc">
        <p>Deliver enterprise support for global customers.</p>
        <p>Responsibilities:</p>
        <p>· Technical troubleshooting</p>
        <p>o Customer communication</p>
      </div>
      <div class="card job-overview">
        <div class="ms-3">
          <h6 class="fs-14 mb-2">Job Title</h6>
          <p class="text-muted mb-0">Senior Technical Support Engineer</p>
        </div>
        <div class="ms-3">
          <h6 class="fs-14 mb-2">Experience</h6>
          <p class="text-muted mb-0">3 - 5 Years</p>
        </div>
        <div class="ms-3">
          <h6 class="fs-14 mb-2">Location</h6>
          <p class="text-muted mb-0">Chennai</p>
        </div>
      </div>
      <a
        class="apply-now"
        href="https://movate.darwinbox.com/ms/candidate/candidate/login?redirect=%2Fms%2Fcandidate%2Fcareers%2Fa695e221105b23___apply%3D1"
      >
        Apply Now
      </a>
    </body>
  </html>
`

test('Movate constants stay pinned to the verified official careers and jobs pages', async () => {
  const movate = await loadMovateModule()
  assert.ok(movate)

  assert.equal(movate.HOMEPAGE_URL, 'https://www.movate.com/careers-at-movate/')
  assert.equal(movate.JOBS_PAGE_URL, 'https://www.movate.com/careers/latest-job-openings/')
  assert.equal(movate.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(movate.hasOfficialJobsPageSignal(JOBS_PAGE_HTML), true)
  assert.equal(
    movate.buildDetailUrl('a695e221105b23'),
    'https://www.movate.com/job-details/?job_id=a695e221105b23',
  )
})

test('Movate surface validators accept the verified August 3, 2026 homepage and jobs page titles', async () => {
  const movate = await loadMovateModule()
  assert.ok(movate)

  assert.equal(movate.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(movate.hasOfficialJobsPageSignal(JOBS_PAGE_HTML), true)
})

test('extractIndiaJobs keeps only visible India jobs from the embedded Movate arrayList payload', async () => {
  const movate = await loadMovateModule()
  assert.ok(movate)

  const records = movate.extractJobListData(JOBS_PAGE_HTML)
  const jobs = movate.extractIndiaJobs(records)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Technical Support Engineer',
    company: 'Movate',
    department: 'Customer Success',
    location: 'Ambit, Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: 'a695e221105b23',
    requisitionId: 'a695e221105b23',
    sourceUrl: 'https://www.movate.com/job-details/?job_id=a695e221105b23',
    applyUrl: 'https://www.movate.com/job-details/?job_id=a695e221105b23',
    employmentType: null,
    experienceRequired: '3 - 5 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-08',
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  })
})

test('extractJobDetail pulls the Movate Darwinbox apply handoff and detail description', async () => {
  const movate = await loadMovateModule()
  assert.ok(movate)

  const detail = movate.extractJobDetail(DETAIL_HTML, {
    title: 'Senior Technical Support Engineer',
    company: 'Movate',
    department: 'Customer Success',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: 'a695e221105b23',
    requisitionId: 'a695e221105b23',
    sourceUrl: movate.buildDetailUrl('a695e221105b23'),
    applyUrl: movate.buildDetailUrl('a695e221105b23'),
    employmentType: null,
    experienceRequired: '3 - 5 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-08',
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  })

  assert.equal(detail.title, 'Senior Technical Support Engineer')
  assert.equal(detail.department, 'Customer Success')
  assert.equal(detail.location, 'Chennai')
  assert.equal(detail.city, 'Chennai')
  assert.equal(detail.experienceRequired, '3 - 5 Years')
  assert.match(detail.jobDescription, /enterprise support/i)
  assert.deepEqual(detail.requiredSkills, ['Technical troubleshooting', 'Customer communication'])
  assert.equal(
    detail.applyUrl,
    'https://movate.darwinbox.com/ms/candidate/candidate/login?redirect=%2Fms%2Fcandidate%2Fcareers%2Fa695e221105b23___apply%3D1',
  )
  assert.equal(
    detail.sourceUrl,
    'https://www.movate.com/job-details/?job_id=a695e221105b23',
  )
})

test('run validates the official Movate careers surfaces and decorates shared runner fields', async () => {
  const movate = await loadMovateModule()
  assert.ok(movate)

  const requestedUrls = []
  const jobs = await movate.createMovateScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === movate.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === movate.JOBS_PAGE_URL) return JOBS_PAGE_HTML
      if (url === movate.buildDetailUrl('a695e221105b23')) return DETAIL_HTML

      throw new Error(`Unexpected Movate URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.movate.com/careers-at-movate/',
    'https://www.movate.com/careers/latest-job-openings/',
    'https://www.movate.com/job-details/?job_id=a695e221105b23',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'movate')
  assert.equal(jobs[0].company, 'Movate')
  assert.equal(
    jobs[0].link,
    'https://movate.darwinbox.com/ms/candidate/candidate/login?redirect=%2Fms%2Fcandidate%2Fcareers%2Fa695e221105b23___apply%3D1',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
