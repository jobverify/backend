import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'juzgodigital',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const blockedCareersXml = readFixture('careers-403.xml')

const loadJuzGoDigitalModule = async () => {
  try {
    return await import('../../scraper/juzgodigital/script.js')
  } catch {
    assert.fail('Expected JuzGoDigital scraper module at ../../scraper/juzgodigital/script.js')
  }
}

test('JuzGoDigital recognizes the verified official homepage and blocked careers routes', async () => {
  const juzgo = await loadJuzGoDigitalModule()

  assert.equal(juzgo.SOURCE, 'juzgodigital')
  assert.equal(juzgo.COMPANY, 'Juzgodigital Private Limited')
  assert.equal(juzgo.HOMEPAGE_URL, 'https://www.juzgodigital.com/')
  assert.deepEqual(juzgo.CAREERS_ROUTE_URLS, [
    'https://www.juzgodigital.com/careers',
    'https://www.juzgodigital.com/careers/',
    'https://www.juzgodigital.com/career',
    'https://www.juzgodigital.com/career/',
    'https://www.juzgodigital.com/jobs',
    'https://www.juzgodigital.com/jobs/',
    'https://www.juzgodigital.com/join-us',
    'https://www.juzgodigital.com/join-us/',
  ])
  assert.equal(juzgo.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(juzgo.hasFirstPartyCareerLikeLink(verifiedHomepageHtml), false)
  assert.equal(juzgo.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(
    juzgo.isVerifiedBlockedCareersRoute({
      status: 403,
      url: juzgo.CAREERS_ROUTE_URLS[0],
      headers: {},
      html: blockedCareersXml,
    }),
    true,
  )
})

test('JuzGoDigital tolerates the wrapped live homepage title while the verified homepage contract stays the same', async () => {
  const juzgo = await loadJuzGoDigitalModule()
  const wrappedTitleHomepageHtml = verifiedHomepageHtml.replace(
    'Hedge Fund Tech Solutions In Coimbatore, Blockchain Development Company India.',
    'Hedge Fund Tech Solutions In Coimbatore,\nBlockchain Development Company India.',
  )

  assert.equal(juzgo.hasOfficialHomepageSignal(wrappedTitleHomepageHtml), true)
})

test('JuzGoDigital returns no jobs only while the verified homepage and blocked careers routes remain unchanged', async () => {
  const juzgo = await loadJuzGoDigitalModule()
  const requestedUrls = []

  const jobs = await juzgo.createJuzGoDigitalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === juzgo.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (juzgo.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 403,
          url,
          headers: {},
          html: blockedCareersXml,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    juzgo.HOMEPAGE_URL,
    ...juzgo.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('JuzGoDigital fails closed when the homepage or blocked careers-route contract changes', async () => {
  const juzgo = await loadJuzGoDigitalModule()

  await assert.rejects(
    juzgo.createJuzGoDigitalScraper().run({
      fetchPage: async (url) => {
        if (url === juzgo.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Unexpected homepage</h1></body></html>',
          }
        }

        return {
          status: 403,
          url,
          headers: {},
          html: blockedCareersXml,
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    juzgo.createJuzGoDigitalScraper().run({
      fetchPage: async (url) => {
        if (url === juzgo.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml.replace(
              '</body>',
              '<a href="/careers">Careers</a></body>',
            ),
          }
        }

        return {
          status: 403,
          url,
          headers: {},
          html: blockedCareersXml,
        }
      },
    }),
    /first-party careers or jobs link/i,
  )

  await assert.rejects(
    juzgo.createJuzGoDigitalScraper().run({
      fetchPage: async (url) => {
        if (url === juzgo.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: `${verifiedHomepageHtml}<a href="https://jobs.ashbyhq.com/juzgodigital">Current Openings</a>`,
          }
        }

        return {
          status: 403,
          url,
          headers: {},
          html: blockedCareersXml,
        }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    juzgo.createJuzGoDigitalScraper().run({
      fetchPage: async (url) => {
        if (url === juzgo.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml,
          }
        }

        if (url === juzgo.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/jobs/full-stack-engineer">Apply now</a></body></html>',
          }
        }

        return {
          status: 403,
          url,
          headers: {},
          html: blockedCareersXml,
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
