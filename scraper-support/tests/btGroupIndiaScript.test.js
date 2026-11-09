import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const officialAboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>BT corporate website | BT</title>
  </head>
  <body>
    <nav>
      <a href="https://jobs.bt.com/">Careers</a>
    </nav>
    <main>
      <h1>We connect for good</h1>
      <a href="https://jobs.bt.com/">For a career less ordinary, join us</a>
    </main>
  </body>
</html>
`

const careersLandingPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>BT Group Careers</title>
  </head>
  <body>
    <h1>BT Group Careers</h1>
    <a href="/search/">Search roles</a>
  </body>
</html>
`

const indiaSearchPageHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>India - BT Group Jobs</title>
  </head>
  <body>
    <form class="searchwell">
      <input name="locationsearch" value="India" />
    </form>
    <script>
      j2w.init({
        locale: 'en_GB',
        locationsearch: 'India'
      });
    </script>
  </body>
</html>
`

const jobsFeedXml = `
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Careers | BT Group Plc</title>
    <description>Apply online for BT Group roles.</description>
    <item>
      <title>Software Engineering Professional (Bengaluru, IN, 560103)</title>
      <description><![CDATA[
        &lt;p&gt;Job Req ID: 60498&lt;/p&gt;
        &lt;p&gt;Posting Date: 14th July,2026&lt;/p&gt;
        &lt;p&gt;Function: Software Engineering&lt;/p&gt;
        &lt;p&gt;Location: Bengaluru&lt;/p&gt;
        &lt;ul&gt;&lt;li&gt;Java&lt;/li&gt;&lt;li&gt;Spring Boot&lt;/li&gt;&lt;/ul&gt;
        &lt;p&gt;Build backend services for BT platforms.&lt;/p&gt;
      ]]></description>
      <link>https://jobs.bt.com/BT/job/Bengaluru-Software-Engineering-Professional-560103/1366481557/</link>
      <guid isPermaLink="false">1366481557</guid>
      <g:id>1366481557</g:id>
      <g:expiration_date>2026-08-13</g:expiration_date>
      <g:employer>British Telecommunications PLC</g:employer>
      <g:job_function>Software Engineering</g:job_function>
      <g:salary>669000.00</g:salary>
      <g:location>Bengaluru, IN, 560103</g:location>
    </item>
    <item>
      <title>Procurement Manager (Gurugram, IN, 122002)</title>
      <description><![CDATA[
        &lt;p&gt;Job Req ID: 60501&lt;/p&gt;
        &lt;p&gt;Posting Date: 14th July,2026&lt;/p&gt;
        &lt;p&gt;Function: Procurement and Supply Chain&lt;/p&gt;
        &lt;p&gt;Location: Gurugram&lt;/p&gt;
        &lt;ul&gt;&lt;li&gt;Strategic sourcing&lt;/li&gt;&lt;li&gt;Supplier management&lt;/li&gt;&lt;/ul&gt;
        &lt;p&gt;Lead RFx activity and procurement planning.&lt;/p&gt;
      ]]></description>
      <link>https://jobs.bt.com/BT/job/Gurugram-Procurement-Manager-122002/1366552957/</link>
      <guid isPermaLink="false">1366552957</guid>
      <g:id>1366552957</g:id>
      <g:expiration_date>2026-08-13</g:expiration_date>
      <g:employer>British Telecommunications PLC</g:employer>
      <g:job_function>Procurement and Supply Chain</g:job_function>
      <g:salary>1225000.00</g:salary>
      <g:location>Gurugram, IN, 122002</g:location>
    </item>
    <item>
      <title>Security Contract Delivery Professional (GB)</title>
      <description><![CDATA[
        &lt;p&gt;Job Req ID: 58855&lt;/p&gt;
        &lt;p&gt;Posting Date: 2nd July 2026&lt;/p&gt;
        &lt;p&gt;Function: Cyber Security&lt;/p&gt;
        &lt;p&gt;Location: Manchester&lt;/p&gt;
      ]]></description>
      <link>https://jobs.bt.com/BTGroup/job/Security-Contract-Delivery-Professional/1365476957/</link>
      <guid isPermaLink="false">1365476957</guid>
      <g:id>1365476957</g:id>
      <g:expiration_date>2026-08-13</g:expiration_date>
      <g:employer>British Telecommunications PLC</g:employer>
      <g:job_function>Cyber Security</g:job_function>
      <g:salary>43499.00</g:salary>
      <g:location>GB</g:location>
    </item>
  </channel>
