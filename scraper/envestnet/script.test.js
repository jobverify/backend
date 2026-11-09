import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const listingPageData = {
  url: 'https://careers.envestnet.com/search/jobs/in/country/india',
  title: 'India Careers',
  text: `
    Careers Home Search Jobs Saved Jobs
    Job Search Results
    Showing 1-2 of 2 result(s)
    Set up job alerts
    Showing 1-2 of 2 results
    Data Privacy Advisor II
    Trivandrum, KL, India
    Jul 7, 2026
    Senior Enterprise Applications Engineer - ZScaler
    Trivandrum, KL, India
    Jul 6, 2026
  `,
  links: [
    {
      text: 'Data Privacy Advisor II',
      href: 'https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii',
    },
    {
      text: 'Senior Enterprise Applications Engineer - ZScaler',
      href: 'https://careers.envestnet.com/jobs/17961049-senior-enterprise-applications-engineer-zscaler',
    },
    {
      text: 'View more jobs',
      href: 'https://careers.envestnet.com/search/jobs/in/country/india?page=2',
    },
  ],
}

const detailPageData = {
  url: 'https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii',
  title: 'Data Privacy Advisor II in Trivandrum, KL, India',
  text: `
    Back to Search Results
    Data Privacy Advisor II
    Location: Trivandrum, KL, India
    Date Posted: Jul 7, 2026
    Share:
    Apply Now
    Save Job
    Description
    Job Location
    The primary work location for this role is Trivandrum with a hybrid work model.
    About Envestnet
    Envestnet is an adaptive WealthTech company.
    How You'll Contribute
    Build privacy processes across the organization.
    What You'll Need to Bring
    Minimum 5+ years of experience in Data Privacy.
    Why You'll Enjoy Working at Envestnet
  `,
  links: [
    {
      text: 'Apply Now',
      href: 'javascript: CareerSite.Apply.launchApplicantJob(17868789, );',
    },
  ],
}

const blockedChallengePage = {
  status: 403,
  url: 'https://careers.envestnet.com/search/jobs/in/country/india',
  headers: {
    server: 'cloudflare',
    'cf-ray': 'a2abc87858e29f61-MAA',
    'cf-mitigated': 'challenge',
  },
  html: `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <noscript>
      <div>Enable JavaScript and cookies to continue</div>
    </noscript>
    <script src="https://challenges.cloudflare.com"></script>
  </body>
</html>
`,
}

test('Envestnet scraper validates and extracts India listing links from the verified public listing surface', async () => {
  const envestnet = await loadModule()
  assert.ok(envestnet, 'Envestnet scraper module should load')

  const {
    INDIA_SEARCH_URL,
    SOURCE,
    VERIFIED_LISTING_TITLE,
    extractListingJobLinks,
    hasVerifiedIndiaListingSurface,
  } = envestnet

  assert.equal(SOURCE, 'envestnet')
  assert.equal(INDIA_SEARCH_URL, 'https://careers.envestnet.com/search/jobs/in/country/india')
  assert.equal(VERIFIED_LISTING_TITLE, 'India Careers')
  assert.equal(hasVerifiedIndiaListingSurface(listingPageData), true)
  assert.deepEqual(extractListingJobLinks(listingPageData), [
    {
      title: 'Data Privacy Advisor II',
      url: 'https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii',
    },
    {
      title: 'Senior Enterprise Applications Engineer - ZScaler',
      url: 'https://careers.envestnet.com/jobs/17961049-senior-enterprise-applications-engineer-zscaler',
    },
  ])
})

test('Envestnet scraper normalizes an India job detail page', async () => {
  const envestnet = await loadModule()
  assert.ok(envestnet, 'Envestnet scraper module should load')

  const { extractJobFromDetailPage } = envestnet

  const job = extractJobFromDetailPage(detailPageData)

  assert.equal(job.title, 'Data Privacy Advisor II')
  assert.equal(job.company, 'Envestnet')
  assert.equal(job.location, 'Trivandrum, KL, India')
  assert.equal(job.city, 'Trivandrum')
  assert.equal(job.country, 'India')
  assert.equal(job.jobId, '17868789')
  assert.equal(job.requisitionId, '17868789')
  assert.equal(job.sourceUrl, 'https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii')
  assert.equal(job.applyUrl, job.sourceUrl)
  assert.equal(job.postingDate, 'Jul 7, 2026')
  assert.match(job.jobDescription, /Envestnet is an adaptive WealthTech company/i)
})

