import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at HGS India | Customer Service &amp; Tech Jobs</title>
    <link rel="canonical" href="https://www.joinhgs.com/in/en" />
  </head>
  <body>
    <main>
      <h1>Careers at HGS</h1>
      <p>Your ideas are heard. Your impact is visible. Your work matters.</p>
      <a href="https://careers.joinhgs.com/India/go/BPM-Jobs-India/7947010/">BPM Jobs</a>
      <a href="https://careers.joinhgs.com/India/go/Digital-Data-And-Analytics-Jobs-India/7947110/">Digital Data &amp; Analytics Jobs</a>
      <div>current-openings?search_job={search_term_string}</div>
    </main>
  </body>
</html>
`

const bpmCategoryHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Customer Service Jobs in India | BPO Jobs | JoinHGS India Careers</title>
  </head>
  <body>
    <h1>BPM Jobs India</h1>
    <div>Search Jobs</div>
    <a href="https://careers.joinhgs.com/services/rss/category/?catid=7947010">RSS</a>
  </body>
</html>
`

const digitalCategoryHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IT Sector Jobs in India |Technology Jobs |JoinHGS India Careers</title>
  </head>
  <body>
    <h1>Digital Data and Analytics</h1>
    <div>Search Jobs</div>
    <a href="https://careers.joinhgs.com/services/rss/category/?catid=7947110">RSS</a>
  </body>
</html>
`

const bpmFeedXml = `
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <atom:link href="https://careers.joinhgs.com/xml/category7947010.xml" rel="self" type="application/rss+xml" />
    <title>Hinduja Global Solutions Ltd - BPM Jobs India</title>
    <link>https://careers.joinhgs.com/go/BPM-Jobs-India/7947010/</link>
    <description>Looking for customer service jobs in India? HGS hires for customer support jobs with great benefits, training, and growth.</description>
    <item>
      <title><![CDATA[Process Consultant (Hyderabad, TG, IN, 500019)]]></title>
      <description><![CDATA[
        <p>Designation: Process Consultant</p>
        <p>Department: Operations</p>
        <p>Experience: 2+ years</p>
        <p>Work Location: The Square, 110 Financial District, Gachibowli, Hyderabad</p>
        <p>Night shift and rotational weekly off.</p>
      ]]></description>
      <pubDate>Wed, 15 Jul 2026 16:00:00 GMT</pubDate>
      <link>https://careers.joinhgs.com/India/job/Hyderabad-Process-Consultant-TG-500019/1362905766/?feedId=null&amp;utm_source=J2WRSS&amp;utm_medium=rss&amp;utm_campaign=J2W_RSS</link>
      <guid>https://careers.joinhgs.com/India/job/Hyderabad-Process-Consultant-TG-500019/1362905766/?feedId=null&amp;utm_source=J2WRSS&amp;utm_medium=rss&amp;utm_campaign=J2W_RSS</guid>
    </item>
    <item>
      <title><![CDATA[Videographer (Navi Mumbai, MH, IN, 400705)]]></title>
      <description><![CDATA[
        <p>Position: Videographer</p>
        <p>Department: Creative / Brand &amp; Design</p>
        <p>Exp: More than 3 years</p>
        <p>Location: 3 days Vashi and 2 days BKC</p>
      ]]></description>
      <pubDate>Thu, 16 Jul 2026 00:00:00 GMT</pubDate>
      <link>https://careers.joinhgs.com/India/job/Navi-Mumbai-Videographer-MH-400705/1364403766/?feedId=null&amp;utm_source=J2WRSS&amp;utm_medium=rss&amp;utm_campaign=J2W_RSS</link>
      <guid>https://careers.joinhgs.com/India/job/Navi-Mumbai-Videographer-MH-400705/1364403766/?feedId=null&amp;utm_source=J2WRSS&amp;utm_medium=rss&amp;utm_campaign=J2W_RSS</guid>
    </item>
  </channel>
