import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/haveloc/fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const currentAppShellHtml = `
<!doctype html>
<html lang="en"><head>
  <meta name="description" content="Haveloc — the placement system for campuses and recruiters. From job posts to offer letters." />
  <title>Haveloc — Placement Operations Software</title>
  <script type="module" src="/assets/index-C1orAJ7r.js"></script>
</head><body><div id="root"></div></body></html>
`

const loadHavelocModule = async () => {
  try {
    return await import('../../scraper/haveloc/script.js')
  } catch {
    assert.fail('Expected Haveloc scraper module at ../../scraper/haveloc/script.js')
  }
}

test('Haveloc sentinels recognize the verified homepage and missing first-party careers routes', async () => {
  const haveloc = await loadHavelocModule()

  assert.equal(haveloc.SOURCE, 'haveloc')
  assert.equal(haveloc.COMPANY, 'Haveloc')
  assert.equal(haveloc.HOMEPAGE_URL, 'https://haveloc.com/')
  assert.deepEqual(haveloc.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://haveloc.com/careers',
    'https://haveloc.com/careers/',
    'https://haveloc.com/career',
    'https://haveloc.com/career/',
    'https://haveloc.com/jobs',
    'https://haveloc.com/jobs/',
    'https://haveloc.com/job',
    'https://haveloc.com/job/',
    'https://haveloc.com/join-us',
    'https://haveloc.com/join-us/',
  ])
  assert.equal(haveloc.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(haveloc.hasOfficialHomepageSignal(currentAppShellHtml), true)
  assert.equal(haveloc.hasFirstPartyCareerLikeLink(verifiedHomepageHtml), false)
  assert.equal(
    haveloc.hasFirstPartyCareerLikeLink(
      verifiedHomepageHtml.replace('/about.html', '/careers'),
    ),
    true,
  )
  assert.equal(haveloc.isMissingCareerRoute({ status: 404 }), true)
  assert.equal(haveloc.isMissingCareerRoute({ status: 200, html: currentAppShellHtml }), true)
  assert.equal(haveloc.isMissingCareerRoute({ status: 200 }), false)
})

test('Haveloc returns no jobs only while the verified homepage and missing careers routes still hold', async () => {
  const haveloc = await loadHavelocModule()
  const requestedUrls = []

  const jobs = await haveloc.createHavelocScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === haveloc.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: verifiedHomepageHtml,
        }
      }

      if (haveloc.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: '',
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    haveloc.HOMEPAGE_URL,
    ...haveloc.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Haveloc fails closed when the homepage changes, grows a careers link, or a careers route resolves', async () => {
  const haveloc = await loadHavelocModule()

  await assert.rejects(
    haveloc.createHavelocScraper().run({
      fetchPage: async (url) => {
        if (url === haveloc.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    haveloc.createHavelocScraper().run({
      fetchPage: async (url) => {
        if (url === haveloc.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: verifiedHomepageHtml.replace(
              '</header>',
              '<a href="/careers">Careers</a></header>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    haveloc.createHavelocScraper().run({
      fetchPage: async (url) => {
        if (url === haveloc.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        return {
          status: url === haveloc.NO_PUBLIC_CAREERS_ROUTE_URLS[0] ? 200 : 404,
          url,
          html: '',
        }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