test('Envestnet scraper runs through listing and detail pages and decorates final jobs', async () => {
  const envestnet = await loadModule()
  assert.ok(envestnet, 'Envestnet scraper module should load')

  const { createEnvestnetScraper, INDIA_SEARCH_URL } = envestnet

  const requestedUrls = []
  const pageMap = new Map([
    [INDIA_SEARCH_URL, listingPageData],
    ['https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii', detailPageData],
  ])

  const jobs = await createEnvestnetScraper({ maxJobs: 1 }).run({
    collectPageDataImpl: async (url) => {
      requestedUrls.push(url)
      const pageData = pageMap.get(url)
      if (!pageData) throw new Error(`Unexpected URL: ${url}`)
      return pageData
    },
  })

  assert.deepEqual(requestedUrls, [
    INDIA_SEARCH_URL,
    'https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'envestnet')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Envestnet run can use direct HTML fetches to build listing and detail page data', async () => {
  const envestnet = await loadModule()
  assert.ok(envestnet, 'Envestnet scraper module should load')

  const { createEnvestnetScraper, INDIA_SEARCH_URL } = envestnet
  const requestedUrls = []

  const htmlByUrl = new Map([
    [INDIA_SEARCH_URL, `
      <html>
        <head><title>India Careers</title></head>
        <body>
          Job Search Results
          Showing 1-2 of 2 result(s)
          Set up job alerts
          <a href="https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii">Data Privacy Advisor II</a>
          <a href="https://careers.envestnet.com/jobs/17961049-senior-enterprise-applications-engineer-zscaler">Senior Enterprise Applications Engineer - ZScaler</a>
        </body>
      </html>
    `],
    ['https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii', `
      <html>
        <head><title>Data Privacy Advisor II in Trivandrum, KL, India</title></head>
        <body>
          Location: Trivandrum, KL, India
          Date Posted: Jul 7, 2026
          Description
          The primary work location for this role is Trivandrum with a hybrid work model.
          About Envestnet
          Envestnet is an adaptive WealthTech company.
          Apply Now
          <a href="javascript: CareerSite.Apply.launchApplicantJob(17868789, );">Apply Now</a>
        </body>
      </html>
    `],
  ])

  const jobs = await createEnvestnetScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const html = htmlByUrl.get(url)
      if (!html) throw new Error(`Unexpected URL: ${url}`)
      return html
    },
  })

  assert.deepEqual(requestedUrls, [
    INDIA_SEARCH_URL,
    'https://careers.envestnet.com/jobs/17868789-data-privacy-advisor-ii',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'envestnet')
})

test('Envestnet scraper rejects unsupported listing or detail page changes', async () => {
  const envestnet = await loadModule()
  assert.ok(envestnet, 'Envestnet scraper module should load')

  const { createEnvestnetScraper, extractJobFromDetailPage } = envestnet

  await assert.rejects(
    createEnvestnetScraper().run({
      collectPageDataImpl: async () => ({
        title: 'Jobs',
        text: 'Open roles',
        links: [],
      }),
    }),
    /verified public surface/i,
  )

  assert.throws(
    () => extractJobFromDetailPage({
      ...detailPageData,
      text: 'Apply Now',
    }),
    /verified public surface/i,
  )
})

test('Envestnet returns [] when the India jobs route matches the verified Cloudflare challenge shell', async () => {
  const envestnet = await loadModule()
  assert.ok(envestnet, 'Envestnet scraper module should load')

  const {
    INDIA_SEARCH_URL,
    createEnvestnetScraper,
    hasVerifiedCloudflareChallengeSignal,
  } = envestnet

  assert.equal(hasVerifiedCloudflareChallengeSignal(blockedChallengePage), true)

  const requestedUrls = []
  const jobs = await createEnvestnetScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === INDIA_SEARCH_URL) return blockedChallengePage
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [INDIA_SEARCH_URL])
  assert.deepEqual(jobs, [])
})
