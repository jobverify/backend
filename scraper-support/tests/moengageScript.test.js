import assert from 'node:assert/strict'
import test from 'node:test'

const loadMoEngageModule = async () => {
  try {
    return await import('../../scraper/moengage/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <html>
    <head><title>Careers at MoEngage</title></head>
    <body>
      <h1>Build your career at MoEngage</h1>
      <a href="https://moengage.hire.trakstar.com/">View open roles</a>
    </body>
  </html>
`

const boardHtml = `
  <html>
    <head><title>MoEngage Job Openings</title></head>
    <body>
      <h1>MoEngage Job Openings</h1>
      <div class="job-listing">
        <a href="/jobs/fk0zx71/">Lead Software Engineer - Data</a>
        <span>Bengaluru, India</span>
        <span>Engineering</span>
      </div>
      <div class="job-listing">
        <a href="/jobs/fk0zqq6/">Lead Support Engineer</a>
        <span>New York, United States</span>
      </div>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <head><title>Lead Software Engineer - Data | MoEngage</title></head>
    <body>
      <main>
        <h1>Lead Software Engineer - Data</h1>
        <p>MoEngage is the insights-led customer engagement platform.</p>
        <section class="job-description">
          <h2>Job Description</h2>
          <p>Build reliable data services for customer engagement.</p>
        </section>
        <p>Department: Engineering</p>
        <p>Location: Bengaluru, India</p>
      </main>
    </body>
  </html>
`

test('scrapes verified MoEngage Trakstar India listings and enriches them from verified details', async () => {
  const moengage = await loadMoEngageModule()
  assert.ok(moengage)

  const requestedUrls = []
  const jobs = await moengage.createMoEngageScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === moengage.CAREERS_PAGE_URL) return careersHtml
      if (url === moengage.BOARD_URL) return boardHtml
      if (url === 'https://moengage.hire.trakstar.com/jobs/fk0zx71/') return detailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.moengage.com/careers/',
    'https://moengage.hire.trakstar.com/',
    'https://moengage.hire.trakstar.com/jobs/fk0zx71/',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual({
    title: jobs[0].title,
    company: jobs[0].company,
    country: jobs[0].country,
    city: jobs[0].city,
    department: jobs[0].department,
    jobId: jobs[0].jobId,
    source: jobs[0].source,
    link: jobs[0].link,
    jobDescription: jobs[0].jobDescription,
  }, {
    title: 'Lead Software Engineer - Data',
    company: 'MoEngage',
    country: 'India',
    city: 'Bengaluru',
    department: 'Engineering',
    jobId: 'fk0zx71',
    source: 'moengage',
    link: 'https://moengage.hire.trakstar.com/jobs/fk0zx71/',
    jobDescription: 'Build reliable data services for customer engagement.',
  })
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('fails closed when the official careers page no longer links to the MoEngage Trakstar board', async () => {
  const moengage = await loadMoEngageModule()
  assert.ok(moengage)

  await assert.rejects(
    moengage.createMoEngageScraper().run({
      fetchText: async () => '<html><title>Careers at MoEngage</title><body>No board link</body></html>',
    }),
    /official careers page no longer links to the verified Trakstar board/i,
  )
})
