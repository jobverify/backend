import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'piramalgroup',
)

const verifiedHomepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')

const loadPiramalGroupModule = async () => {
  try {
    return await import('../../scraper/piramalgroup/script.js')
  } catch {
    assert.fail('Expected Piramal Group scraper module at ../../scraper/piramalgroup/script.js')
  }
}

test('Piramal Group sentinel recognizes the verified homepage and subsidiary careers handoff', async () => {
  const piramalGroup = await loadPiramalGroupModule()

  assert.equal(piramalGroup.SOURCE, 'piramalgroup')
  assert.equal(piramalGroup.COMPANY, 'Piramal Group')
  assert.equal(piramalGroup.HOMEPAGE_URL, 'https://www.piramal.com/')
  assert.deepEqual(piramalGroup.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.piramal.com/careers',
    'https://www.piramal.com/careers/',
    'https://www.piramal.com/jobs',
    'https://www.piramal.com/jobs/',
    'https://www.piramal.com/join-us',
    'https://www.piramal.com/join-us/',
  ])
  assert.deepEqual(piramalGroup.EXPECTED_HANDOFF_URLS, [
    '/#Careers',
    '#JoinOurTeam',
    'https://www.piramalpharma.com/careers',
    'https://www.piramalrealty.com/careers',
    'https://www.piramalfinance.com/careers',
    'https://piramalfoundation.org/jobs',
    '#Careers',
  ])
  assert.equal(piramalGroup.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.deepEqual(
    piramalGroup.extractCareerHandoffUrls(verifiedHomepageHtml),
    piramalGroup.EXPECTED_HANDOFF_URLS,
  )
  assert.equal(
    piramalGroup.hasUnexpectedPublicJobsSignal(verifiedHomepageHtml),
    false,
  )
  assert.equal(piramalGroup.isMissingCareerRoute({ status: 404 }), true)
})

test('Piramal Group returns no jobs only while the verified first-party empty state holds', async () => {
  const piramalGroup = await loadPiramalGroupModule()
  const requestedUrls = []

  const jobs = await piramalGroup.createPiramalGroupScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === piramalGroup.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      if (piramalGroup.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    piramalGroup.HOMEPAGE_URL,
    ...piramalGroup.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Piramal Group fails closed when the homepage, handoff set, or group careers routes drift', async () => {
  const piramalGroup = await loadPiramalGroupModule()

  await assert.rejects(
    piramalGroup.createPiramalGroupScraper().run({
      fetchPage: async (url) => {
        if (url === piramalGroup.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    piramalGroup.createPiramalGroupScraper().run({
      fetchPage: async (url) => {
        if (url === piramalGroup.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: verifiedHomepageHtml.replace(
              '</ul>',
              '<li><a href="https://jobs.piramal.com/">Piramal Group Jobs</a></li></ul>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /careers handoff no longer matches the verified subsidiary-only surface/i,
  )

  await assert.rejects(
    piramalGroup.createPiramalGroupScraper().run({
      fetchPage: async (url) => {
        if (url === piramalGroup.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === piramalGroup.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Current openings</body></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
