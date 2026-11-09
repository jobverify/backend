import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'newstreettechnologies',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadNewStreetTechnologiesModule = async () => {
  try {
    return await import('../../scraper/newstreettechnologies/script.js')
  } catch {
    assert.fail('Expected New Street Technologies scraper module at ../../scraper/newstreettechnologies/script.js')
  }
}

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedContactHtml = readFixture('contact.html')
const verifiedZeroJobRouteHtml = '<html><head><title>404 Not Found</title></head><body>Not Found</body></html>'
const expectedPublicJobRouteUrls = [
  'https://newstreettech.com/careers',
  'https://newstreettech.com/careers/',
  'https://newstreettech.com/career',
  'https://newstreettech.com/career/',
  'https://newstreettech.com/jobs',
  'https://newstreettech.com/jobs/',
  'https://newstreettech.com/join-us',
  'https://newstreettech.com/join-us/',
  'https://newstreettech.com/work-with-us',
  'https://newstreettech.com/work-with-us/',
]

const careersHtml = '<html><head><title>Careers — New Street Technologies</title></head><body><h1>Open Roles</h1><span>All roles<span> · <!-- -->3</span></span><a href="/careers/engineering-lead">Engineering Lead</a><a href="/careers/ai-ml-engineer">AI / ML Engineer</a><a href="/careers/software-engineer-backend">Software Engineer · Backend</a></body></html>'
const roleHtml = (title, experience) => '<html><head><title>' + title + ' — Careers at New Street Technologies</title><meta name="description" content="Help build our financial platform."/></head><body><h1>' + title + '</h1><button aria-haspopup="dialog">Apply for this role</button><p>Experience</p><p>' + experience + '</p><p>Location</p><p>Bengaluru</p></body></html>'

test('New Street Technologies collects all advertised first-party careers roles', async () => {
  const newStreetTechnologies = await loadNewStreetTechnologiesModule()
  const rolePages = new Map([
    ['https://newstreettech.com/careers/engineering-lead', roleHtml('Engineering Lead', '8–10 years')],
    ['https://newstreettech.com/careers/ai-ml-engineer', roleHtml('AI / ML Engineer', '3–5 years')],
    ['https://newstreettech.com/careers/software-engineer-backend', roleHtml('Software Engineer · Backend', '1–2 years').replace('Software Engineer · Backend — Careers', 'Software Engineer — Backend — Careers')],
  ])
  const jobs = await newStreetTechnologies.run({
    fetchPage: async (url) => {
      if (url === newStreetTechnologies.HOMEPAGE_URL) return { status: 200, url, html: verifiedHomepageHtml }
      if (url === newStreetTechnologies.CONTACT_URL) return { status: 200, url, html: verifiedContactHtml }
      if (url === newStreetTechnologies.PUBLIC_JOB_ROUTE_URLS[0]) return { status: 200, url, html: careersHtml }
      if (rolePages.has(url)) return { status: 200, url, html: rolePages.get(url) }
      throw new Error('Unexpected URL: ' + url)
    },
    now: () => '2026-10-03T00:00:00.000Z',
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => job.jobId), ['engineering-lead', 'ai-ml-engineer', 'software-engineer-backend'])
  assert.deepEqual(jobs.map((job) => job.title), ['Engineering Lead', 'AI / ML Engineer', 'Software Engineer · Backend'])
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].sourceUrl, 'https://newstreettech.com/careers/engineering-lead')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].experienceRequired, '8–10 years')
  assert.equal(jobs[0].scrapedAt, '2026-10-03T00:00:00.000Z')
})

test('New Street Technologies rejects an incomplete first-party careers listing or missing application surface', async () => {
  const newStreetTechnologies = await loadNewStreetTechnologiesModule()
  const fetchPage = async (url) => {
    if (url === newStreetTechnologies.HOMEPAGE_URL) return { status: 200, url, html: verifiedHomepageHtml }
    if (url === newStreetTechnologies.CONTACT_URL) return { status: 200, url, html: verifiedContactHtml }
    if (url === newStreetTechnologies.PUBLIC_JOB_ROUTE_URLS[0]) return { status: 200, url, html: careersHtml.replace('<!-- -->3', '<!-- -->4') }
    throw new Error('Unexpected URL: ' + url)
  }
  await assert.rejects(newStreetTechnologies.run({ fetchPage }), /careers.*count|count.*careers/i)

  await assert.rejects(newStreetTechnologies.run({
    fetchPage: async (url) => {
      if (url === newStreetTechnologies.HOMEPAGE_URL) return { status: 200, url, html: verifiedHomepageHtml }
      if (url === newStreetTechnologies.CONTACT_URL) return { status: 200, url, html: verifiedContactHtml }
      if (url === newStreetTechnologies.PUBLIC_JOB_ROUTE_URLS[0]) return { status: 200, url, html: careersHtml }
      return { status: 200, url, html: '<title>Unverified role</title>' }
    },
  }), /verified role|application surface/i)
})

