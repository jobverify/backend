import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const boardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Board</title>
  </head>
  <body>
    <h1>#DoMoreBeMore</h1>
    <h2>Open Positions</h2>
    <p id="job-count-display">0 jobs available</p>
    <h3>No jobs found</h3>
    <p>Powered by <a href="https://ainterviews.com">ainterviews.com</a></p>
    <script>
      const slug = "lenskart_ho";
      const apiBase = window.location.origin + "/api/job_board/" + slug;
    </script>
  </body>
</html>
`

const jobsApiPayload = {
  jobs: [
    {
      id: 23,
      title: 'Product Manager',
      description: '<div>Own the product roadmap and work with designers and engineers.</div>',
      location: 'Bangalore',
      salary_min: null,
      salary_max: null,
      category: 'Product',
      job_type: 'Full-time',
      experience_level: 'Mid-level',
      posted_date: '2026-07-08T09:00:00.000Z',
      application_deadline: null,
      link: null,
      apply_url: '/job_board/lenskart_ho/job/23/',
    },
    {
      id: 24,
      title: 'CEO Office',
      description: '<div>Use AI as your second brain and drive execution at speed.</div>',
      location: 'Delhi',
      salary_min: null,
      salary_max: null,
      category: 'CXO Office',
      job_type: 'Full-time',
      experience_level: 'Senior',
      posted_date: '2026-07-10T12:30:00.000Z',
      application_deadline: null,
      link: null,
      apply_url: '/job_board/lenskart_ho/job/24/',
    },
    {
      id: 44,
      title: 'Middle East Retail Leader',
      description: '<div>Lead expansion for the Middle East retail business.</div>',
      location: 'UAE',
      salary_min: null,
      salary_max: null,
      category: 'Middle East',
      job_type: 'Full-time',
      experience_level: 'Lead',
      posted_date: '2026-07-11T06:30:00.000Z',
      application_deadline: null,
      link: null,
      apply_url: '/job_board/lenskart_ho/job/44/',
    },
  ],
  filters: {
    categories: ['Product', 'CXO Office', 'Middle East'],
    locations: ['Bangalore', 'Delhi', 'UAE'],
  },
}

const loadLenskartModule = async () => {
  try {
    return await import('../../scraper/lenskart/script.js')
  } catch {
    assert.fail('Expected Lenskart scraper module at ../../scraper/lenskart/script.js')
  }
}

test('Lenskart pins the verified official board handoff and board slug', async () => {
  const lenskart = await loadLenskartModule()

  assert.equal(lenskart.SOURCE, 'lenskart')
  assert.equal(lenskart.COMPANY_NAME, 'Lenskart')
  assert.equal(lenskart.CAREERS_URL, 'https://careers.lenskart.com/')
  assert.equal(lenskart.BOARD_SLUG, 'lenskart_ho')
  assert.equal(lenskart.JOBS_API_URL, 'https://ainterviews.com/api/job_board/lenskart_ho/jobs/')
  assert.equal(lenskart.VERIFIED_ON, '2026-07-16')
  assert.equal(lenskart.hasOfficialBoardSignal(boardHtml), true)
  assert.equal(lenskart.extractBoardSlug(boardHtml), 'lenskart_ho')
})

test('Lenskart validates the official board and maps India jobs from the live board API shape', async () => {
  const lenskart = await loadLenskartModule()
  const requestedUrls = []

  const jobs = await lenskart.createLenskartScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, lenskart.CAREERS_URL)
      return boardHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, lenskart.JOBS_API_URL)
      return jobsApiPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    lenskart.CAREERS_URL,
    lenskart.JOBS_API_URL,
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Product Manager',
      company: 'Lenskart',
      department: 'Product',
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: '23',
      requisitionId: '23',
      sourceUrl: 'https://careers.lenskart.com/job_board/lenskart_ho/job/23/',
      applyUrl: 'https://careers.lenskart.com/job_board/lenskart_ho/job/23/',
      source: 'lenskart',
      link: 'https://careers.lenskart.com/job_board/lenskart_ho/job/23/',
      employmentType: 'Full-time',
      experienceRequired: null,
      publicExperienceChecked: true,
      experienceLevel: 'Mid-level',
      postingDate: '2026-07-08T09:00:00.000Z',
      jobDescription: 'Own the product roadmap and work with designers and engineers.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: 'On-site',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'CEO Office',
      company: 'Lenskart',
      department: 'CXO Office',
      location: 'Delhi',
      city: 'Delhi',
      country: 'India',
      jobId: '24',
      requisitionId: '24',
      sourceUrl: 'https://careers.lenskart.com/job_board/lenskart_ho/job/24/',
      applyUrl: 'https://careers.lenskart.com/job_board/lenskart_ho/job/24/',
      source: 'lenskart',
      link: 'https://careers.lenskart.com/job_board/lenskart_ho/job/24/',
      employmentType: 'Full-time',
      experienceRequired: null,
      publicExperienceChecked: true,
      experienceLevel: 'Senior',
      postingDate: '2026-07-10T12:30:00.000Z',
      jobDescription: 'Use AI as your second brain and drive execution at speed.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: 'On-site',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Lenskart fails closed when the verified board handoff changes', async () => {
  const lenskart = await loadLenskartModule()

  await assert.rejects(
    lenskart.createLenskartScraper().run({
      fetchText: async () => '<html><body><h1>Lenskart</h1></body></html>',
      fetchJson: async () => jobsApiPayload,
    }),
    /official board/i,
  )

  await assert.rejects(
    lenskart.createLenskartScraper().run({
      fetchText: async () => boardHtml.replace('lenskart_ho', 'another_slug'),
      fetchJson: async () => jobsApiPayload,
    }),
    /board slug/i,
  )
})
