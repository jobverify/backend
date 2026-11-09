import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T00:00:00.000Z'
const LINKEDIN_COMPANY_PAGE_URL = 'https://www.linkedin.com/company/snapdeal/'
const LINKEDIN_WORLDWIDE_JOBS_URL = 'https://www.linkedin.com/jobs/snapdeal-jobs-worldwide?f_C=2100709'
const LINKEDIN_PUBLIC_JOBS_URL = 'https://www.linkedin.com/jobs/search/?f_C=2100709&geoId=102713980'
const DETAIL_URL = 'https://in.linkedin.com/jobs/view/lead-software-engineer-at-snapdeal-4450897171?position=1&pageNum=0'

const OFFICIAL_HOME_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Online shopping for Men, Women &amp; Kids Fashion, Home Decor, lifestyle &amp; More</title>
  </head>
  <body>
    <main>
      <div>FREE Delivery</div>
      <div>7 Days Easy Returns</div>
      <div>Best Prices</div>
      <section>
        <h2>Company</h2>
        <a href="${LINKEDIN_COMPANY_PAGE_URL}">Careers</a>
        <a href="https://blog.snapdeal.com/">Blog</a>
      </section>
      <p>Snapdeal is India's leading pure-play value Ecommerce platform.</p>
      <p>Snapdeal's vision is to enable the shoppers of Bharat to experience the joy of living their aspirations.</p>
      <p>Copyright Acevector Limited. All Rights Reserved</p>
    </main>
  </body>
</html>
`

const OFFICIAL_ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us: Snapdeal.com - India's Largest Online Marketplace</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>Snapdeal.com is India's largest online marketplace built for Bharat.</p>
      <p>Acevector supports the Snapdeal platform.</p>
      <section>
        <h2>Company</h2>
        <a href="https://www.snapdeal.com/page/about-us">About Us</a>
        <a href="${LINKEDIN_COMPANY_PAGE_URL}">Careers</a>
        <a href="https://blog.snapdeal.com/">Blog</a>
      </section>
    </main>
  </body>
</html>
`

const LINKEDIN_COMPANY_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Snapdeal | LinkedIn</title>
  </head>
  <body>
    <main>
      <div>urn:li:organization:2100709</div>
      <a href="https://www.snapdeal.com">Website</a>
      <a href="${LINKEDIN_WORLDWIDE_JOBS_URL}" data-tracking-control-name="top-card_top-card-primary-button-top-card-primary-cta">See jobs</a>
    </main>
  </body>
</html>
`

const LINKEDIN_LISTINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>3 Jobs jobs in India</title>
  </head>
  <body>
    <div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:4450897171">
      <a class="base-card__full-link" href="${DETAIL_URL}"></a>
      <h3 class="base-search-card__title">Lead Software Engineer</h3>
      <h4 class="base-search-card__subtitle"><a>Snapdeal</a></h4>
      <span class="job-search-card__location">Gurugram, Haryana, India</span>
      <time class="job-search-card__listdate" datetime="2026-08-14"></time>
    </div>
    <div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:4443097895">
      <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/senior-manager-associate-director-hr-at-snapdeal-4443097895?position=2&amp;pageNum=0"></a>
      <h3 class="base-search-card__title">Senior Manager / Associate Director - HR</h3>
      <h4 class="base-search-card__subtitle"><a>Snapdeal</a></h4>
      <span class="job-search-card__location">Gurugram, Haryana, India</span>
      <time class="job-search-card__listdate" datetime="2026-08-13"></time>
    </div>
    <div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:4453073123">
      <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/training-content-video-production-intern-at-snapdeal-4453073123?position=3&amp;pageNum=0"></a>
      <h3 class="base-search-card__title">Training Content &amp; Video Production Intern</h3>
      <h4 class="base-search-card__subtitle"><a>Snapdeal</a></h4>
      <span class="job-search-card__location">Gurugram, Haryana, India</span>
      <time class="job-search-card__listdate" datetime="2026-08-12"></time>
    </div>
  </body>
</html>
`

const LINKEDIN_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "datePosted": "2026-08-14T07:28:58.000Z",
        "description": "&lt;p&gt;We are looking for a Lead Engineer to design and scale our core applications using Java, Spring Boot, APIs, and system design.&lt;/p&gt;",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Snapdeal"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "IN",
            "addressLocality": "Gurugram",
            "addressRegion": null
          }
        },
        "title": "Lead Software Engineer"
      }
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/snapdeal/script.js')
  } catch {
    assert.fail('Expected Snapdeal scraper module at ../../scraper/snapdeal/script.js')
  }
}