test('New Street Technologies recognizes the verified homepage, contact page, and public-jobs route list', async () => {
  const newStreetTechnologies = await loadNewStreetTechnologiesModule()

  assert.equal(newStreetTechnologies.SOURCE, 'newstreettechnologies')
  assert.equal(newStreetTechnologies.COMPANY, 'New Street Technologies')
  assert.equal(newStreetTechnologies.HOMEPAGE_URL, 'https://newstreettech.com/')
  assert.equal(newStreetTechnologies.CONTACT_URL, 'https://newstreettech.com/contact')
  assert.deepEqual(newStreetTechnologies.PUBLIC_JOB_ROUTE_URLS, expectedPublicJobRouteUrls)
  assert.equal(newStreetTechnologies.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(newStreetTechnologies.hasInlineHiringSignal(verifiedHomepageHtml), true)
  assert.equal(newStreetTechnologies.hasOfficialContactSignal(verifiedContactHtml), true)
  assert.equal(newStreetTechnologies.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(newStreetTechnologies.hasPublicJobsSignal(verifiedContactHtml), false)
})

test('New Street Technologies returns no jobs while the verified zero-job surfaces remain unchanged', async () => {
  const newStreetTechnologies = await loadNewStreetTechnologiesModule()
  const requestedUrls = []

  const jobs = await newStreetTechnologies.createNewStreetTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === newStreetTechnologies.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: verifiedHomepageHtml,
        }
      }

      if (url === newStreetTechnologies.CONTACT_URL) {
        return {
          status: 200,
          url,
          html: verifiedContactHtml,
        }
      }

      if (newStreetTechnologies.PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    newStreetTechnologies.HOMEPAGE_URL,
    newStreetTechnologies.CONTACT_URL,
    ...newStreetTechnologies.PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('New Street Technologies fails closed when the verified zero-job contract changes materially', async () => {
  const newStreetTechnologies = await loadNewStreetTechnologiesModule()

  await assert.rejects(
    newStreetTechnologies.createNewStreetTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === newStreetTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body>No trusted homepage signals</body></html>',
          }
        }

        if (url === newStreetTechnologies.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: verifiedContactHtml,
          }
        }

        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    newStreetTechnologies.createNewStreetTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === newStreetTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>New Street Technologies Pvt Ltd</title><meta name="description" content="New Street Technologies leverages blockchain, AI, and new age technologies to create Hi-tech Ecosystems for powerful re-imagination of your Products, Processes &amp; Partnerships."></head><body><a href="/contact">Contact</a><p>Leveraging blockchain, AI, and new age technologies to create Hi-tech Ecosystems for powerful re-imagination of your Products, Processes &amp; Partnerships.</p><a href="https://www.linkedin.com/company/newstreettech">LinkedIn</a><a href="https://mifix.ai/">Explore MiFiX.ai</a></body></html>',
          }
        }

        if (url === newStreetTechnologies.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: verifiedContactHtml,
          }
        }

        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      },
    }),
    /verified inline hiring surface/i,
  )

  await assert.rejects(
    newStreetTechnologies.createNewStreetTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === newStreetTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: verifiedHomepageHtml,
          }
        }

        if (url === newStreetTechnologies.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Contact — New Street Technologies</title></head><body><p>No verified hiring contact remains here.</p></body></html>',
          }
        }

        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      },
    }),
    /verified contact page/i,
  )

  await assert.rejects(
    newStreetTechnologies.createNewStreetTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === newStreetTechnologies.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: verifiedHomepageHtml,
          }
        }

        if (url === newStreetTechnologies.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: verifiedContactHtml,
          }
        }

        if (url === newStreetTechnologies.PUBLIC_JOB_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          html: verifiedZeroJobRouteHtml,
        }
      },
    }),
    /official careers page no longer matches the verified listing/i,
  )
})

test('New Street Technologies retries the verified homepage through the scoped insecure TLS fallback when the certificate is expired', async () => {
  const newStreetTechnologies = await loadNewStreetTechnologiesModule()
  const requestedUrls = []

  const certificateError = new TypeError('fetch failed')
  certificateError.cause = { code: 'CERT_HAS_EXPIRED', message: 'certificate has expired' }

  const fetchPage = newStreetTechnologies.createDefaultFetchPage({
    fetchImpl: async (url) => {
      requestedUrls.push(`fetch:${url}`)
      if (url === newStreetTechnologies.HOMEPAGE_URL) {
        throw certificateError
      }

      throw new Error(`Unexpected direct fetch URL: ${url}`)
    },
    fetchInsecurePageImpl: async (url) => {
      requestedUrls.push(`insecure:${url}`)

      if (url === newStreetTechnologies.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: verifiedHomepageHtml,
        }
      }

      throw new Error(`Unexpected insecure fetch URL: ${url}`)
    },
  })

  const page = await fetchPage(newStreetTechnologies.HOMEPAGE_URL)
  assert.equal(page.status, 200)
  assert.equal(page.html, verifiedHomepageHtml)
  assert.deepEqual(requestedUrls, [
    `fetch:${newStreetTechnologies.HOMEPAGE_URL}`,
    `insecure:${newStreetTechnologies.HOMEPAGE_URL}`,
  ])
})
