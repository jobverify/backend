import assert from 'node:assert/strict'
import test from 'node:test'

const ABOUT_PAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>About Us - SarvaGram</title>
  </head>
  <body>
    <main>
      <h1>Our Mission: To reduce vulnerability and expand opportunity in every village.</h1>
      <p>As an integrated technology platform dedicated specifically to serving the rural households, we bring access to financial services and commerce to the last mile.</p>
      <p>Our field channels are the village level entrepreneurs and women who work with SarvaGram and delight villagers with a range of financial and commerce services.</p>
      <a href="https://sarvagram.zohorecruit.in/jobs/Careers">Join SarvaGram</a>
      <footer>
        <a href="https://sarvagram.zohorecruit.in/jobs/Careers">Careers</a>
        <p>Join our growing team!</p>
      </footer>
    </main>
  </body>
</html>
`

const PORTAL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career at SarvaGram</title>
    <meta property="og:url" content="https://sarvagram.zohorecruit.in/jobs/Careers" />
  </head>
  <body>
    <input id="pageJson" type="hidden" value="{}" />
    <input id="moduleMeta" type="hidden" value="{}" />
    <input id="jobs" type="hidden" value="[]" />
  </body>
</html>
`

const LIVE_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Platform architect - Cloud native</title>
  </head>
  <body>
    <main>
      <h1>Platform architect - Cloud native</h1>
      <div>SarvaGram | Full time</div>
      <div>Pune City, Maharashtra, India</div>
      <section>
        <h2>Job Information</h2>
        <p>Work Experience: 8+ years</p>
      </section>
      <section>
        <h2>About Us</h2>
        <p>Join our growing team!</p>
      </section>
      <section>
        <h2>Job Description</h2>
        <p>Design cloud native platform architecture for rural finance products.</p>
      </section>
    </main>
  </body>
</html>
`

const CLOSED_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Solution Architect - Lending Platform</title>
  </head>
  <body>
    <main>
      <h1>Sorry, This job posting is no longer available.</h1>
      <p>Joblist has been removed.</p>
    </main>
  </body>
</html>
`

const API_PAYLOAD = {
  code: 'success',
  data: [
    {
      id: '41230000027401421',
      Posting_Title: 'Platform architect - Cloud native',
      Job_Opening_Name: 'Platform architect - Cloud native',
      Industry: 'Financial Services',
      Job_Type: 'Full time',
      Work_Experience: '8+ years',
      Date_Opened: '04/23/2026',
      City: 'Pune City',
      State: 'Maharashtra',
      Country: 'India',
      Job_Description: 'Design cloud native platform architecture for rural finance products.',
      Publish: true,
      Is_Locked: false,
      $url: 'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027401421/Platform-architect---Cloud-native?source=CareerSite',
    },
    {
      id: '41230000027333130',
      Posting_Title: 'Senior Mobile Engineer - Flutter',
      Job_Opening_Name: 'Senior Mobile Engineer - Flutter',
      Industry: 'Financial Services',
      Job_Type: 'Full time',
      Work_Experience: '5+ years',
      Date_Opened: '04/16/2026',
      City: 'Pune City',
      State: 'Maharashtra',
      Country: 'India',
      Job_Description: 'Build Flutter experiences for rural financial services.',
      Publish: true,
      Is_Locked: false,
      $url: 'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027333130/Senior-Mobile-Engineer---Flutter?source=CareerSite',
    },
    {
      id: '41230000029999999',
      Posting_Title: 'US Counsel',
      Job_Opening_Name: 'US Counsel',
      Industry: 'Legal',
      Job_Type: 'Full time',
      Work_Experience: '10+ years',
      Date_Opened: '05/01/2026',
      City: 'Austin',
      State: 'Texas',
      Country: 'United States',
      Job_Description: 'Legal support for overseas operations.',
      Publish: true,
      Is_Locked: false,
      $url: 'https://sarvagram.zohorecruit.in/jobs/Careers/41230000029999999/US-Counsel?source=CareerSite',
    },
  ],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sarvagram/script.js')
  } catch {
    assert.fail('Expected SarvaGram scraper module at ../../scraper/sarvagram/script.js')
  }
}