</rss>
`

const digitalFeedXml = `
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <atom:link href="https://careers.joinhgs.com/xml/category7947110.xml" rel="self" type="application/rss+xml" />
    <title>Hinduja Global Solutions Ltd - Digital Data And Analytics Jobs India</title>
    <link>https://careers.joinhgs.com/go/Digital-Data-And-Analytics-Jobs-India/7947110/</link>
    <description>Join HGS for technology and analytics jobs in India.</description>
    <item>
      <title><![CDATA[SAC Planning Consultant (HYDERABAD, TG, IN, 500032)]]></title>
      <description><![CDATA[
        <p>Job Title: SAC Planning Consultant</p>
        <p>Department: Digital Data &amp; Analytics</p>
        <p>Experience: 4+ years</p>
        <p>Location: Hyderabad</p>
        <p>Work with SAP Analytics Cloud planning solutions.</p>
      ]]></description>
      <pubDate>Wed, 15 Jul 2026 16:00:00 GMT</pubDate>
      <link>https://careers.joinhgs.com/India/job/HYDERABAD-SAC-Planning-Consultant-TG-500032/1362905566/?feedId=null&amp;utm_source=J2WRSS&amp;utm_medium=rss&amp;utm_campaign=J2W_RSS</link>
      <guid>https://careers.joinhgs.com/India/job/HYDERABAD-SAC-Planning-Consultant-TG-500032/1362905566/?feedId=null&amp;utm_source=J2WRSS&amp;utm_medium=rss&amp;utm_campaign=J2W_RSS</guid>
    </item>
  </channel>
</rss>
`

const loadHgsModule = async () => {
  try {
    return await import('../../scraper/hindujaglobalservices/script.js')
  } catch {
    assert.fail('Expected Hinduja Global Services scraper module at ../../scraper/hindujaglobalservices/script.js')
  }
}

test('Hinduja Global Services pins the verified first-party landing, category pages, and RSS feed constants', async () => {
  const hgs = await loadHgsModule()

  assert.equal(hgs.SOURCE, 'hindujaglobalservices')
  assert.equal(hgs.COMPANY_NAME, 'Hinduja Global Services')
  assert.equal(hgs.OFFICIAL_BRAND_NAME, 'Hinduja Global Solutions Ltd')
  assert.equal(hgs.CAREERS_URL, 'https://www.joinhgs.com/in/en')
  assert.equal(
    hgs.BPM_CATEGORY_PAGE_URL,
    'https://careers.joinhgs.com/India/go/BPM-Jobs-India/7947010/',
  )
  assert.equal(
    hgs.DIGITAL_CATEGORY_PAGE_URL,
    'https://careers.joinhgs.com/India/go/Digital-Data-And-Analytics-Jobs-India/7947110/',
  )
  assert.equal(
    hgs.BPM_JOBS_RSS_URL,
    'https://careers.joinhgs.com/services/rss/category/?catid=7947010',
  )
  assert.equal(
    hgs.DIGITAL_JOBS_RSS_URL,
    'https://careers.joinhgs.com/services/rss/category/?catid=7947110',
  )
  assert.equal(hgs.hasOfficialCareersLandingSignal(officialCareersHtml), true)
  assert.equal(hgs.hasBpmCategoryPageSignal(bpmCategoryHtml), true)
  assert.equal(hgs.hasDigitalCategoryPageSignal(digitalCategoryHtml), true)
  assert.equal(hgs.hasJobsRssSignal(bpmFeedXml, hgs.BPM_JOBS_RSS_URL), true)
  assert.equal(hgs.hasJobsRssSignal(digitalFeedXml, hgs.DIGITAL_JOBS_RSS_URL), true)
})

test('Hinduja Global Services normalizes first-party RSS items into India jobs and strips feed tracking parameters', async () => {
  const hgs = await loadHgsModule()

  const jobs = hgs.extractIndiaJobsFromFeed(bpmFeedXml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Process Consultant',
      company: 'Hinduja Global Services',
      department: 'Operations',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '1362905766',
      requisitionId: '1362905766',
      sourceUrl: 'https://careers.joinhgs.com/India/job/Hyderabad-Process-Consultant-TG-500019/1362905766/',
      applyUrl: 'https://careers.joinhgs.com/India/job/Hyderabad-Process-Consultant-TG-500019/1362905766/',
      employmentType: null,
      experienceRequired: '2+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15T16:00:00.000Z',
      closingDate: null,
      jobDescription: 'Designation: Process Consultant Department: Operations Experience: 2+ years Work Location: The Square, 110 Financial District, Gachibowli, Hyderabad Night shift and rotational weekly off.',
      remoteStatus: 'On-site',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Videographer',
      company: 'Hinduja Global Services',
      department: 'Creative / Brand & Design',
      location: 'Navi Mumbai, Maharashtra, India',
      city: 'Navi Mumbai',
      country: 'India',
      jobId: '1364403766',
      requisitionId: '1364403766',
      sourceUrl: 'https://careers.joinhgs.com/India/job/Navi-Mumbai-Videographer-MH-400705/1364403766/',
      applyUrl: 'https://careers.joinhgs.com/India/job/Navi-Mumbai-Videographer-MH-400705/1364403766/',
      employmentType: null,
      experienceRequired: 'More than 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-16T00:00:00.000Z',
      closingDate: null,
      jobDescription: 'Position: Videographer Department: Creative / Brand & Design Exp: More than 3 years Location: 3 days Vashi and 2 days BKC',
      remoteStatus: 'On-site',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('HGS accepts the ATS no-jobs item for an empty category without creating a job', async () => {
  const hgs = await loadHgsModule()
  const xml = `<?xml version="1.0"?><rss><channel><atom:link href='https://careers.joinhgs.com/xml/category7947110.xml'/><title>Hinduja Global Solutions Ltd - Digital Data And Analytics Jobs India</title><item><title>No jobs currently available - Check out our other opportunities.</title><description>Click above to see other opportunities</description><link>https://careers.joinhgs.com</link><guid isPermaLink='false'>0</guid></item></channel></rss>`
  assert.equal(hgs.hasJobsRssSignal(xml, hgs.DIGITAL_JOBS_RSS_URL), true)
  assert.deepEqual(hgs.extractIndiaJobsFromFeed(xml), [])
  assert.equal(hgs.hasJobsRssSignal(xml.replace('<guid isPermaLink=\'false\'>0</guid>', '<guid>123</guid>'), hgs.DIGITAL_JOBS_RSS_URL), false)
})

