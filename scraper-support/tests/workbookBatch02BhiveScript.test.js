import assert from 'node:assert/strict'
import test from 'node:test'

const loadBhiveModule = async () => {
  try {
    return await import('../../scraper/bhive/script.js')
  } catch {
    assert.fail('Expected Bhive scraper module at ../../scraper/bhive/script.js')
  }
}

const officialJobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - BHIVE Careers</title>
  </head>
  <body>
    <main>
      <h1>Jobs</h1>
      <p>Explore our all jobs</p>
      <article>
        <h3>Multi – Skilled Technician</h3>
        <p>BHIVE Workspace</p>
        <p>Bangalore</p>
      </article>
      <button type="button">Load More</button>
    </main>
  </body>
</html>
`

const jobsApiPayload = [
  {
    id: 1841,
    date_gmt: '2026-07-23T07:32:51',
    slug: 'multi-skilled-technician',
    status: 'publish',
    type: 'jobs',
    link: 'https://bhive.careers/jobs/multi-skilled-technician/',
    title: {
      rendered: 'Multi – Skilled Technician',
    },
    content: {
      rendered: `
        <p>The Multi-Skilled Technician is responsible for carrying out preventive, corrective, and reactive maintenance of building facilities and equipment.</p>
        <p>Key Responsibilities:</p>
        <ul>
          <li>Perform routine inspection, maintenance, and repair of facility equipment.</li>
          <li>Diagnose issues and troubleshoot breakdowns across multiple technical trades.</li>
        </ul>
      `,
    },
    _embedded: {
      'wp:term': [
        [
          {
            taxonomy: 'department',
            name: 'Facilities and Operations',
            slug: 'facilities-and-operations',
          },
        ],
        [
          {
            taxonomy: 'location',
            name: 'Bangalore',
            slug: 'bangalore',
          },
        ],
        [
          {
            taxonomy: 'entity',
            name: 'BHIVE Workspace',
            slug: 'bhive-workspace',
          },
        ],
        [
          {
            taxonomy: 'experience',
            name: '3 - 5 Years',
            slug: '3-5-years',
          },
        ],
      ],
    },
  },
]

test('Bhive pins the verified first-party jobs page and first-party WordPress jobs API', async () => {
  const bhive = await loadBhiveModule()

  assert.equal(bhive.SOURCE, 'bhive')
  assert.equal(bhive.COMPANY, 'Bhive')
  assert.equal(bhive.VERIFIED_ON, '2026-07-30')
  assert.equal(bhive.CAREERS_URL, 'https://bhive.careers/jobs/')
  assert.equal(bhive.JOBS_API_URL, 'https://bhive.careers/wp-json/wp/v2/jobs')
  assert.equal(bhive.hasOfficialJobsPageSignal(officialJobsPageHtml), true)
})

test('Bhive run validates the first-party jobs page and maps the public WordPress jobs payload', async () => {
  const bhive = await loadBhiveModule()
  const requestedUrls = []

  const jobs = await bhive.createBhiveScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === bhive.CAREERS_URL) return officialJobsPageHtml
      throw new Error(`Unexpected Bhive text fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://bhive.careers/wp-json/wp/v2/jobs?per_page=100&page=1&_embed=wp%3Aterm') {
        return jobsApiPayload
      }
      throw new Error(`Unexpected Bhive JSON fixture URL: ${url}`)
    },
    now: () => '2026-07-30T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    bhive.CAREERS_URL,
    'https://bhive.careers/wp-json/wp/v2/jobs?per_page=100&page=1&_embed=wp%3Aterm',
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Multi - Skilled Technician',
      company: 'Bhive',
      department: 'Facilities and Operations',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      link: 'https://bhive.careers/jobs/multi-skilled-technician/',
      applyUrl: 'https://bhive.careers/jobs/multi-skilled-technician/',
      sourceUrl: 'https://bhive.careers/jobs/multi-skilled-technician/',
      source: 'bhive',
      jobId: '1841',
      requisitionId: '1841',
      employmentType: null,
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-23T07:32:51Z',
      closingDate: null,
      jobDescription:
        'The Multi-Skilled Technician is responsible for carrying out preventive, corrective, and reactive maintenance of building facilities and equipment. Key Responsibilities: Perform routine inspection, maintenance, and repair of facility equipment. Diagnose issues and troubleshoot breakdowns across multiple technical trades.',
      remoteStatus: null,
      scrapedAt: '2026-07-30T00:00:00.000Z',
    },
  ])
})

test('Bhive fails closed when the verified jobs page or API contract changes', async () => {
  const bhive = await loadBhiveModule()

  await assert.rejects(
    bhive.createBhiveScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
      fetchJson: async () => jobsApiPayload,
    }),
    /verified first-party jobs page/i,
  )

  await assert.rejects(
    bhive.createBhiveScraper().run({
      fetchText: async () => officialJobsPageHtml,
      fetchJson: async () => ({ jobs: [] }),
    }),
    /jobs api no longer returns an array/i,
  )
})
