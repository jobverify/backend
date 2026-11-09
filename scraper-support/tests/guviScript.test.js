import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'guvi',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readHtmlFixture('homepage.html')
const verifiedJobsShellHtml = readHtmlFixture('jobs-shell.html')

const loadGuviModule = async () => {
  try {
    return await import('../../scraper/guvi/script.js')
  } catch {
    assert.fail('Expected GUVI scraper module at ../../scraper/guvi/script.js')
  }
}

test('GUVI sentinels recognize the verified homepage and zero-openings jobs shell', async () => {
  const guvi = await loadGuviModule()

  assert.equal(guvi.SOURCE, 'guvi')
  assert.equal(guvi.COMPANY, 'GUVI (An HCL Group Company)')
  assert.equal(guvi.HOMEPAGE_URL, 'https://www.guvi.in/')
  assert.equal(guvi.JOBS_URL, 'https://www.guvi.in/jobs/')
  assert.equal(guvi.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(guvi.hasVerifiedJobsShellSignal(verifiedJobsShellHtml), true)
  assert.equal(guvi.hasOpenJobCards(verifiedJobsShellHtml), false)
  assert.equal(guvi.extractJobCards('<div class="row tests-list list"><a>Role</a></div>').length, 1)
})

test('GUVI returns no jobs only while the verified first-party zero-openings shell holds', async () => {
  const guvi = await loadGuviModule()
  const requestedPages = []

  const jobs = await guvi.createGuviScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === guvi.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: verifiedHomepageHtml,
        }
      }

      if (url === guvi.JOBS_URL) {
        return {
          status: 200,
          url,
          html: verifiedJobsShellHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [guvi.HOMEPAGE_URL, guvi.JOBS_URL])
  assert.deepEqual(jobs, [])
})

test('GUVI fails closed when the homepage or jobs shell changes materially', async () => {
  const guvi = await loadGuviModule()

  await assert.rejects(
    guvi.createGuviScraper().run({
      fetchPage: async (url) => {
        if (url === guvi.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, html: verifiedJobsShellHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    guvi.createGuviScraper().run({
      fetchPage: async (url) => {
        if (url === guvi.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        return {
          status: 200,
          url,
          html: verifiedJobsShellHtml.replace(
            '<div class="row tests-list list">',
            '<div class="row tests-list list"><a href=\"/jobs/sdet\">SDET</a>',
          ),
        }
      },
    }),
    /jobs surface changed materially or now exposes public openings/i,
  )

  await assert.rejects(
    guvi.createGuviScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === guvi.HOMEPAGE_URL ? verifiedHomepageHtml : verifiedJobsShellHtml.replace('Jobs', 'Open Roles'),
      }),
    }),
    /verified first-party jobs surface/i,
  )
})