test('Hinduja Global Services run validates the official pages before merging both linked RSS feeds', async () => {
  const hgs = await loadHgsModule()
  const requestedUrls = []

  const jobs = await hgs.createHindujaGlobalServicesScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === hgs.CAREERS_URL) return officialCareersHtml
      if (url === hgs.BPM_CATEGORY_PAGE_URL) return bpmCategoryHtml
      if (url === hgs.DIGITAL_CATEGORY_PAGE_URL) return digitalCategoryHtml
      if (url === hgs.BPM_JOBS_RSS_URL) return bpmFeedXml
      if (url === hgs.DIGITAL_JOBS_RSS_URL) return digitalFeedXml
      throw new Error(`Unexpected HGS fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    'https://www.joinhgs.com/in/en',
    'https://careers.joinhgs.com/India/go/BPM-Jobs-India/7947010/',
    'https://careers.joinhgs.com/India/go/Digital-Data-And-Analytics-Jobs-India/7947110/',
    'https://careers.joinhgs.com/services/rss/category/?catid=7947010',
    'https://careers.joinhgs.com/services/rss/category/?catid=7947110',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'hindujaglobalservices')
  assert.equal(jobs[0].company, 'Hinduja Global Services')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.joinhgs.com/India/job/Navi-Mumbai-Videographer-MH-400705/1364403766/',
  )
  assert.equal(
    jobs[1].sourceUrl,
    'https://careers.joinhgs.com/India/job/Hyderabad-Process-Consultant-TG-500019/1362905766/',
  )
})

test('Hinduja Global Services fails closed when the verified landing page or linked feed contract drifts', async () => {
  const hgs = await loadHgsModule()

  await assert.rejects(
    hgs.createHindujaGlobalServicesScraper().run({
      fetchText: async (url) => {
        if (url === hgs.CAREERS_URL) {
          return officialCareersHtml.replace(
            'https://careers.joinhgs.com/India/go/BPM-Jobs-India/7947010/',
            'https://example.com/jobs',
          )
        }
        if (url === hgs.BPM_CATEGORY_PAGE_URL) return bpmCategoryHtml
        if (url === hgs.DIGITAL_CATEGORY_PAGE_URL) return digitalCategoryHtml
        if (url === hgs.BPM_JOBS_RSS_URL) return bpmFeedXml
        if (url === hgs.DIGITAL_JOBS_RSS_URL) return digitalFeedXml
        throw new Error(`Unexpected HGS fixture URL: ${url}`)
      },
    }),
    /verified first-party careers landing/i,
  )

  await assert.rejects(
    hgs.createHindujaGlobalServicesScraper().run({
      fetchText: async (url) => {
        if (url === hgs.CAREERS_URL) return officialCareersHtml
        if (url === hgs.BPM_CATEGORY_PAGE_URL) return bpmCategoryHtml
        if (url === hgs.DIGITAL_CATEGORY_PAGE_URL) return digitalCategoryHtml
        if (url === hgs.BPM_JOBS_RSS_URL) return bpmFeedXml.replace('J2W_RSS', 'BROKEN_FEED')
        if (url === hgs.DIGITAL_JOBS_RSS_URL) return digitalFeedXml
        throw new Error(`Unexpected HGS fixture URL: ${url}`)
      },
    }),
    /verified HGS jobs RSS feed/i,
  )
})
