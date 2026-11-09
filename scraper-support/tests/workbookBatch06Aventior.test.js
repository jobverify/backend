import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
  <html>
    <head>
      <title>Careers | Aventior</title>
    </head>
    <body>
      <main>
        <h1>Careers At Aventior</h1>
        <p>Opportunities to Engineer New Possibilities.</p>
        <section>
          <p>
            At Aventior, we develop platforms and solutions for Health
            Practitioners using Computer Vision-based detection and AI-backed
            analysis and propagation.
          </p>
        </section>
        <h2>Our Focus On Diversity & Equal Opportunity</h2>
        <p>
          Join us in this journey and help us take the steps in engineering new
          possibilities as Team Aventior enriches your growth and career
          roadmap.
        </p>
        <a href="https://www.linkedin.com/company/aventior">Follow Us</a>
      </main>
    </body>
  </html>
`

const VERIFIED_LINKEDIN_COMPANY_HTML = `
  <html>
    <head><title>Aventior | LinkedIn</title></head>
    <body>
      <h1>Aventior</h1>
      <p>IT Services and IT Consulting</p>
      <p>Cambridge, MA</p>
      <p>Driving AI and Digital Transformation</p>
      <a href="https://www.linkedin.com/jobs/aventior-jobs-worldwide?f_C=27234995&trk=top-card_top-card-primary-button-top-card-primary-cta">
        See jobs
      </a>
      <a href="https://www.linkedin.com/redir/redirect?url=http%3A%2F%2Fwww%2Eaventior%2Ecom&urlhash=Tkpf&trk=about_website">
        http://www.aventior.com
      </a>
      <p>Pride Gateway, Baner</p>
      <p>Pune, Maharashtra 411045, IN</p>
    </body>
  </html>
`

const CURRENT_LINKEDIN_COMPANY_HTML = `
  <html>
    <head><title>Aventior | LinkedIn</title></head>
    <body>
      <nav>
        <a href="https://www.linkedin.com/jobs/search?trk=organization_guest_guest_nav_menu_jobs">Jobs</a>
      </nav>
      <h1>Aventior</h1>
      <p>IT Services and IT Consulting</p>
      <p>Cambridge, MA</p>
      <p>Driving AI and Digital Transformation</p>
      <a href="https://www.linkedin.com/redir/redirect?url=http%3A%2F%2Fwww%2Eaventior%2Ecom&urlhash=Tkpf&trk=about_website">
        http://www.aventior.com
      </a>
      <p>Pride Gateway, Baner</p>
      <p>Pune, Maharashtra 411045, IN</p>
    </body>
  </html>
`

const VERIFIED_LINKEDIN_JOBS_HTML = `
  <html>
    <head><title>2 Aventior jobs in Worldwide</title></head>
    <body>
      <h1>Aventior jobs</h1>
      <div class="base-card base-card--link job-search-card" data-entity-urn="urn:li:jobPosting:4441018986">
        <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/technical-project-manager-at-aventior-4441018986?position=1&amp;pageNum=0&amp;refId=WF0GwtYiU9dBCNcD%2BF4ynA%3D%3D&amp;trackingId=nlIXpmQNNAl2ssiCAsnq6A%3D%3D">
          <h3 class="base-search-card__title">Technical Project Manager</h3>
        </a>
        <h4 class="base-search-card__subtitle">
          <a>Aventior</a>
        </h4>
        <span class="job-search-card__location">Pune District, Maharashtra, India</span>
        <time class="job-search-card__listdate" datetime="2026-07-22"></time>
      </div>
      <div class="base-card base-card--link job-search-card" data-entity-urn="urn:li:jobPosting:4444902901">
        <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/r-shiny-engineer-r-developer-at-aventior-4444902901?position=2&amp;pageNum=0&amp;refId=WF0GwtYiU9dBCNcD%2BF4ynA%3D%3D&amp;trackingId=0%2Bt7WRvTxAzaupoNxnoGeQ%3D%3D">
          <h3 class="base-search-card__title">R Shiny Engineer / R Developer</h3>
        </a>
        <h4 class="base-search-card__subtitle">
          <a>Aventior</a>
        </h4>
        <span class="job-search-card__location">Pune District, Maharashtra, India</span>
        <time class="job-search-card__listdate" datetime="2026-07-24"></time>
      </div>
    </body>
  </html>
