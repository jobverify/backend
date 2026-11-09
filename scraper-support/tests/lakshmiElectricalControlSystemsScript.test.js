import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'lakshmielectricalcontrolsystems')

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const contactHtml = readFixture('contact-us.html')
const currentContactHtml = `
  <html>
    <head>
      <title>Contact Us - LECS</title>
    </head>
    <body>
      <nav>
        <a href="https://www.lecsindia.com/careers">Careers</a>
      </nav>
      <main>
        <h1>Let's Connect</h1>
        <p>Email us at</p>
        <p>info@lecsindia.com</p>
        <p>Give us a call at</p>
        <p>Phone: +91-422-6616500</p>
        <p>Non-Business Queries Only</p>
        <p>contact@lecsindia.com</p>
        <h2>Get In touch</h2>
        <p>Main Address</p>
        <p>Lakshmi Electrical Control Systems Limited, Arasur, Coimbatore - 641 407, Tamilnadu, India</p>
      </main>
    </body>
  </html>
`

const currentHomepageHtml = `
  <html>
    <head>
      <title>LECS</title>
    </head>
    <body>
      <nav>
        Menu HOME ABOUT US PRODUCT INDUSTRIES INVESTORS PARTNER WITH US PHOTO GALLERY
        <a href="https://www.lecsindia.com/careers">CAREERS</a>
        NEWS CONTACT US LECS
      </nav>
      <main>
        <h1>EV CHARGERS</h1>
        <h2>WHAT WE OFFER</h2>
        <h2>Industries We Serve</h2>
        <h2>CREDENTIALS</h2>
        <p>LECS excels in providing unmatched solutions in all major lines of business.</p>
        <p>Annual Turnover</p>
        <p>Let's discuss how our solutions can drive your business forward with reliability and innovation.</p>
      </main>
    </body>
  </html>
`

