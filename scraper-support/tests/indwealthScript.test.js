import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('../../scraper/indwealth/script.js')

const redirectHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Indmoney: Online Trading & Investing App for Indian & US Markets</title>
  </head>
  <body>
    <h1>Trade & Invest in Indian & US Markets from One App</h1>
    <nav>
      <a href="/about">About Us</a>
      <a href="/blog">Blog</a>
      <a href="/learn">Learn</a>
      <a href="/support">Customer Service</a>
      <a href="/fraud-awareness">Fraud Awareness</a>
      <a href="/sitemap.xml">Sitemap</a>
    </nav>
  </body>
</html>
`

const aboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>INDmoney About Page</title>
  </head>
  <body>
    <h1>Our Company</h1>
    <p>India’s independent Super Finance App</p>
    <section>
      <h2>Join Us</h2>
      <p>We’re looking for talented, passionate people to join us in building simple, beautiful financial products.</p>
      <a href="https://www.linkedin.com/company/indmoney/jobs/">Join Our Team</a>
    </section>
    <footer>
      <a href="/about">About Us</a>
      <a href="/blog">Blog</a>
      <a href="/learn">Learn</a>
      <a href="/support">Customer Service</a>
      <a href="/fraud-awareness">Fraud Awareness</a>
      <a href="/sitemap.xml">Sitemap</a>
    </footer>
  </body>
</html>
`

const linkedInCompanyPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>INDmoney | LinkedIn</title>
  </head>
  <body>
    <h1>INDmoney</h1>
    <p>Financial Services</p>
    <p>Invest in India and US Markets from one app | Stocks, F&O, Mutual Funds, NPS, UPI & more | Your money works Day & Night</p>
    <p>Website</p>
    <a href="https://www.indmoney.com">https://www.indmoney.com</a>
    <p>Gurgaon, Haryana 122005, IN</p>
  </body>
</html>
`

const linkedInSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>12 Indmoney jobs in India</title>
  </head>
  <body>
    <h1>12 Indmoney Jobs in India</h1>
    <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4436703686">
      <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&amp;pageNum=0"></a>
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">Associate Product Manager – Growth</h3>
        <h4 class="base-search-card__subtitle">
          <a class="hidden-nested-link" href="https://www.linkedin.com/company/indmoney/">INDmoney</a>
        </h4>
        <div class="base-search-card__metadata">
          <span class="job-search-card__location">Gurugram, Haryana, India</span>
          <time class="job-search-card__listdate" datetime="2026-07-03">1 week ago</time>
        </div>
      </div>
    </div>
    <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4434953664">
      <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/platform-engineer-sre-at-indmoney-4434953664?position=2&amp;pageNum=0"></a>
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">Platform Engineer-SRE</h3>
        <h4 class="base-search-card__subtitle">
          <a class="hidden-nested-link" href="https://www.linkedin.com/company/indmoney/">INDmoney</a>
        </h4>
        <div class="base-search-card__metadata">
          <span class="job-search-card__location">Gurugram, Haryana, India</span>
          <time class="job-search-card__listdate" datetime="2026-07-08">1 week ago</time>
        </div>
      </div>
    </div>
    <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4433812999">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/global-stocks-role-4433812999"></a>
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">AVP/VP - Business Head - Global Stocks</h3>
        <h4 class="base-search-card__subtitle">
          <a class="hidden-nested-link" href="https://www.linkedin.com/company/coindcx/">CoinDCX</a>
        </h4>
        <div class="base-search-card__metadata">
          <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
          <time class="job-search-card__listdate" datetime="2026-07-09">1 week ago</time>
        </div>
      </div>
    </div>
  </body>
</html>
`

const detailHtml = `
<html>
  <head>
    <title>INDmoney hiring Associate Product Manager – Growth in Gurugram, Haryana, India | LinkedIn</title>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "datePosted": "2026-07-03T10:19:42.000Z",
        "description": "&lt;p&gt;About the Role&lt;/p&gt;&lt;p&gt;Own product-led growth levers across onboarding, activation, engagement, referral, and retention.&lt;/p&gt;",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "INDmoney"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "IN",
            "addressLocality": "Gurugram",
            "addressRegion": "Haryana"
          }
        },
        "title": "Associate Product Manager – Growth"
      }
    </script>
  </head>
  <body></body>
</html>
`

const cloudflareChallengeHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <h1>Verification required</h1>
    <p>Enable JavaScript and cookies to continue</p>
    <p>Performance and Security by Cloudflare</p>
  </body>