`

const VERIFIED_LINKEDIN_DETAIL_HTML = `
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": "Technical Project Manager",
      "description": "<p>Lead and deliver complex technology projects end-to-end.</p>",
      "datePosted": "2026-07-22T11:29:01.000Z",
      "employmentType": "FULL_TIME",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "Aventior"
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Pune District",
          "addressRegion": "Maharashtra",
          "addressCountry": "IN"
        }
      }
    }
  </script>
`

const ZERO_LINKEDIN_JOBS_HTML = `
  <html>
    <head>
      <title>0 Aventior jobs in Worldwide</title>
      <meta pageKey="d_jobs_guest_search" />
    </head>
    <body>
      <h1>0 Aventior jobs in Worldwide</h1>
      <p>LinkedIn</p>
      <p>Aventior in Worldwide</p>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/aventior/script.js')
  } catch {
    assert.fail('Expected Aventior scraper module at ../../scraper/aventior/script.js')
  }
}

test('Aventior validates the verified first-party page, LinkedIn company page, and public jobs search shell', async () => {
  const aventior = await loadModule()
  const listings = aventior.extractSearchResults(VERIFIED_LINKEDIN_JOBS_HTML)
  const detail = aventior.extractJobDetail(VERIFIED_LINKEDIN_DETAIL_HTML, listings[0])

  assert.equal(aventior.SOURCE, 'aventior')
  assert.equal(aventior.COMPANY, 'Aventior')
  assert.equal(aventior.VERIFIED_ON, '2026-08-01')
  assert.equal(aventior.CAREERS_URL, 'https://www.aventior.com/careers')
  assert.equal(aventior.LINKEDIN_COMPANY_PAGE_URL, 'https://www.linkedin.com/company/aventior/')
  assert.equal(
    aventior.LINKEDIN_COMPANY_JOBS_URL,
    'https://www.linkedin.com/jobs/aventior-jobs-worldwide?f_C=27234995',
  )
  assert.equal(
    aventior.DISPOSITION,
    'verified-first-party-careers-page-plus-linkedin-company-validation-and-public-jobs-search',
  )
  assert.match(aventior.VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/)
  assert.match(aventior.VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.aventior\.com\/careers/i)
  assert.match(
    aventior.VERIFIED_SURFACE_SUMMARY,
    /https:\/\/www\.linkedin\.com\/company\/aventior\//i,
  )
  assert.match(
    aventior.VERIFIED_SURFACE_SUMMARY,
    /https:\/\/www\.linkedin\.com\/jobs\/aventior-jobs-worldwide\?f_C=27234995/i,
  )
  assert.match(aventior.VERIFIED_SURFACE_SUMMARY, /0 Aventior jobs in Worldwide/i)
  assert.equal(aventior.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    aventior.extractLinkedInCompanyUrl(VERIFIED_CAREERS_HTML),
    aventior.LINKEDIN_COMPANY_PAGE_URL,
  )
  assert.equal(
    aventior.pageIndicatesAventiorLinkedInCompany(VERIFIED_LINKEDIN_COMPANY_HTML),
    true,
  )
  assert.equal(
    aventior.extractCompanyJobsUrl(VERIFIED_LINKEDIN_COMPANY_HTML),
    'https://www.linkedin.com/jobs/aventior-jobs-worldwide?f_C=27234995&trk=top-card_top-card-primary-button-top-card-primary-cta',
  )
  assert.equal(
    aventior.pageIndicatesAventiorLinkedInCompany(CURRENT_LINKEDIN_COMPANY_HTML),
    true,
  )
  assert.equal(aventior.extractCompanyJobsUrl(CURRENT_LINKEDIN_COMPANY_HTML), null)
  assert.equal(
    aventior.hasVerifiedLinkedInJobsPageSignal(VERIFIED_LINKEDIN_JOBS_HTML),
    true,
  )
  assert.equal(aventior.hasVerifiedLinkedInJobsPageSignal(ZERO_LINKEDIN_JOBS_HTML), true)
  assert.equal(listings.length, 2)
  assert.deepEqual(
    {
      ...listings[0],
      ...Object.fromEntries(
        Object.entries(detail).filter(([, value]) => value != null),
      ),
    },
    {
      title: 'Technical Project Manager',
      company: 'Aventior',
      department: null,
      location: 'Pune District, Maharashtra, India',
      city: 'Pune District',
      country: 'India',
      jobId: '4441018986',
      requisitionId: '4441018986',
      sourceUrl: 'https://in.linkedin.com/jobs/view/technical-project-manager-at-aventior-4441018986?position=1&pageNum=0&refId=WF0GwtYiU9dBCNcD%2BF4ynA%3D%3D&trackingId=nlIXpmQNNAl2ssiCAsnq6A%3D%3D',
      applyUrl: 'https://in.linkedin.com/jobs/view/technical-project-manager-at-aventior-4441018986?position=1&pageNum=0&refId=WF0GwtYiU9dBCNcD%2BF4ynA%3D%3D&trackingId=nlIXpmQNNAl2ssiCAsnq6A%3D%3D',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-22',
      closingDate: null,
      jobDescription: 'Lead and deliver complex technology projects end-to-end.',
    },
  )
})

