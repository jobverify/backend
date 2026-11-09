import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Techouts | Join our Global innovation team</title>
  </head>
  <body>
    <div>Build your Future with Techouts</div>
    <script>
      window.khConfig = {
        identifier: '3ba5a10f-a9f3-413c-9853-0c55d1e34587',
        domain: 'https://techouts.keka.com/careers/',
      };
    </script>
    <div id="khembedjobs"></div>
  </body>
</html>
`

const activeJobsPayload = [
  {
    id: 126651,
    title: 'Data Engineer',
    departmentName: 'IT-Analytics',
    excerpt: 'Prepare, clean, and transform training datasets.',
    jobLocations: [
      {
        city: 'Hyderabad',
        state: 'TG',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '2-5',
    publishedOn: '2026-04-22T16:45:12.887Z',
  },
  {
    id: 126261,
    title: 'Software Engineer-Machine Learning',
    departmentName: 'IT',
    excerpt: 'Build, fine-tune, and optimize ML models for production use.',
    jobLocations: [
      {
        city: 'Hyderabad',
        state: 'TG',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '2-5',
    publishedOn: '2026-04-20T06:16:31.63Z',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/techouts/script.js')
  } catch {
    assert.fail('Expected Techouts scraper module at ../../scraper/techouts/script.js')
  }
}

test('Techouts helpers stay pinned to the verified careers shell and Keka embed payload', async () => {
  const techouts = await loadModule()

  assert.equal(techouts.SOURCE, 'techouts')
  assert.equal(techouts.COMPANY, 'Techouts')
  assert.equal(techouts.CAREERS_URL, 'https://techouts.com/careers')
  assert.equal(techouts.JOBS_API_URL, 'https://techouts.keka.com/careers/api/embedjobs/default/active/3ba5a10f-a9f3-413c-9853-0c55d1e34587')
  assert.equal(techouts.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(techouts.extractJobsFromActivePayload(activeJobsPayload).map((job) => job.title), [
    'Data Engineer',
    'Software Engineer-Machine Learning',
  ])
})

test('Techouts run returns normalized jobs from the public Keka embed payload', async () => {
  const techouts = await loadModule()
  const requestedUrls = []

  const jobs = await techouts.createTechoutsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, techouts.CAREERS_URL)
      return careersHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, techouts.JOBS_API_URL)
      return activeJobsPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    techouts.CAREERS_URL,
    techouts.JOBS_API_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].location, 'Hyderabad, Telangana, India')
  assert.equal(jobs[0].source, 'techouts')
})

test('Techouts fails closed when the verified careers shell or Keka payload changes materially', async () => {
  const techouts = await loadModule()

  await assert.rejects(
    techouts.createTechoutsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => activeJobsPayload,
    }),
    /verified Techouts careers page/i,
  )

  await assert.rejects(
    techouts.createTechoutsScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async () => [],
    }),
    /no longer exposes trusted public Keka jobs/i,
  )
})
