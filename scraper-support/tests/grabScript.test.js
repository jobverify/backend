import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T12:00:00.000Z'

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Grab your dream role</h1>
      <h2>Search Jobs</h2>
      <p>Displaying 1 to 20 of 349 matching jobs</p>
      <p>Location Cambodia China India Indonesia Malaysia Philippines Romania Singapore Thailand Vietnam</p>
      <a href="https://www.grab.careers/en/jobs/xml/?rss=true">RSS</a>

      <article>
        <h2><a href="/en/jobs/744000143509332/project-manager-grabads-solutions/">Project Manager, GrabAds Solutions</a></h2>
        <ul>
          <li>Petaling Jaya, Malaysia</li>
          <li>Advertising</li>
        </ul>
      </article>

      <article>
        <h2><a href="/en/jobs/744000143357414/senior-software-engineer-mobile-ios/">Senior Software Engineer, Mobile (iOS)</a></h2>
        <ul>
          <li>Petaling Jaya, Malaysia</li>
          <li>Engineering</li>
        </ul>
      </article>
    </main>
  </body>
</html>
`

const jobsRssXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<source>
  <publisher>Grab</publisher>
  <publisherUrl>https://www.grab.com/sg/</publisherUrl>
  <lastBuildDate>Fri, 14 Aug 2026 09:08:27 GMT</lastBuildDate>
  <job>
    <title><![CDATA[Lead Software Engineer, Backend]]></title>
    <apijobid><![CDATA[744000143229150]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000143229150/lead-software-engineer-backend/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Bangalore]]></city>
    <country><![CDATA[India]]></country>
    <category><![CDATA[Engineering]]></category>
  </job>
  <job>
    <title><![CDATA[Support Manager, People Systems]]></title>
    <apijobid><![CDATA[744000143031699]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000143031699/support-manager-people-systems/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Bangalore]]></city>
    <country><![CDATA[India]]></country>
    <category><![CDATA[Other Teams]]></category>
  </job>
  <job>
    <title><![CDATA[Solutions Specialist (EPM), Finance Systems]]></title>
    <apijobid><![CDATA[744000138554499]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000138554499/solutions-specialist-epm-finance-systems/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Bangalore]]></city>
    <country><![CDATA[India]]></country>
    <category><![CDATA[Technology Solutions]]></category>
  </job>
  <job>
    <title><![CDATA[Senior Solution Specialist, People Systems]]></title>
    <apijobid><![CDATA[744000138296534]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000138296534/senior-solution-specialist-people-systems/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Bangalore]]></city>
    <country><![CDATA[India]]></country>
    <category><![CDATA[Technology Solutions]]></category>
  </job>
  <job>
    <title><![CDATA[Project Manager, GrabAds Solutions]]></title>
    <apijobid><![CDATA[744000143509332]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000143509332/project-manager-grabads-solutions/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Petaling Jaya]]></city>
    <country><![CDATA[Malaysia]]></country>
    <category><![CDATA[Advertising]]></category>
  </job>
</source>
`

const indiaLocationHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Welcome to India!</h1>
      <p>Our teams in India are putting Fintech in the fast lane and making an impact beyond service.</p>
      <h2>Where we work from in India</h2>
      <p>Bangalore</p>
      <h2>Teams in India</h2>
      <a href="/en/teams">See all teams</a>
    </main>
  </body>
