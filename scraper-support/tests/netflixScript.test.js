import assert from 'node:assert/strict'
import test from 'node:test'

const LOCATION_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work in Mumbai - Careers at Netflix</title>
    <meta name="description" content="Explore careers at Netflix in Mumbai." />
    <meta property="og:url" content="https://jobs.netflix.com" />
  </head>
  <body>
    <div data-lang="en-US">Working at Netflix in India</div>
    <a
      href="https://explore.jobs.netflix.net/careers?location=Mumbai%2C%20MH%2C%20India&amp;pid=790316882301&amp;domain=netflix.com&amp;sort_by=relevance&amp;triggerGoButton=false"
    >
      VIEW OPEN ROLES
    </a>
  </body>
</html>
`

const EXPLORE_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Netflix jobs in Mumbai, MH, India</title>
  </head>
  <body>
    <div class="search-results-main-container">Search results</div>
    <script>
      window.__NETFLIX_STATE__ = {&#34;companyName&#34;: &#34;Netflix&#34;, &#34;positions&#34;: [
        {&#34;id&#34;: 790316882301, &#34;name&#34;: &#34;Publicity Manager - Originals&#34;, &#34;location&#34;: &#34;Mumbai,India&#34;, &#34;locations&#34;: [&#34;Mumbai,India&#34;], &#34;department&#34;: &#34;Marketing&#34;, &#34;display_job_id&#34;: &#34;JR41479&#34;, &#34;canonicalPositionUrl&#34;: &#34;https://explore.jobs.netflix.net/careers/job/790316882301&#34;, &#34;work_location_option&#34;: &#34;onsite&#34;},
        {&#34;id&#34;: 790399999999, &#34;name&#34;: &#34;Senior Ads Counsel&#34;, &#34;location&#34;: &#34;Los Gatos,United States&#34;, &#34;locations&#34;: [&#34;Los Gatos,United States&#34;], &#34;department&#34;: &#34;Legal&#34;, &#34;display_job_id&#34;: &#34;JR49999&#34;, &#34;canonicalPositionUrl&#34;: &#34;https://explore.jobs.netflix.net/careers/job/790399999999&#34;, &#34;work_location_option&#34;: &#34;hybrid&#34;}
      ], &#34;count&#34;: 2}
    </script>
  </body>
</html>
`

const DETAIL_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Publicity Manager - Originals | Mumbai,India | Netflix</title>
    <meta property="og:title" content="Publicity Manager - Originals | Mumbai,India | Netflix" />
    <meta property="og:url" content="https://explore.jobs.netflix.net/careers/job/790316882301-publicity-manager-originals-mumbai-india?domain=netflix.com&amp;microsite=netflix.com" />
  </head>
  <body>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Publicity Manager - Originals",
        "datePosted": "2026-07-06T00:00:00",
        "validThrough": "2026-08-20T00:00:00",
        "employmentType": "FULL_TIME",
        "description": "Lead earned media strategy for originals in India."
      }
    </script>
  </body>