</html>
`

test('INDwealth pins the verified redirect, official about-page LinkedIn handoff, and public LinkedIn jobs surface', async () => {
  const indwealth = await loadModule()

  assert.equal(indwealth.SOURCE, 'indwealth')
  assert.equal(indwealth.COMPANY, 'INDwealth')
  assert.equal(indwealth.OFFICIAL_REDIRECT_SOURCE_URL, 'https://www.indwealth.in/')
  assert.equal(indwealth.OFFICIAL_BRAND_HOMEPAGE_URL, 'https://www.indmoney.com/')
  assert.equal(indwealth.OFFICIAL_ABOUT_URL, 'https://www.indmoney.com/about')
  assert.equal(indwealth.LINKEDIN_COMPANY_JOBS_URL, 'https://www.linkedin.com/company/indmoney/jobs/')
  assert.equal(indwealth.LINKEDIN_COMPANY_PAGE_URL, 'https://in.linkedin.com/company/indmoney')
  assert.equal(indwealth.LINKEDIN_PUBLIC_JOBS_URL, 'https://in.linkedin.com/jobs/indmoney-jobs')
  assert.equal(
    indwealth.hasVerifiedRedirectHomepageSignal({
      url: 'https://www.indmoney.com/',
      html: redirectHomepageHtml,
    }),
    true,
  )
  assert.equal(indwealth.hasVerifiedAboutPageSignal(aboutPageHtml), true)
  assert.equal(
    indwealth.extractLinkedInCompanyJobsUrl(aboutPageHtml),
    'https://www.linkedin.com/company/indmoney/jobs/',
  )
  assert.equal(
    indwealth.hasVerifiedLinkedInCompanySignal({
      url: 'https://in.linkedin.com/company/indmoney',
      html: linkedInCompanyPageHtml,
    }),
    true,
  )
  assert.equal(indwealth.hasPublicLinkedInJobsSignal(linkedInSearchHtml), true)
  assert.equal(indwealth.hasCloudflareChallengePageSignal(cloudflareChallengeHtml), true)
})

test('INDwealth keeps only real INDmoney India jobs from the public LinkedIn search page and enriches details', async () => {
  const indwealth = await loadModule()
  const listings = indwealth.extractSearchResults(linkedInSearchHtml)
  const detail = indwealth.extractJobDetail(detailHtml)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Associate Product Manager – Growth',
    company: 'INDmoney',
    department: null,
    location: 'Gurugram, Haryana, India',
    city: 'Gurugram',
    country: 'India',
    jobId: '4436703686',
    requisitionId: '4436703686',
    sourceUrl: 'https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&pageNum=0',
    applyUrl: 'https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-03',
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(detail, {
    title: 'Associate Product Manager – Growth',
    company: 'INDmoney',
    location: 'Gurugram, Haryana, India',
    city: 'Gurugram',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-07-03',
    jobDescription: 'About the Role Own product-led growth levers across onboarding, activation, engagement, referral, and retention.',
  })
})

test('INDwealth run validates the official redirect and LinkedIn handoff, then decorates public INDmoney jobs', async () => {
  const indwealth = await loadModule()
  const requestedPages = []
  const requestedTexts = []

  const jobs = await indwealth.createIndwealthScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === indwealth.OFFICIAL_REDIRECT_SOURCE_URL) {
        return { status: 200, url: 'https://www.indmoney.com/', html: redirectHomepageHtml }
      }

      if (url === indwealth.OFFICIAL_ABOUT_URL) {
        return { status: 200, url, html: aboutPageHtml }
      }

      if (url === indwealth.LINKEDIN_COMPANY_JOBS_URL) {
        return { status: 200, url: 'https://in.linkedin.com/company/indmoney', html: linkedInCompanyPageHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === indwealth.LINKEDIN_PUBLIC_JOBS_URL) return linkedInSearchHtml
      if (url === 'https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&pageNum=0') {
        return detailHtml
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requestedPages, [
    indwealth.OFFICIAL_REDIRECT_SOURCE_URL,
    indwealth.OFFICIAL_ABOUT_URL,
    indwealth.LINKEDIN_COMPANY_JOBS_URL,
  ])
  assert.deepEqual(requestedTexts, [
    indwealth.LINKEDIN_PUBLIC_JOBS_URL,
    'https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&pageNum=0',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'indwealth')
  assert.equal(jobs[0].company, 'INDmoney')
  assert.equal(
    jobs[0].link,
    'https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&pageNum=0',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('INDwealth run tolerates the verified blocked first-party redirect and about routes while continuing with the public LinkedIn surfaces', async () => {
  const indwealth = await loadModule()
  const requestedPages = []
  const requestedTexts = []

  const jobs = await indwealth.createIndwealthScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === indwealth.OFFICIAL_REDIRECT_SOURCE_URL) {
        return { status: 403, url: 'https://www.indmoney.com/', html: cloudflareChallengeHtml }
      }

      if (url === indwealth.OFFICIAL_ABOUT_URL) {
        return { status: 403, url, html: cloudflareChallengeHtml }
      }

      if (url === indwealth.LINKEDIN_COMPANY_JOBS_URL) {
        return { status: 200, url: 'https://in.linkedin.com/company/indmoney', html: linkedInCompanyPageHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === indwealth.LINKEDIN_PUBLIC_JOBS_URL) return linkedInSearchHtml
      if (url === 'https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&pageNum=0') {
        return detailHtml
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    now: () => '2026-08-15T00:00:00.000Z',
  })

  assert.deepEqual(requestedPages, [
    indwealth.OFFICIAL_REDIRECT_SOURCE_URL,
    indwealth.OFFICIAL_ABOUT_URL,
    indwealth.LINKEDIN_COMPANY_JOBS_URL,
  ])
  assert.deepEqual(requestedTexts, [
    indwealth.LINKEDIN_PUBLIC_JOBS_URL,
    'https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&pageNum=0',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'indwealth')
  assert.equal(jobs[0].company, 'INDmoney')
  assert.equal(
    jobs[0].link,
    'https://in.linkedin.com/jobs/view/associate-product-manager-%E2%80%93-growth-at-indmoney-4436703686?position=1&pageNum=0',
  )
  assert.equal(jobs[0].scrapedAt, '2026-08-15T00:00:00.000Z')
})

test('INDwealth fails closed when the first-party redirect is challenged without the verified redirect-to-INDmoney target', async () => {
  const indwealth = await loadModule()

  await assert.rejects(indwealth.createIndwealthScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      if (url === indwealth.OFFICIAL_REDIRECT_SOURCE_URL) {
        return { status: 403, url, html: cloudflareChallengeHtml }
      }
      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchBrowserPage: async () => assert.fail('INDwealth must not launch a browser'),
  }), /official indwealth redirect no longer matches the verified indmoney homepage surface/i)
})

test('INDwealth fails closed when the redirect target, about-page handoff, LinkedIn company page, or public jobs surface drifts', async () => {
  const indwealth = await loadModule()

  await assert.rejects(
    indwealth.createIndwealthScraper().run({
      fetchPage: async (url) => {
        if (url === indwealth.OFFICIAL_REDIRECT_SOURCE_URL) {
          return { status: 200, url: 'https://www.somewhereelse.com/', html: redirectHomepageHtml }
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => linkedInSearchHtml,
    }),
    /official indwealth redirect/i,
  )

  await assert.rejects(
    indwealth.createIndwealthScraper().run({
      fetchPage: async (url) => {
        if (url === indwealth.OFFICIAL_REDIRECT_SOURCE_URL) {
          return { status: 200, url: 'https://www.indmoney.com/', html: redirectHomepageHtml }
        }
        if (url === indwealth.OFFICIAL_ABOUT_URL) {
          return {
            status: 200,
            url,
            html: aboutPageHtml.replace(
              'https://www.linkedin.com/company/indmoney/jobs/',
              'https://www.linkedin.com/company/indmoney/',
            ),
          }
        }
        if (url === indwealth.LINKEDIN_COMPANY_JOBS_URL) {
          return { status: 200, url: 'https://in.linkedin.com/company/indmoney', html: linkedInCompanyPageHtml }
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => linkedInSearchHtml,
    }),
    /linkedin handoff changed materially/i,
  )

  await assert.rejects(
    indwealth.createIndwealthScraper().run({
      fetchPage: async (url) => {
        if (url === indwealth.OFFICIAL_REDIRECT_SOURCE_URL) {
          return { status: 200, url: 'https://www.indmoney.com/', html: redirectHomepageHtml }
        }
        if (url === indwealth.OFFICIAL_ABOUT_URL) {
          return { status: 200, url, html: aboutPageHtml }
        }
        if (url === indwealth.LINKEDIN_COMPANY_JOBS_URL) {
          return { status: 200, url: 'https://in.linkedin.com/company/indmoney', html: '<html><body>LinkedIn</body></html>' }
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => linkedInSearchHtml,
    }),
    /linkedin company page changed materially/i,
  )

  await assert.rejects(
    indwealth.createIndwealthScraper().run({
      fetchPage: async (url) => {
        if (url === indwealth.OFFICIAL_REDIRECT_SOURCE_URL) {
          return { status: 200, url: 'https://www.indmoney.com/', html: redirectHomepageHtml }
        }
        if (url === indwealth.OFFICIAL_ABOUT_URL) {
          return { status: 200, url, html: aboutPageHtml }
        }
        if (url === indwealth.LINKEDIN_COMPANY_JOBS_URL) {
          return { status: 200, url: 'https://in.linkedin.com/company/indmoney', html: linkedInCompanyPageHtml }
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async (url) => {
        if (url === indwealth.LINKEDIN_PUBLIC_JOBS_URL) {
          return '<html><body><h1>LinkedIn</h1><p>No verified jobs markers.</p></body></html>'
        }
        return detailHtml
      },
    }),
    /public indmoney linkedin jobs surface/i,
  )
})