</rss>
`

const loadBtGroupIndiaModule = async () => {
  try {
    return await import('../../scraper/btgroupindia/script.js')
  } catch {
    assert.fail('Expected BT Group India scraper module at ../../scraper/btgroupindia/script.js')
  }
}

test('BT Group India scraper stays pinned to the verified first-party handoff and RSS jobs feed contract', async () => {
  const btGroupIndia = await loadBtGroupIndiaModule()

  assert.equal(btGroupIndia.COMPANY_NAME, 'BT Group India')
  assert.equal(btGroupIndia.SOURCE, 'btgroupindia')
  assert.equal(btGroupIndia.OFFICIAL_ABOUT_URL, 'https://www.bt.com/about')
  assert.equal(btGroupIndia.CAREERS_LANDING_PAGE_URL, 'https://jobs.bt.com/')
  assert.equal(
    btGroupIndia.INDIA_SEARCH_URL,
    'https://jobs.bt.com/search/?createNewAlert=false&q=&locationsearch=India',
  )
  assert.equal(btGroupIndia.SITEMAP_URL, 'https://jobs.bt.com/sitemap.xml')
  assert.equal(btGroupIndia.JOBS_FEED_URL, 'https://jobs.bt.com/sitemap_index.xml')
  assert.equal(
    btGroupIndia.VERIFIED_INDIA_JOB_URL,
    'https://jobs.bt.com/BT/job/Bengaluru-Software-Engineering-Professional-560103/1366481557/',
  )
  assert.equal(btGroupIndia.extractCareersHandoffUrl(officialAboutPageHtml), 'https://jobs.bt.com/')
  assert.equal(btGroupIndia.hasOfficialAboutPageSignal(officialAboutPageHtml), true)
  assert.equal(btGroupIndia.hasCareersLandingPageSignal(careersLandingPageHtml), true)
  assert.equal(btGroupIndia.hasIndiaSearchSignal(indiaSearchPageHtml), true)
  assert.equal(btGroupIndia.hasJobsFeedSignal(jobsFeedXml), true)
  assert.equal(btGroupIndia.extractFeedItems(jobsFeedXml).length, 3)

  const jobs = btGroupIndia.extractJobsFromFeed(jobsFeedXml, FIXED_SCRAPED_AT)
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      department: job.department,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      postingDate: job.postingDate,
      closingDate: job.closingDate,
      requiredSkills: job.requiredSkills,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Software Engineering Professional',
        company: 'BT Group India',
        department: 'Software Engineering',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        jobId: '1366481557',
        requisitionId: '60498',
        sourceUrl: 'https://jobs.bt.com/BT/job/Bengaluru-Software-Engineering-Professional-560103/1366481557/',
        applyUrl: 'https://jobs.bt.com/BT/job/Bengaluru-Software-Engineering-Professional-560103/1366481557/',
        postingDate: '2026-07-14',
        closingDate: '2026-08-13',
        requiredSkills: ['Java', 'Spring Boot'],
        source: 'btgroupindia',
        link: 'https://jobs.bt.com/BT/job/Bengaluru-Software-Engineering-Professional-560103/1366481557/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Procurement Manager',
        company: 'BT Group India',
        department: 'Procurement and Supply Chain',
        location: 'Gurugram, India',
        city: 'Gurugram',
        country: 'India',
        jobId: '1366552957',
        requisitionId: '60501',
        sourceUrl: 'https://jobs.bt.com/BT/job/Gurugram-Procurement-Manager-122002/1366552957/',
        applyUrl: 'https://jobs.bt.com/BT/job/Gurugram-Procurement-Manager-122002/1366552957/',
        postingDate: '2026-07-14',
        closingDate: '2026-08-13',
        requiredSkills: ['Strategic sourcing', 'Supplier management'],
        source: 'btgroupindia',
        link: 'https://jobs.bt.com/BT/job/Gurugram-Procurement-Manager-122002/1366552957/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Build backend services for BT platforms\./i)
  assert.match(jobs[1].jobDescription, /Lead RFx activity and procurement planning\./i)
})

test('run verifies the BT careers handoff pages before extracting India jobs from the first-party RSS feed', async () => {
  const btGroupIndia = await loadBtGroupIndiaModule()
  const requestedUrls = []

  const jobs = await btGroupIndia.createBtGroupIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === btGroupIndia.OFFICIAL_ABOUT_URL) return officialAboutPageHtml
      if (url === btGroupIndia.CAREERS_LANDING_PAGE_URL) return careersLandingPageHtml
      if (url === btGroupIndia.INDIA_SEARCH_URL) return indiaSearchPageHtml
      if (url === btGroupIndia.JOBS_FEED_URL) return jobsFeedXml

      throw new Error(`Unexpected BT Group India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    btGroupIndia.OFFICIAL_ABOUT_URL,
    btGroupIndia.CAREERS_LANDING_PAGE_URL,
    btGroupIndia.INDIA_SEARCH_URL,
    btGroupIndia.JOBS_FEED_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'btgroupindia')
  assert.equal(jobs[0].company, 'BT Group India')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].city, 'Gurugram')
})

test('BT Group India scraper fails closed when the verified handoff or first-party jobs feed drifts', async () => {
  const btGroupIndia = await loadBtGroupIndiaModule()

  await assert.rejects(
    btGroupIndia.createBtGroupIndiaScraper().run({
      fetchText: async (url) => {
        if (url === btGroupIndia.OFFICIAL_ABOUT_URL) {
          return '<html><body><h1>BT</h1><a href="https://example.com/jobs">Careers</a></body></html>'
        }

        throw new Error(`Unexpected BT Group India URL: ${url}`)
      },
    }),
    /verified BT corporate careers handoff|official BT about page/i,
  )

  await assert.rejects(
    btGroupIndia.createBtGroupIndiaScraper().run({
      fetchText: async (url) => {
        if (url === btGroupIndia.OFFICIAL_ABOUT_URL) return officialAboutPageHtml
        if (url === btGroupIndia.CAREERS_LANDING_PAGE_URL) return careersLandingPageHtml
        if (url === btGroupIndia.INDIA_SEARCH_URL) return indiaSearchPageHtml
        if (url === btGroupIndia.JOBS_FEED_URL) return '<xml><broken /></xml>'

        throw new Error(`Unexpected BT Group India URL: ${url}`)
      },
    }),
    /verified BT jobs feed/i,
  )
})
