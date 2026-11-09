import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Arka Fincap \u2013 Expert Financial Solutions &amp; Services</title>
  </head>
  <body>
    <nav>
      <a href="https://www.arkafincap.com/">Home</a>
      <a href="https://www.arkafincap.com/about-us">About Us</a>
      <a href="/life-at-arka">Life at Arka</a>
      <a href="https://arkafincap.zohorecruit.in/jobs/Careers">Job Openings</a>
    </nav>
    <h1>Arka Fincap</h1>
    <p>Expert Financial Solutions &amp; Services</p>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Life at Arka \u2013 Work Culture, Careers &amp; Growth</title>
    <meta property="og:url" content="https://www.arkafincap.com/life-at-arka">
  </head>
  <body>
    <h1>Life at Arka</h1>
    <h2>Our Culture</h2>
    <p>Why Join Us?</p>
    <a href="/life-at-arka">Careers</a>
    <a href="https://arkafincap.zohorecruit.in/jobs/Careers">Join Us</a>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Arka</title>
    <meta property="og:url" content="https://arkafincap.zohorecruit.in/jobs/Careers">
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{}">
    <input type="hidden" id="moduleMeta" value="[]">
    <input type="hidden" id="jobs" value="[]">
    <p>CareerSite</p>
    <p>Arka</p>
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Job_Type: 'Full time',
      Job_Opening_Name: 'Data Architect',
      Posting_Title: 'Data Architect',
      Country: 'India',
      State: 'Maharashtra',
      City: null,
      Work_Experience: '5-10  years',
      Date_Opened: '06/19/2025',
      Job_Description:
        'Key Responsibilities:&nbsp; Design, develop, and maintain robust and scalable data architectures.',
      id: '89006000003963368',
      $url: 'https://arkafincap.zohorecruit.in/jobs/Careers/89006000003963368/Data-Architect?source=CareerSite',
      Remote_Job: false,
    },
    {
      Job_Type: 'Full time',
      Posting_Title: 'Credit Analyst',
      Country: 'Singapore',
      City: 'Singapore',
      id: '89006000003960000',
      $url: 'https://arkafincap.zohorecruit.in/jobs/Careers/89006000003960000/Credit-Analyst?source=CareerSite',
      Remote_Job: false,
    },
  ],
}

const loadArkaFincapModule = async () => {
  try {
    return await import('../../scraper/arkafincap/script.js')
  } catch {
    assert.fail('Expected Arka Fincap scraper module at ../../scraper/arkafincap/script.js')
  }
}

