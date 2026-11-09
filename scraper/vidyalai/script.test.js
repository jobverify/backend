import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Vidyalai</title>
    </head>
    <body>
      <a href="https://erp.vidyalai.com/jobs">Careers</a>
    </body>
  </html>
`

const liveHomepageHtml = `
  <html>
    <head>
      <title>Vidyalai.com: One to One Online Tuitions for IGCSE, IB, CBSE, ICSE, JEE, NEET, SAT and more.</title>
    </head>
    <body>
      <a href="http://erp.vidyalai.com/jobs">Careers</a>
    </body>
  </html>
`

const jobsPageHtml = `
  <html>
    <head>
      <title>Jobs | Vidyalai</title>
    </head>
    <body>
      <div>Showing 2 results</div>
    </body>
  </html>
`

const apiPayload = {
  data: [
    {
      name: 'JOB-001',
      job_title: 'Senior Software Engineer',
      route: 'jobs/vidyalai/senior-software-engineer',
      company: 'Vidyalai',
      department: 'Engineering',
      employment_type: 'Full-time',
      location: 'Bengaluru, India',
      status: 'Open',
    },
    {
      name: 'JOB-002',
      job_title: 'Academic Associate - Physics K12',
      route: 'academic-associate-physics-k12',
      company: 'Vidyalai',
      department: 'Academics',
      employment_type: 'Full-time',
      location: 'Remote, India',
      status: 'Open',
    },
  ],
}

const seniorSoftwareEngineerUrl = 'https://erp.vidyalai.com/jobs/vidyalai/senior-software-engineer'
const academicAssociateUrl = 'https://erp.vidyalai.com/academic-associate-physics-k12'

const seniorSoftwareEngineerHtml = `
  <html>
    <head>
      <title>Senior Software Engineer</title>
    </head>
    <body>
      <h1>Senior Software Engineer</h1>
      <p>Vidyalai</p>
      <a href="#apply">Apply Now</a>
    </body>
  </html>
`

const academicAssociateHtml = `
  <html>
    <head>
      <title>Academic Associate - Physics K12</title>
    </head>
    <body>
      <h1>Academic Associate - Physics K12</h1>
      <p>Vidyalai</p>
      <a href="#apply">Apply Now</a>
    </body>
  </html>
