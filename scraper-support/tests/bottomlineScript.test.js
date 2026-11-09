import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Open Roles | Bottomline Careers</title>
  </head>
  <body>
    <h1>Current Job Openings</h1>
    <script>
      const jobList = [
        {
          "absolute_url": "https://job-boards.greenhouse.io/bottomlinetechnologies/jobs/8001",
          "id": 8001,
          "requisition_id": "BLR-8001",
          "title": "Accounting Operations Data Engineer",
          "location": { "name": "Bengaluru, Karnataka, India" },
          "departments": [{ "name": "Engineering" }],
          "offices": [{ "location": "Bengaluru, Karnataka, India" }],
          "metadata": [{ "name": "Country", "value": ["India"] }],
          "content": "<p>Build data pipelines.</p>",
          "updated_at": "2026-07-18T10:00:00Z"
        },
        {
          "absolute_url": "https://job-boards.greenhouse.io/bottomlinetechnologies/jobs/8002",
          "id": 8002,
          "requisition_id": "BLR-8002",
          "title": "Software Engineer",
          "location": { "name": "Pune, Maharashtra, India" },
          "departments": [{ "name": "Engineering" }],
          "offices": [{ "location": "Pune, Maharashtra, India" }],
          "metadata": [{ "name": "Country", "value": ["India"] }],
          "content": "<p>Build payment products.</p>",
          "updated_at": "2026-07-18T11:00:00Z"
        },
        {
          "absolute_url": "https://job-boards.greenhouse.io/bottomlinetechnologies/jobs/8003",
          "id": 8003,
          "requisition_id": "BLR-8003",
          "title": "US Sales Manager",
          "location": { "name": "Portland, Oregon, United States" },
          "departments": [{ "name": "Sales" }],
          "offices": [{ "location": "Portland, Oregon, United States" }],
          "metadata": [{ "name": "Country", "value": ["United States"] }],
          "content": "<p>Lead US sales.</p>",
          "updated_at": "2026-07-18T12:00:00Z"
        }
      ]
    </script>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/bottomline/script.js')
  } catch {
    assert.fail('Expected Bottomline scraper module at ../../scraper/bottomline/script.js')
  }
}

test('Bottomline scraper keeps only India roles from the first-party inline jobList payload', async () => {
  const bottomline = await loadScriptModule()

  assert.equal(bottomline.SOURCE, 'bottomline')
  assert.equal(bottomline.COMPANY, 'Bottomline')
  assert.equal(bottomline.VERIFIED_ON, '2026-07-18')
  assert.equal(bottomline.CAREERS_URL, 'https://www.bottomline.com/about/careers/jobs')
  assert.equal(bottomline.hasVerifiedCareersPageSignal(careersHtml), true)

  const parsedJobs = bottomline.parseInlineJobList(careersHtml)
  assert.equal(parsedJobs.length, 3)
  assert.equal(bottomline.isIndiaJob(parsedJobs[0]), true)
  assert.equal(bottomline.isIndiaJob(parsedJobs[1]), true)
  assert.equal(bottomline.isIndiaJob(parsedJobs[2]), false)

  const jobs = await bottomline.createBottomlineScraper().run({
    fetchPage: async (url) => ({ status: 200, url, html: careersHtml }),
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.country]),
    [
      ['Accounting Operations Data Engineer', 'Bengaluru, Karnataka, India', 'Engineering', 'India'],
      ['Software Engineer', 'Pune, Maharashtra, India', 'Engineering', 'India'],
    ],
  )
})

test('Bottomline scraper fails closed when the first-party inline jobList surface drifts', async () => {
  const bottomline = await loadScriptModule()

  await assert.rejects(
    bottomline.createBottomlineScraper().run({
      fetchPage: async () => ({ status: 200, url: bottomline.CAREERS_URL, html: '<title>Unexpected</title>' }),
    }),
    /trusted first-party jobs surface/i,
  )

  await assert.rejects(
    bottomline.createBottomlineScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: bottomline.CAREERS_URL,
        html: '<title>Explore Open Roles | Bottomline Careers</title><h1>Current Job Openings</h1><script>const jobList = []</script>',
      }),
    }),
    /no longer exposes India jobs/i,
  )
})
