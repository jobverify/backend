import assert from 'node:assert/strict'
import test from 'node:test'

const loadBuildNextModule = async () => {
  try {
    return await import('../../scraper/buildnext/script.js')
  } catch {
    return null
  }
}

const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BuildNext Jobs</title>
    <link>https://careers.buildnext.in/jobs/</link>
    <item>
      <title>Architect</title>
      <link>http://careers.buildnext.in/jobs/architect-11/</link>
      <pubDate>Tue, 08 Jul 2026 12:30:00 +0000</pubDate>
      <description><![CDATA[Join BuildNext as an Architect.]]></description>
    </item>
    <item>
      <title>Architect</title>
      <link>https://careers.buildnext.in/jobs/architect-12/</link>
      <pubDate>Wed, 09 Jul 2026 09:15:00 +0000</pubDate>
      <description><![CDATA[Second Architect opening.]]></description>
    </item>
  </channel>
</rss>`

const DETAIL_PAGE_11 = `
  <html>
    <body>
      <article class="job_listing">
        <h1>Architect</h1>
        <div class="job_application application">
          <input class="application_button" value="Apply for job" data-apply-url="http://careers.buildnext.in/jobs/apply/79591/" />
        </div>
        <div class="job_listing-location">Bengaluru, Karnataka, India</div>
        <div class="job_description">
          <p>Design residential projects with the BuildNext platform.</p>
        </div>
      </article>
    </body>
  </html>`

const DETAIL_PAGE_12 = `
  <html>
    <body>
      <article class="job_listing">
        <h1>Architect</h1>
        <a class="application_button" href="/jobs/apply/79592/">Apply for job</a>
        <div class="job_listing-location">Hyderabad, Telangana, India</div>
        <div class="job_description">
          <p>Lead customer-facing architecture workshops.</p>
        </div>
      </article>
    </body>
  </html>`

test('extractFeedItems parses the official BuildNext jobs feed and normalizes source URLs to https', async () => {
  const buildNext = await loadBuildNextModule()
  assert.ok(buildNext, 'Expected BuildNext scraper module at ../../scraper/buildnext/script.js')

  assert.equal(buildNext.SOURCE, 'buildnext')
  assert.equal(buildNext.COMPANY, 'BuildNext Construction Solutions (P) Ltd')
  assert.equal(buildNext.CAREERS_PAGE_URL, 'https://careers.buildnext.in/jobs/')
  assert.equal(buildNext.JOBS_FEED_URL, 'https://careers.buildnext.in/jobs/feed/')

  const jobs = buildNext.extractFeedItems(FEED_XML)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Architect',
    company: 'BuildNext Construction Solutions (P) Ltd',
    department: null,
    location: null,
    city: null,
    country: 'India',
    jobId: '11',
    requisitionId: '11',
    sourceUrl: 'https://careers.buildnext.in/jobs/architect-11/',
    applyUrl: null,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-08T12:30:00.000Z',
    closingDate: null,
    jobDescription: 'Join BuildNext as an Architect.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].jobId, '12')
  assert.equal(jobs[1].sourceUrl, 'https://careers.buildnext.in/jobs/architect-12/')
})

test('run fetches the public BuildNext jobs feed, enriches detail pages, and exposes public apply URLs', async () => {
  const buildNext = await loadBuildNextModule()
  assert.ok(buildNext, 'Expected BuildNext scraper module at ../../scraper/buildnext/script.js')

  const requestedUrls = []
  const jobs = await buildNext.createBuildNextScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buildNext.JOBS_FEED_URL) return FEED_XML
      if (url === 'https://careers.buildnext.in/jobs/architect-11/') return DETAIL_PAGE_11
      if (url === 'https://careers.buildnext.in/jobs/architect-12/') return DETAIL_PAGE_12

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildNext.JOBS_FEED_URL,
    'https://careers.buildnext.in/jobs/architect-11/',
    'https://careers.buildnext.in/jobs/architect-12/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'buildnext')
  assert.equal(jobs[0].link, 'https://careers.buildnext.in/jobs/apply/79591/')
  assert.equal(jobs[0].applyUrl, 'https://careers.buildnext.in/jobs/apply/79591/')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.match(jobs[0].jobDescription, /Design residential projects/i)
  assert.equal(jobs[1].applyUrl, 'https://careers.buildnext.in/jobs/apply/79592/')
  assert.equal(jobs[1].location, 'Hyderabad, Telangana, India')
  assert.equal(jobs[1].city, 'Hyderabad')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