test('SarvaGram helper exports stay pinned to the verified Zoho board and public API contract', async () => {
  const sarvagram = await loadScriptModule()

  assert.equal(sarvagram.SOURCE, 'sarvagram')
  assert.equal(sarvagram.COMPANY, 'SarvaGram')
  assert.equal(sarvagram.OFFICIAL_BRAND_NAME, 'SarvaGram')
  assert.equal(sarvagram.VERIFIED_ON, '2026-08-04')
  assert.equal(sarvagram.HOMEPAGE_URL, 'https://www.sarvagram.com/')
  assert.equal(sarvagram.ABOUT_PAGE_URL, 'https://www.sarvagram.com/about-us/')
  assert.equal(sarvagram.CAREERS_PORTAL_URL, 'https://sarvagram.zohorecruit.in/jobs/Careers')
  assert.equal(
    sarvagram.CAREERS_API_URL,
    'https://sarvagram.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(sarvagram.hasOfficialAboutPageSignal(ABOUT_PAGE_HTML), true)
  assert.equal(sarvagram.hasOfficialPortalSignal(PORTAL_HTML), true)
  assert.equal(
    sarvagram.hasVerifiedJobDetailPage(LIVE_DETAIL_HTML, {
      title: 'Platform architect - Cloud native',
      sourceUrl:
        'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027401421/Platform-architect---Cloud-native?source=CareerSite',
    }),
    true,
  )
  assert.deepEqual(
    sarvagram.extractIndiaJobs(API_PAYLOAD).map((job) => ({
      title: job.title,
      location: job.location,
      country: job.country,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Platform architect - Cloud native',
        location: 'Pune City, Maharashtra, India',
        country: 'India',
        employmentType: 'Full-time',
        experienceRequired: '8+ years',
        sourceUrl:
          'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027401421/Platform-architect---Cloud-native?source=CareerSite',
      },
      {
        title: 'Senior Mobile Engineer - Flutter',
        location: 'Pune City, Maharashtra, India',
        country: 'India',
        employmentType: 'Full-time',
        experienceRequired: '5+ years',
        sourceUrl:
          'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027333130/Senior-Mobile-Engineer---Flutter?source=CareerSite',
      },
    ],
  )
})

test('SarvaGram run validates the verified portal and API conservatively', async () => {
  const sarvagram = await loadScriptModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await sarvagram.createSarvaGramScraper({
    now: () => '2026-07-17T11:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === sarvagram.CAREERS_PORTAL_URL) return PORTAL_HTML

      throw new Error(`Unexpected SarvaGram URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return API_PAYLOAD
    },
  })

  assert.deepEqual(requestedTextUrls, [
    sarvagram.CAREERS_PORTAL_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [sarvagram.CAREERS_API_URL])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      country: job.country,
      sourceUrl: job.sourceUrl,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Platform architect - Cloud native',
        location: 'Pune City, Maharashtra, India',
        country: 'India',
        sourceUrl:
          'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027401421/Platform-architect---Cloud-native?source=CareerSite',
        link:
          'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027401421/Platform-architect---Cloud-native?source=CareerSite',
        scrapedAt: '2026-07-17T11:00:00.000Z',
      },
      {
        title: 'Senior Mobile Engineer - Flutter',
        location: 'Pune City, Maharashtra, India',
        country: 'India',
        sourceUrl:
          'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027333130/Senior-Mobile-Engineer---Flutter?source=CareerSite',
        link:
          'https://sarvagram.zohorecruit.in/jobs/Careers/41230000027333130/Senior-Mobile-Engineer---Flutter?source=CareerSite',
        scrapedAt: '2026-07-17T11:00:00.000Z',
      },
    ],
  )
})

test('SarvaGram fails closed when the verified portal or API contract drifts', async () => {
  const sarvagram = await loadScriptModule()

  await assert.rejects(
    sarvagram.createSarvaGramScraper().run({
      fetchText: async (url) => {
        if (url === sarvagram.CAREERS_PORTAL_URL) return '<html><body>Unexpected portal</body></html>'
        throw new Error(`Unexpected SarvaGram URL: ${url}`)
      },
      fetchJson: async () => API_PAYLOAD,
    }),
    /verified sarvagram careers portal/i,
  )

  await assert.rejects(
    sarvagram.createSarvaGramScraper().run({
      fetchText: async (url) => {
        if (url === sarvagram.CAREERS_PORTAL_URL) return PORTAL_HTML
        throw new Error(`Unexpected SarvaGram URL: ${url}`)
      },
      fetchJson: async () => ({ code: 'error', data: null }),
    }),
    /public jobs api/i,
  )
})