const currentCareersHtml = `
  <html>
    <head>
      <title>Careers | LECS India</title>
    </head>
    <body>
      <nav>
        Menu HOME ABOUT US PRODUCT INDUSTRIES INVESTORS PARTNER WITH US PHOTO GALLERY CAREERS NEWS CONTACT US LECS
      </nav>
      <main>
        <h1>Careers</h1>
        <p>Careers | LECS India</p>
        <a href="https://www.linkedin.com/company/lecsindia/">LinkedIn</a>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/lakshmielectricalcontrolsystems/script.js')
  } catch {
    assert.fail(
      'Expected Lakshmi Electrical Control Systems scraper module at ../../scraper/lakshmielectricalcontrolsystems/script.js',
    )
  }
}

test('Lakshmi Electrical Control Systems recognizes the verified official homepage, careers shell, and contact zero-job surfaces', async () => {
  const lecs = await loadModule()

  assert.equal(lecs.SOURCE, 'lakshmielectricalcontrolsystems')
  assert.equal(lecs.COMPANY, 'Lakshmi Electrical Control Systems')
  assert.equal(lecs.HOMEPAGE_URL, 'https://www.lecsindia.com/')
  assert.equal(lecs.CAREERS_URL, 'https://www.lecsindia.com/careers')
  assert.equal(lecs.CONTACT_URL, 'https://www.lecsindia.com/contact-us/')
  assert.equal(lecs.VERIFIED_ON, '2026-10-03')

  assert.equal(lecs.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(lecs.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(lecs.hasOfficialCareersPageSignal(currentCareersHtml), true)
  assert.equal(lecs.hasOfficialContactSignal(contactHtml), true)
  assert.equal(lecs.hasOfficialContactSignal(currentContactHtml), true)
  assert.equal(lecs.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(lecs.hasFirstPartyCareerLikeLink(currentHomepageHtml), true)
  assert.equal(lecs.hasFirstPartyCareerLikeLink(currentContactHtml), true)
  assert.equal(lecs.hasFirstPartyCareerLikeLink(contactHtml), false)
  assert.equal(lecs.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(lecs.hasPublicJobsSignal(currentCareersHtml), false)
  assert.equal(lecs.hasPublicJobsSignal(contactHtml), false)
})

test('Lakshmi Electrical Control Systems returns no jobs while the verified first-party careers shell exposes no public jobs', async () => {
  const lecs = await loadModule()
  const requestedUrls = []

  const jobs = await lecs.createLakshmiElectricalControlSystemsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === lecs.HOMEPAGE_URL) return currentHomepageHtml
      if (url === lecs.CAREERS_URL) return currentCareersHtml
      if (url === lecs.CONTACT_URL) return currentContactHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    lecs.HOMEPAGE_URL,
    lecs.CAREERS_URL,
    lecs.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Lakshmi Electrical Control Systems falls back to a slower verified-page fetch when the first-party site times out', async () => {
  const lecs = await loadModule()
  const primaryRequests = []
  const slowRequests = []

  const jobs = await lecs.createLakshmiElectricalControlSystemsScraper().run({
    fetchText: async (url) => {
      primaryRequests.push(url)
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    },
    fetchTextWithExtendedTimeout: async (url) => {
      slowRequests.push(url)

      if (url === lecs.HOMEPAGE_URL) return currentHomepageHtml
      if (url === lecs.CAREERS_URL) return currentCareersHtml
      if (url === lecs.CONTACT_URL) return currentContactHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(primaryRequests, [
    lecs.HOMEPAGE_URL,
    lecs.CAREERS_URL,
    lecs.CONTACT_URL,
  ])
  assert.deepEqual(slowRequests, primaryRequests)
  assert.deepEqual(jobs, [])
})

test('Lakshmi Electrical Control Systems fails closed when the verified zero-job public surface drifts', async () => {
  const lecs = await loadModule()

  await assert.rejects(
    lecs.createLakshmiElectricalControlSystemsScraper().run({
      fetchText: async (url) => {
        if (url === lecs.HOMEPAGE_URL) {
          return '<html><body><h1>Placeholder</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    lecs.createLakshmiElectricalControlSystemsScraper().run({
      fetchText: async (url) => {
        if (url === lecs.HOMEPAGE_URL) return currentHomepageHtml
        if (url === lecs.CAREERS_URL) {
          return '<html><body><h1>Broken careers page</h1></body></html>'
        }
        if (url === lecs.CONTACT_URL) return currentContactHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers page/i,
  )

  await assert.rejects(
    lecs.createLakshmiElectricalControlSystemsScraper().run({
      fetchText: async (url) => {
        if (url === lecs.HOMEPAGE_URL) return currentHomepageHtml
        if (url === lecs.CAREERS_URL) {
          return currentCareersHtml.replace(
            '</main>',
            '<section><h2>Current Openings</h2><a href="/jobs/design-engineer">Apply now</a></section></main>',
          )
        }
        if (url === lecs.CONTACT_URL) return currentContactHtml

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page now exposes public jobs/i,
  )
})

const publishedCareersShell = '<html><head><title>Careers at LECS India | Explore Jobs &amp; Career Opportunities</title><link rel="canonical" href="https://lecsindia.com/careers"></head><body><nav>LECS Careers</nav><script src="/_next/static/chunks/app/careers/page-current.js"></script></body></html>'
const publishedCareersClient = 'https://api.lecsindia.com /job?page= /job/dropdown CareersHeroSection'

test('LECS follows its verified public careers client and paginates jobs with evidenced India locations', async () => {
  const lecs = await loadModule()
  const pages = []
  const jobs = await lecs.createLakshmiElectricalControlSystemsScraper({ now: () => '2026-10-03T00:00:00Z' }).run({
    fetchText: async (url) => url === lecs.HOMEPAGE_URL ? currentHomepageHtml.replace('<title>LECS</title>', '<title>Discover Control Panel Manufacturer Solutions | LECS India</title>') : url.endsWith('.js') ? publishedCareersClient : publishedCareersShell,
    fetchJson: async (url) => {
      const page = Number(new URL(url).searchParams.get('page'))
      pages.push(page)
      return { success: true, pagination: { currentPage: page, totalPages: 2, totalJobs: 2, hasNext: page === 1 }, jobs: page === 1 ? [
        { _id: 'located', title: 'Marketing Engineer', department: 'Engineering', type: 'Full Time', description: '<p>This role based in Coimbatore handles control panels.</p>', createdAt: '2026-06-26T00:00:00Z' },
      ] : [
        { _id: 'no-location', title: 'Tool maker', type: 'Full Time', description: '<p>Assemble moulds.</p>' },
      ] }
    },
  })
  assert.deepEqual(pages, [1, 2])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Coimbatore')
  assert.equal(jobs[0].location, 'Coimbatore, India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.match(jobs[0].jobDescription, /control panels/)
  assert.equal(jobs[0].sourceUrl, lecs.CAREERS_URL)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('LECS refuses unverified client backends and incomplete job pagination', async () => {
  const lecs = await loadModule()
  for (const [client, feed] of [
    ['https://unverified.example /job?page= /job/dropdown CareersHeroSection', null],
    [publishedCareersClient, { success: true, jobs: [], pagination: { currentPage: 1, totalPages: 1, totalJobs: 3, hasNext: false } }],
  ]) {
    await assert.rejects(lecs.createLakshmiElectricalControlSystemsScraper().run({
      fetchText: async (url) => url === lecs.HOMEPAGE_URL ? currentHomepageHtml.replace('<title>LECS</title>', '<title>Discover Control Panel Manufacturer Solutions | LECS India</title>') : url.endsWith('.js') ? client : publishedCareersShell,
      fetchJson: async () => feed,
    }), /verified.*client|jobs feed|incomplete/i)
  }
})