test('Aventior run validates the public contract and returns India jobs from the LinkedIn search', async () => {
  const aventior = await loadModule()
  const requestedUrls = []

  const jobs = await aventior.createAventiorScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aventior.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === aventior.LINKEDIN_COMPANY_PAGE_URL) return VERIFIED_LINKEDIN_COMPANY_HTML
      if (url === aventior.LINKEDIN_COMPANY_JOBS_URL) return VERIFIED_LINKEDIN_JOBS_HTML
      if (url === 'https://in.linkedin.com/jobs/view/technical-project-manager-at-aventior-4441018986?position=1&pageNum=0&refId=WF0GwtYiU9dBCNcD%2BF4ynA%3D%3D&trackingId=nlIXpmQNNAl2ssiCAsnq6A%3D%3D') {
        return VERIFIED_LINKEDIN_DETAIL_HTML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(
    requestedUrls,
    [
      aventior.CAREERS_URL,
      aventior.LINKEDIN_COMPANY_PAGE_URL,
      aventior.LINKEDIN_COMPANY_JOBS_URL,
      'https://in.linkedin.com/jobs/view/technical-project-manager-at-aventior-4441018986?position=1&pageNum=0&refId=WF0GwtYiU9dBCNcD%2BF4ynA%3D%3D&trackingId=nlIXpmQNNAl2ssiCAsnq6A%3D%3D',
    ],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'aventior')
  assert.equal(jobs[0].company, 'Aventior')
  assert.equal(jobs[0].location, 'Pune District, Maharashtra, India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(
    jobs[0].jobDescription,
    'Lead and deliver complex technology projects end-to-end.',
  )
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-25T00:00:00.000Z')
})

test('Aventior run accepts the current LinkedIn company page and writes an empty result when the public jobs search has no listings', async () => {
  const aventior = await loadModule()
  const requestedUrls = []

  const jobs = await aventior.createAventiorScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aventior.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === aventior.LINKEDIN_COMPANY_PAGE_URL) return CURRENT_LINKEDIN_COMPANY_HTML
      if (url === aventior.LINKEDIN_COMPANY_JOBS_URL) return ZERO_LINKEDIN_JOBS_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(
    requestedUrls,
    [
      aventior.CAREERS_URL,
      aventior.LINKEDIN_COMPANY_PAGE_URL,
      aventior.LINKEDIN_COMPANY_JOBS_URL,
    ],
  )
  assert.deepEqual(jobs, [])
})