`

test('Vidyalai constants stay pinned to the verified homepage, jobs handoff, and filtered ERP API', async () => {
  const vidyalai = await loadModule()
  assert.ok(vidyalai, 'Vidyalai scraper module should load')

  assert.equal(vidyalai.SOURCE, 'vidyalai')
  assert.equal(vidyalai.COMPANY, 'Vidyalai')
  assert.equal(vidyalai.HOMEPAGE_URL, 'https://www.vidyalai.com/')
  assert.equal(vidyalai.JOBS_PAGE_URL, 'https://erp.vidyalai.com/jobs')
  assert.equal(
    vidyalai.JOBS_API_URL,
    'https://erp.vidyalai.com/api/resource/Job%20Opening?fields=%5B%22name%22,%22job_title%22,%22route%22,%22company%22,%22department%22,%22employment_type%22,%22location%22,%22status%22%5D&filters=%5B%5B%22company%22,%22%3D%22,%22Vidyalai%22%5D,%5B%22status%22,%22%3D%22,%22Open%22%5D%5D&limit_page_length=200',
  )
  assert.equal(vidyalai.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(vidyalai.hasOfficialHomepageSignal(liveHomepageHtml), true)
  assert.equal(vidyalai.extractJobsPageCount(jobsPageHtml), 2)
  assert.equal(
    vidyalai.buildDetailUrl('jobs/vidyalai/senior-software-engineer'),
    seniorSoftwareEngineerUrl,
  )
  assert.equal(
    vidyalai.buildDetailUrl('academic-associate-physics-k12'),
    academicAssociateUrl,
  )
  assert.equal(
    vidyalai.hasVerifiedDetailPage({
      status: 200,
      url: seniorSoftwareEngineerUrl,
      html: seniorSoftwareEngineerHtml,
    }, apiPayload.data[0]),
    true,
  )
})

test('extractOpenJobs keeps the filtered open ERP jobs and preserves routes verbatim', async () => {
  const vidyalai = await loadModule()
  assert.ok(vidyalai, 'Vidyalai scraper module should load')

  assert.deepEqual(vidyalai.extractOpenJobs(apiPayload), [
    {
      title: 'Senior Software Engineer',
      company: 'Vidyalai',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      state: null,
      country: 'India',
      jobId: 'JOB-001',
      requisitionId: 'JOB-001',
      sourceUrl: 'https://erp.vidyalai.com/jobs/vidyalai/senior-software-engineer',
      applyUrl: 'https://erp.vidyalai.com/jobs/vidyalai/senior-software-engineer',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Academic Associate - Physics K12',
      company: 'Vidyalai',
      department: 'Academics',
      location: 'Remote, India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'JOB-002',
      requisitionId: 'JOB-002',
      sourceUrl: 'https://erp.vidyalai.com/academic-associate-physics-k12',
      applyUrl: 'https://erp.vidyalai.com/academic-associate-physics-k12',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
  ])
})

test('run validates the Vidyalai homepage handoff, jobs count, filtered API payload, and detail pages', async () => {
  const vidyalai = await loadModule()
  assert.ok(vidyalai, 'Vidyalai scraper module should load')

  const requestedUrls = []
  const jobs = await vidyalai.createVidyalaiScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === vidyalai.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === vidyalai.JOBS_PAGE_URL) return { status: 200, url, html: jobsPageHtml }
      if (url === seniorSoftwareEngineerUrl) return { status: 200, url, html: seniorSoftwareEngineerHtml }
      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, vidyalai.JOBS_API_URL)
      return apiPayload
    },
    now: () => '2026-07-12T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    vidyalai.HOMEPAGE_URL,
    vidyalai.JOBS_PAGE_URL,
    vidyalai.JOBS_API_URL,
    seniorSoftwareEngineerUrl,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'vidyalai')
  assert.equal(jobs[0].link, seniorSoftwareEngineerUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-12T00:00:00.000Z')
})

test('run fails closed when the homepage handoff, jobs count, API payload, or detail page contract changes', async () => {
  const vidyalai = await loadModule()
  assert.ok(vidyalai, 'Vidyalai scraper module should load')

  await assert.rejects(
    vidyalai.createVidyalaiScraper().run({
      fetchPage: async (url) => {
        if (url === vidyalai.HOMEPAGE_URL) return { status: 200, url, html: '<html><body>Home</body></html>' }
        return { status: 200, url, html: jobsPageHtml }
      },
      fetchJson: async () => apiPayload,
    }),
    /official Vidyalai homepage/i,
  )

  await assert.rejects(
    vidyalai.createVidyalaiScraper().run({
      fetchPage: async (url) => {
        if (url === vidyalai.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === vidyalai.JOBS_PAGE_URL) return { status: 200, url, html: '<html><body>Showing 1 results</body></html>' }
        return { status: 200, url, html: seniorSoftwareEngineerHtml }
      },
      fetchJson: async () => apiPayload,
    }),
    /jobs page count/i,
  )

  await assert.rejects(
    vidyalai.createVidyalaiScraper().run({
      fetchPage: async (url) => {
        if (url === vidyalai.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === vidyalai.JOBS_PAGE_URL) return { status: 200, url, html: jobsPageHtml }
        return { status: 200, url, html: seniorSoftwareEngineerHtml }
      },
      fetchJson: async () => ({
        data: [{ ...apiPayload.data[0], status: 'Closed' }],
      }),
    }),
    /filtered public jobs api/i,
  )

  await assert.rejects(
    vidyalai.createVidyalaiScraper().run({
      fetchPage: async (url) => {
        if (url === vidyalai.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === vidyalai.JOBS_PAGE_URL) return { status: 200, url, html: jobsPageHtml }
        return { status: 200, url, html: '<html><head><title>Other</title></head><body>No apply link</body></html>' }
      },
      fetchJson: async () => apiPayload,
    }),
    /detail pages no longer match/i,
  )
})