test('Snapdeal pins the verified first-party LinkedIn handoff and public jobs surface', async () => {
  const snapdeal = await loadModule()

  assert.equal(snapdeal.SOURCE, 'snapdeal')
  assert.equal(snapdeal.COMPANY_NAME, 'Snapdeal')
  assert.equal(snapdeal.OFFICIAL_BRAND_NAME, 'Snapdeal')
  assert.equal(snapdeal.OFFICIAL_CAREERS_URL, 'https://www.snapdeal.com/')
  assert.equal(snapdeal.OFFICIAL_ABOUT_URL, 'https://www.snapdeal.com/page/about-us')
  assert.equal(snapdeal.OFFICIAL_CAREERS_HANDOFF_URL, LINKEDIN_COMPANY_PAGE_URL)
  assert.equal(snapdeal.LINKEDIN_WORLDWIDE_JOBS_URL, LINKEDIN_WORLDWIDE_JOBS_URL)
  assert.equal(snapdeal.LINKEDIN_PUBLIC_JOBS_URL, LINKEDIN_PUBLIC_JOBS_URL)
  assert.equal(
    snapdeal.extractLinkedInCompanyPageUrl(OFFICIAL_HOME_HTML),
    LINKEDIN_COMPANY_PAGE_URL,
  )
  assert.equal(
    snapdeal.extractLinkedInCompanyPageUrl(OFFICIAL_ABOUT_HTML),
    LINKEDIN_COMPANY_PAGE_URL,
  )
  assert.equal(snapdeal.hasOfficialSnapdealHomepageSignal(OFFICIAL_HOME_HTML), true)
  assert.equal(snapdeal.hasOfficialSnapdealAboutPageSignal(OFFICIAL_ABOUT_HTML), true)
  assert.equal(
    snapdeal.hasVerifiedLinkedInCompanySignal({
      url: LINKEDIN_COMPANY_PAGE_URL,
      html: LINKEDIN_COMPANY_HTML,
    }),
    true,
  )
  assert.equal(snapdeal.hasPublicLinkedInJobsSignal(LINKEDIN_LISTINGS_HTML), true)
  assert.deepEqual(snapdeal.extractSearchResults(LINKEDIN_LISTINGS_HTML), [
    {
      title: 'Lead Software Engineer',
      company: 'Snapdeal',
      department: null,
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '4450897171',
      requisitionId: '4450897171',
      sourceUrl: DETAIL_URL,
      applyUrl: DETAIL_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-14',
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Senior Manager / Associate Director - HR',
      company: 'Snapdeal',
      department: null,
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '4443097895',
      requisitionId: '4443097895',
      sourceUrl: 'https://in.linkedin.com/jobs/view/senior-manager-associate-director-hr-at-snapdeal-4443097895?position=2&pageNum=0',
      applyUrl: 'https://in.linkedin.com/jobs/view/senior-manager-associate-director-hr-at-snapdeal-4443097895?position=2&pageNum=0',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-13',
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Training Content & Video Production Intern',
      company: 'Snapdeal',
      department: null,
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '4453073123',
      requisitionId: '4453073123',
      sourceUrl: 'https://in.linkedin.com/jobs/view/training-content-video-production-intern-at-snapdeal-4453073123?position=3&pageNum=0',
      applyUrl: 'https://in.linkedin.com/jobs/view/training-content-video-production-intern-at-snapdeal-4453073123?position=3&pageNum=0',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-12',
      closingDate: null,
      jobDescription: null,
    },
  ])
  assert.deepEqual(snapdeal.extractJobDetail(LINKEDIN_DETAIL_HTML), {
    title: 'Lead Software Engineer',
    company: 'Snapdeal',
    location: 'Gurugram, India',
    city: 'Gurugram',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-08-14',
    jobDescription: 'We are looking for a Lead Engineer to design and scale our core applications using Java, Spring Boot, APIs, and system design.',
  })
  assert.equal(
    snapdeal.hasOfficialSnapdealHomepageSignal(
      OFFICIAL_HOME_HTML.replace(LINKEDIN_COMPANY_PAGE_URL, 'https://example.com/jobs'),
    ),
    false,
  )
})

test('Snapdeal run validates the official LinkedIn handoff before mapping India jobs', async () => {
  const { createSnapdealScraper } = await loadModule()
  const requestedPages = []
  const requestedTexts = []
  const scraper = createSnapdealScraper({
    maxJobs: 1,
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === 'https://www.snapdeal.com/') {
        return { status: 200, url, html: OFFICIAL_HOME_HTML }
      }

      if (url === 'https://www.snapdeal.com/page/about-us') {
        return { status: 200, url, html: OFFICIAL_ABOUT_HTML }
      }

      if (url === LINKEDIN_COMPANY_PAGE_URL) {
        return { status: 200, url: LINKEDIN_COMPANY_PAGE_URL, html: LINKEDIN_COMPANY_HTML }
      }

      throw new Error(`Unexpected page URL ${url}`)
    },
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === LINKEDIN_PUBLIC_JOBS_URL) return LINKEDIN_LISTINGS_HTML
      if (url === DETAIL_URL) return LINKEDIN_DETAIL_HTML

      throw new Error(`Unexpected text URL ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    'https://www.snapdeal.com/',
    'https://www.snapdeal.com/page/about-us',
    LINKEDIN_COMPANY_PAGE_URL,
  ])
  assert.deepEqual(requestedTexts, [
    LINKEDIN_PUBLIC_JOBS_URL,
    DETAIL_URL,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Lead Software Engineer',
      company: 'Snapdeal',
      department: null,
      location: 'Gurugram, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '4450897171',
      requisitionId: '4450897171',
      sourceUrl: DETAIL_URL,
      applyUrl: DETAIL_URL,
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-14',
      closingDate: null,
      jobDescription: 'We are looking for a Lead Engineer to design and scale our core applications using Java, Spring Boot, APIs, and system design.',
      source: 'snapdeal',
      link: DETAIL_URL,
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Snapdeal fails closed when the verified first-party careers handoff drifts', async () => {
  const { createSnapdealScraper } = await loadModule()
  const scraper = createSnapdealScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === 'https://www.snapdeal.com/') {
          return {
            status: 200,
            url,
            html: OFFICIAL_HOME_HTML.replace(LINKEDIN_COMPANY_PAGE_URL, 'https://example.com/jobs'),
          }
        }

        if (url === 'https://www.snapdeal.com/page/about-us') {
          return { status: 200, url, html: OFFICIAL_ABOUT_HTML }
        }

        if (url === LINKEDIN_COMPANY_PAGE_URL) {
          return { status: 200, url: LINKEDIN_COMPANY_PAGE_URL, html: LINKEDIN_COMPANY_HTML }
        }

        throw new Error(`Unexpected page URL ${url}`)
      },
      fetchText: async () => LINKEDIN_LISTINGS_HTML,
    }),
    /verified official homepage careers handoff/i,
  )
})