test('Aventior run keeps conservative listing data when LinkedIn detail enrichment fails', async () => {
  const aventior = await loadModule()
  const requestedUrls = []

  const jobs = await aventior.createAventiorScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aventior.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === aventior.LINKEDIN_COMPANY_PAGE_URL) return VERIFIED_LINKEDIN_COMPANY_HTML
      if (url === aventior.LINKEDIN_COMPANY_JOBS_URL) return VERIFIED_LINKEDIN_JOBS_HTML
      if (url === 'https://in.linkedin.com/jobs/view/technical-project-manager-at-aventior-4441018986?position=1&pageNum=0&refId=WF0GwtYiU9dBCNcD%2BF4ynA%3D%3D&trackingId=nlIXpmQNNAl2ssiCAsnq6A%3D%3D') {
        throw new Error(`HTTP 429 for ${url}`)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(
    requestedUrls,
    [
      aventior.CAREERS_URL,
      aventior.LINKEDIN_COMPANY_PAGE_URL,
      aventior.LINKEDIN_COMPANY_JOBS_URL,
      'https://in.linkedin.com/jobs/view/technical-project-manager-at-aventior-4441018986?position=1&pageNum=0&refId=WF0GwtYiU9dBCNcD%2BF4ynA%3D%3D&trackingId=nlIXpmQNNAl2ssiCAsnq6A%3D%3D',
    ],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Technical Project Manager')
  assert.equal(jobs[0].location, 'Pune District, Maharashtra, India')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].source, 'aventior')
})

test('Aventior fails closed when the verified first-party or LinkedIn public contract drifts', async () => {
  const aventior = await loadModule()

  await assert.rejects(
    aventior.createAventiorScraper().run({
      fetchText: async (url) => {
        if (url === aventior.CAREERS_URL) {
          return VERIFIED_CAREERS_HTML.replace(
            'https://www.linkedin.com/company/aventior',
            'https://www.linkedin.com/company/example-company',
          )
        }

        return VERIFIED_LINKEDIN_COMPANY_HTML
      },
    }),
    /company handoff/i,
  )

  await assert.rejects(
    aventior.createAventiorScraper().run({
      fetchText: async (url) => {
        if (url === aventior.CAREERS_URL) {
          return `${VERIFIED_CAREERS_HTML}<a href="/careers/openings/staff-engineer">Staff Engineer</a>`
        }

        return VERIFIED_LINKEDIN_COMPANY_HTML
      },
    }),
    /first-party public jobs surface|public careers surface/i,
  )

  await assert.rejects(
    aventior.createAventiorScraper().run({
      fetchText: async (url) => {
        if (url === aventior.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === aventior.LINKEDIN_COMPANY_PAGE_URL) {
          return `
            <html>
              <head><title>Other Company | LinkedIn</title></head>
              <body><p>Something else</p></body>
            </html>
          `
        }

        return VERIFIED_LINKEDIN_JOBS_HTML
      },
    }),
    /company page no longer matches|organization page/i,
  )

  await assert.rejects(
    aventior.createAventiorScraper().run({
      fetchText: async (url) => {
        if (url === aventior.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === aventior.LINKEDIN_COMPANY_PAGE_URL) return VERIFIED_LINKEDIN_COMPANY_HTML
        if (url === aventior.LINKEDIN_COMPANY_JOBS_URL) {
          return `
            <html>
              <body>
                <h1>Jobs</h1>
                <p>Explore openings.</p>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs page no longer matches/i,
  )
})