</html>
`

const indiaLocationHtmlWithLiveCardLayout = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Welcome to India!</h1>
      <p>Bangalore</p>
      <h2>Join our team in India</h2>
      <a href="/en/jobs/?orderby=0&amp;pagesize=20&amp;page=1&amp;location=Bengaluru&amp;country=India">See all jobs</a>

      <div class="grid job-listing">
        <div class="card card-job" data-id="744000109177995">
          <div class="card-body">
            <h2 class="card-title">
              <a class="stretched-link js-view-job" href="/en/jobs/744000109177995/senior-techno-functional-oracle-integration-specialist/">
                Senior Techno-Functional Oracle Integration Specialist
              </a>
            </h2>
            <ul class="list-inline job-meta">
              <li class="list-inline-item">Bengaluru, India</li>
              <li class="list-inline-item">Technology Solutions</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/grab/script.js')
  } catch {
    assert.fail('Expected Grab scraper module at ../../scraper/grab/script.js')
  }
}

test('Grab helpers stay pinned to the verified first-party jobs board, jobs RSS feed, and India location surfaces from Friday, August 14, 2026', async () => {
  const grab = await loadModule()

  assert.equal(grab.SOURCE, 'grab')
  assert.equal(grab.COMPANY, 'Grab')
  assert.equal(grab.HOMEPAGE_URL, 'https://www.grab.careers/en/')
  assert.equal(grab.JOBS_URL, 'https://www.grab.careers/jobs')
  assert.equal(grab.JOBS_RSS_URL, 'https://www.grab.careers/en/jobs/xml/?rss=true')
  assert.equal(grab.INDIA_LOCATION_URL, 'https://www.grab.careers/en/locations/india/')
  assert.equal(grab.VERIFIED_ON, '2026-08-14')
  assert.match(grab.VERIFIED_SURFACE_SUMMARY, /jobs\/xml\/\?rss=true/i)
  assert.equal(grab.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(grab.hasOfficialJobsRssSignal(jobsRssXml), true)
  assert.equal(grab.hasOfficialIndiaLocationSignal(indiaLocationHtml), true)
})

test('Grab extracts India roles from the verified RSS feed and tolerates a jobs-board first page with no India cards', async () => {
  const grab = await loadModule()
  const jobsFromBoard = grab.extractJobsFromJobsBoardHtml(jobsBoardHtml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })
  const jobsFromRss = grab.extractJobsFromJobsRssXml(jobsRssXml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })
  const jobsFromIndiaPage = grab.extractJobsFromIndiaLocationHtml(indiaLocationHtml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobsFromBoard, [])
  assert.deepEqual(jobsFromIndiaPage, [])
  assert.deepEqual(
    jobsFromRss.map((job) => [job.title, job.location, job.department, job.jobId]),
    [
      ['Lead Software Engineer, Backend', 'Bangalore, India', 'Engineering', '744000143229150'],
      ['Support Manager, People Systems', 'Bangalore, India', 'Other Teams', '744000143031699'],
      ['Solutions Specialist (EPM), Finance Systems', 'Bangalore, India', 'Technology Solutions', '744000138554499'],
      ['Senior Solution Specialist, People Systems', 'Bangalore, India', 'Technology Solutions', '744000138296534'],
    ],
  )
})

test('Grab extracts India roles from the live card layout used on the India location page', async () => {
  const grab = await loadModule()

  assert.deepEqual(
    grab.extractJobsFromIndiaLocationHtml(indiaLocationHtmlWithLiveCardLayout, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [
      {
        title: 'Senior Techno-Functional Oracle Integration Specialist',
        company: 'Grab',
        department: 'Technology Solutions',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        link: 'https://www.grab.careers/en/jobs/744000109177995/senior-techno-functional-oracle-integration-specialist/',
        applyUrl: 'https://www.grab.careers/en/jobs/744000109177995/senior-techno-functional-oracle-integration-specialist/',
        sourceUrl: 'https://www.grab.careers/en/jobs/744000109177995/senior-techno-functional-oracle-integration-specialist/',
        source: 'grab',
        jobId: '744000109177995',
        requisitionId: '744000109177995',
        employmentType: null,
        experienceRequired: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        remoteStatus: null,
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Grab run validates the verified first-party pages and returns normalized India jobs from the RSS feed when page-one HTML has none', async () => {
  const grab = await loadModule()
  const requestedUrls = []

  const jobs = await grab.createGrabScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === grab.JOBS_URL) return jobsBoardHtml
      if (url === grab.JOBS_RSS_URL) return jobsRssXml
      if (url === grab.INDIA_LOCATION_URL) return indiaLocationHtml

      throw new Error(`Unexpected Grab text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    grab.JOBS_URL,
    grab.JOBS_RSS_URL,
    grab.INDIA_LOCATION_URL,
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].title, 'Lead Software Engineer, Backend')
  assert.equal(jobs[0].companyDomain, 'grab.careers')
  assert.equal(jobs[0].companyCareerPage, 'https://www.grab.careers/jobs')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
})

test('Grab fails closed when the verified jobs board, RSS feed, or India location surface drifts, or when India jobs disappear', async () => {
  const grab = await loadModule()

  await assert.rejects(
    grab.createGrabScraper().run({
      fetchText: async (url) => {
        if (url === grab.JOBS_URL) return '<html><body><h1>Jobs</h1></body></html>'
        if (url === grab.JOBS_RSS_URL) return jobsRssXml
        return indiaLocationHtml
      },
    }),
    /verified Grab jobs board/i,
  )

  await assert.rejects(
    grab.createGrabScraper().run({
      fetchText: async (url) => {
        if (url === grab.JOBS_URL) return jobsBoardHtml
        if (url === grab.JOBS_RSS_URL) return '<source><publisher>Grab</publisher></source>'
        if (url === grab.INDIA_LOCATION_URL) return indiaLocationHtml
        throw new Error(`Unexpected Grab text URL: ${url}`)
      },
    }),
    /verified Grab jobs rss feed/i,
  )

  await assert.rejects(
    grab.createGrabScraper().run({
      fetchText: async (url) => {
        if (url === grab.JOBS_URL) return jobsBoardHtml
        if (url === grab.JOBS_RSS_URL) {
          return jobsRssXml
            .replaceAll('<country><![CDATA[India]]></country>', '<country><![CDATA[Malaysia]]></country>')
        }
        if (url === grab.INDIA_LOCATION_URL) return indiaLocationHtml
        throw new Error(`Unexpected Grab text URL: ${url}`)
      },
    }),
    /no longer exposes normalized india jobs/i,
  )
})