</html>
`

const loadNetflixModule = async () => {
  try {
    return await import('../../scraper/netflix/script.js')
  } catch {
    assert.fail('Expected Netflix scraper module at ../../scraper/netflix/script.js')
  }
}

test('Netflix pins the verified Mumbai location page, public explore handoff, and embedded position state', async () => {
  const netflix = await loadNetflixModule()

  assert.equal(netflix.SOURCE, 'netflix')
  assert.equal(netflix.COMPANY, 'Netflix')
  assert.equal(netflix.LOCATION_PAGE_URL, 'https://jobs.netflix.com/locations/mumbai?location=Mumbai%2C+India')
  assert.equal(netflix.EXPLORE_JOBS_BASE_URL, 'https://explore.jobs.netflix.net/careers')
  assert.equal(netflix.VERIFIED_ON, '2026-07-25')
  assert.equal(netflix.hasVerifiedLocationPageSignal(LOCATION_PAGE_HTML), true)
  assert.equal(netflix.hasVerifiedExplorePageSignal(EXPLORE_PAGE_HTML), true)
  assert.equal(netflix.extractExploreJobsUrl(LOCATION_PAGE_HTML), 'https://explore.jobs.netflix.net/careers?location=Mumbai%2C%20MH%2C%20India&pid=790316882301&domain=netflix.com&sort_by=relevance&triggerGoButton=false')
  assert.deepEqual(netflix.extractEncodedPositionSummaries(EXPLORE_PAGE_HTML), [
    {
      jobId: '790316882301',
      requisitionId: 'JR41479',
      title: 'Publicity Manager - Originals',
      department: 'Marketing',
      location: 'Mumbai, India',
      sourceUrl: 'https://explore.jobs.netflix.net/careers/job/790316882301',
      applyUrl: 'https://explore.jobs.netflix.net/careers/job/790316882301',
      remoteStatus: 'On-site',
    },
    {
      jobId: '790399999999',
      requisitionId: 'JR49999',
      title: 'Senior Ads Counsel',
      department: 'Legal',
      location: 'Los Gatos, United States',
      sourceUrl: 'https://explore.jobs.netflix.net/careers/job/790399999999',
      applyUrl: 'https://explore.jobs.netflix.net/careers/job/790399999999',
      remoteStatus: 'Hybrid',
    },
  ])
  assert.equal(netflix.extractJobPostingJsonLd(DETAIL_PAGE_HTML)?.title, 'Publicity Manager - Originals')
})

test('Netflix keeps only India roles from the verified public explore page and enriches them from the public detail page', async () => {
  const netflix = await loadNetflixModule()
  const requestedUrls = []

  const jobs = await netflix.createNetflixScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === netflix.LOCATION_PAGE_URL) return LOCATION_PAGE_HTML
      if (url === 'https://explore.jobs.netflix.net/careers?location=Mumbai%2C%20MH%2C%20India&pid=790316882301&domain=netflix.com&sort_by=relevance&triggerGoButton=false') {
        return EXPLORE_PAGE_HTML
      }
      if (url === 'https://explore.jobs.netflix.net/careers/job/790316882301') return DETAIL_PAGE_HTML
      assert.fail(`Unexpected URL requested: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    netflix.LOCATION_PAGE_URL,
    'https://explore.jobs.netflix.net/careers?location=Mumbai%2C%20MH%2C%20India&pid=790316882301&domain=netflix.com&sort_by=relevance&triggerGoButton=false',
    'https://explore.jobs.netflix.net/careers/job/790316882301',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Publicity Manager - Originals',
      company: 'Netflix',
      department: 'Marketing',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '790316882301',
      requisitionId: 'JR41479',
      sourceUrl: 'https://explore.jobs.netflix.net/careers/job/790316882301',
      applyUrl: 'https://explore.jobs.netflix.net/careers/job/790316882301',
      employmentType: 'FULL_TIME',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-06T00:00:00',
      closingDate: '2026-08-20T00:00:00',
      jobDescription: 'Lead earned media strategy for originals in India.',
      remoteStatus: 'On-site',
      source: 'netflix',
      link: 'https://explore.jobs.netflix.net/careers/job/790316882301',
      scrapedAt: '2026-07-25T00:00:00.000Z',
      companyCareerPage: 'https://jobs.netflix.com/locations/mumbai?location=Mumbai%2C+India',
      companyDomain: 'jobs.netflix.com',
      atsPlatform: 'official-first-party-location-page-plus-public-explore-board',
    },
  ])
})

test('Netflix fails closed when the verified first-party location page or embedded explore state drifts', async () => {
  const netflix = await loadNetflixModule()

  await assert.rejects(
    netflix.createNetflixScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected Careers</h1></body></html>',
    }),
    /netflix verified mumbai location page/i,
  )

  await assert.rejects(
    netflix.createNetflixScraper().run({
      fetchText: async (url) => (
        url === netflix.LOCATION_PAGE_URL
          ? LOCATION_PAGE_HTML
          : '<html><body><h1>No embedded positions</h1></body></html>'
      ),
    }),
    /netflix verified explore jobs page/i,
  )
})