test('Arka Fincap constants stay pinned to the verified homepage, careers page, and public Zoho Recruit surfaces', async () => {
  const arkaFincap = await loadArkaFincapModule()

  assert.equal(arkaFincap.SOURCE, 'arkafincap')
  assert.equal(arkaFincap.COMPANY, 'Arka Fincap')
  assert.equal(arkaFincap.OFFICIAL_BRAND_NAME, 'Arka Fincap')
  assert.equal(arkaFincap.VERIFIED_ON, '2026-07-15')
  assert.equal(arkaFincap.HOMEPAGE_URL, 'https://www.arkafincap.com/')
  assert.equal(arkaFincap.CAREERS_PAGE_URL, 'https://www.arkafincap.com/life-at-arka')
  assert.equal(arkaFincap.CAREERS_PORTAL_URL, 'https://arkafincap.zohorecruit.in/jobs/Careers')
  assert.equal(
    arkaFincap.CAREERS_API_URL,
    'https://arkafincap.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.match(arkaFincap.VERIFIED_SURFACE_SUMMARY, /Life at Arka/i)
  assert.equal(arkaFincap.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(arkaFincap.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(arkaFincap.hasOfficialPortalSignal(portalHtml), true)
})

test('Arka Fincap validators accept the current relative careers handoff links and unicode dash titles', async () => {
  const arkaFincap = await loadArkaFincapModule()

  assert.equal(arkaFincap.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(arkaFincap.hasOfficialCareersPageSignal(careersPageHtml), true)
})

test('extractIndiaJobs maps Arka Fincap public Zoho Recruit records and excludes non-India roles', async () => {
  const arkaFincap = await loadArkaFincapModule()
  const jobs = arkaFincap.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Data Architect',
      company: 'Arka Fincap',
      department: null,
      location: 'Maharashtra, India',
      city: null,
      country: 'India',
      jobId: '89006000003963368',
      requisitionId: '89006000003963368',
      sourceUrl: 'https://arkafincap.zohorecruit.in/jobs/Careers/89006000003963368/Data-Architect?source=CareerSite',
      applyUrl: 'https://arkafincap.zohorecruit.in/jobs/Careers/89006000003963368/Data-Architect?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '5-10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-06-19T00:00:00.000Z',
      closingDate: null,
      jobDescription: 'Key Responsibilities: Design, develop, and maintain robust and scalable data architectures.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the verified Arka Fincap surface before fetching and decorating India jobs', async () => {
  const arkaFincap = await loadArkaFincapModule()
  const requestedUrls = []

  const jobs = await arkaFincap.createArkaFincapScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === arkaFincap.HOMEPAGE_URL) return homepageHtml
      if (url === arkaFincap.CAREERS_PAGE_URL) return careersPageHtml
      if (url === arkaFincap.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === arkaFincap.CAREERS_API_URL) return apiPayload

      assert.fail(`Unexpected JSON request: ${url}`)
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    arkaFincap.HOMEPAGE_URL,
    arkaFincap.CAREERS_PAGE_URL,
    arkaFincap.CAREERS_PORTAL_URL,
    arkaFincap.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'arkafincap')
  assert.equal(
    jobs[0].link,
    'https://arkafincap.zohorecruit.in/jobs/Careers/89006000003963368/Data-Architect?source=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-15T00:00:00.000Z')
})

test('run bounds default Arka Fincap HTML and JSON fetches with abort signals', async () => {
  const arkaFincap = await loadArkaFincapModule()
  const originalFetch = globalThis.fetch
  const requests = []

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), signal: init.signal })

    if (url === arkaFincap.HOMEPAGE_URL) {
      return { ok: true, status: 200, text: async () => homepageHtml }
    }
    if (url === arkaFincap.CAREERS_PAGE_URL) {
      return { ok: true, status: 200, text: async () => careersPageHtml }
    }
    if (url === arkaFincap.CAREERS_PORTAL_URL) {
      return { ok: true, status: 200, text: async () => portalHtml }
    }
    if (url === arkaFincap.CAREERS_API_URL) {
      return { ok: true, status: 200, json: async () => apiPayload }
    }

    assert.fail(`Unexpected URL: ${url}`)
  }

  try {
    const jobs = await arkaFincap.createArkaFincapScraper({ maxJobs: 1 }).run({
      now: () => '2026-07-15T00:00:00.000Z',
    })

    assert.equal(jobs.length, 1)
    assert.ok(requests.every((request) => request.signal), 'each fetch should include an abort signal')
    assert.ok(requests.every((request) => typeof request.signal.aborted === 'boolean'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('run fails closed when the verified Arka Fincap surface markers drift', async () => {
  const arkaFincap = await loadArkaFincapModule()

  await assert.rejects(
    arkaFincap.createArkaFincapScraper().run({
      fetchText: async (url) => {
        if (url === arkaFincap.HOMEPAGE_URL) {
          return '<html><body>No careers handoff here.</body></html>'
        }

        return careersPageHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /official Arka Fincap homepage/i,
  )

  await assert.rejects(
    arkaFincap.createArkaFincapScraper().run({
      fetchText: async (url) => {
        if (url === arkaFincap.HOMEPAGE_URL) return homepageHtml
        if (url === arkaFincap.CAREERS_PAGE_URL) return '<html><body>Broken careers page</body></html>'
        return portalHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /official Arka Fincap careers page/i,
  )

  await assert.rejects(
    arkaFincap.createArkaFincapScraper().run({
      fetchText: async (url) => {
        if (url === arkaFincap.HOMEPAGE_URL) return homepageHtml
        if (url === arkaFincap.CAREERS_PAGE_URL) return careersPageHtml
        return '<html><body>Broken portal</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Arka Fincap careers portal/i,
  )

  await assert.rejects(
    arkaFincap.createArkaFincapScraper().run({
      fetchText: async (url) => {
        if (url === arkaFincap.HOMEPAGE_URL) return homepageHtml
        if (url === arkaFincap.CAREERS_PAGE_URL) return careersPageHtml
        if (url === arkaFincap.CAREERS_PORTAL_URL) return portalHtml
        assert.fail(`Unexpected HTML request: ${url}`)
      },
      fetchJson: async () => ({ code: 'error', data: null }),
    }),
    /public jobs API no longer returns the verified success payload/i,
  )
})

test('run can recover with browser-backed Arka Fincap HTML surfaces when direct requests fail', async () => {
  const arkaFincap = await loadArkaFincapModule()
  const browserUrls = []

  const jobs = await arkaFincap.createArkaFincapScraper({ maxJobs: 1 }).run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)

      if (url === arkaFincap.HOMEPAGE_URL) return homepageHtml
      if (url === arkaFincap.CAREERS_PAGE_URL) return careersPageHtml
      if (url === arkaFincap.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected browser HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      if (url === arkaFincap.CAREERS_API_URL) return apiPayload

      assert.fail(`Unexpected JSON request: ${url}`)
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(browserUrls, [
    arkaFincap.HOMEPAGE_URL,
    arkaFincap.CAREERS_PAGE_URL,
    arkaFincap.CAREERS_PORTAL_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'arkafincap')
})
