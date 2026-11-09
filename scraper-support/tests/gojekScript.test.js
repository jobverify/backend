import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ALL_JOBS_URL,
  CAREER_PAGE_URL,
  GOTO_CAREERS_URL,
  buildSearchUrl,
  createGojekScraper,
  extractGotoBundleUrl,
  pageIndicatesSecurityCheckpoint,
} from '../../scraper/gojek/script.js'

test('pageIndicatesSecurityCheckpoint recognizes the Vercel checkpoint currently shown on gojek.io careers routes', () => {
  const html = `
    <html>
      <head><title>Vercel Security Checkpoint</title></head>
      <body>Please wait while we verify your request.</body>
    </html>
  `

  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
  assert.equal(pageIndicatesSecurityCheckpoint(html), true)
  assert.equal(pageIndicatesSecurityCheckpoint('<main>Open jobs</main>'), false)
})

test('extractGotoBundleUrl finds the current GoTo careers bundle from the SSR page', () => {
  const html = `
    <html>
      <body>
        <script src="/_next/static/chunks/pages/careers-123.js" defer></script>
      </body>
    </html>
  `

  assert.equal(
    extractGotoBundleUrl(html),
    'https://www.gotocompany.com/_next/static/chunks/pages/careers-123.js',
  )
})

test('run rejects the checkpoint instead of using parent HoldCo signals as empty Gojek proof', async () => {
  const requestedUrls = []
  const scraper = createGojekScraper()

  await assert.rejects(scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_PAGE_URL) {
        return {
          status: 429,
          text: '<title>Vercel Security Checkpoint</title>',
        }
      }

      if (url === GOTO_CAREERS_URL) {
        return {
          status: 200,
          text: `
            <html>
              <body>
                <div>0 pekerjaan tersedia</div>
                <a href="${ALL_JOBS_URL}">Karier di Gojek</a>
                <script src="/_next/static/chunks/pages/careers-123.js"></script>
              </body>
            </html>
          `,
        }
      }

      if (url === 'https://www.gotocompany.com/_next/static/chunks/pages/careers-123.js') {
        return {
          status: 200,
          text: 'const api="https://content.goinfra.co.id/ent-hris/career/job?company=HoldCo"; const card="https://www.gojek.io/careers/all";',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => error.code === 'GOJEK_COVERAGE_GAP')

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
  ])
})

test('a parent bundle Gojek card cannot qualify a blocked Gojek feed', async () => {
  const scraper = createGojekScraper()

  await assert.rejects(scraper.run({
    fetchPage: async (url) => {
      if (url === CAREER_PAGE_URL) {
        return {
          status: 429,
          text: '<title>Vercel Security Checkpoint</title>',
        }
      }

      if (url === GOTO_CAREERS_URL) {
        return {
          status: 200,
          text: `
            <html>
              <body>
                <div>0 pekerjaan tersedia</div>
                <script src="/_next/static/chunks/pages/careers-live.js"></script>
              </body>
            </html>
          `,
        }
      }

      if (url === 'https://www.gotocompany.com/_next/static/chunks/pages/careers-live.js') {
        return {
          status: 200,
          text: 'const api="https://content.goinfra.co.id/ent-hris/career/job?company=HoldCo"; const card="Karier di Gojek"; const href="https://www.gojek.io/careers/all";',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => error.code === 'GOJEK_COVERAGE_GAP')
})

test('split parent SSR and bundle signals cannot qualify a blocked Gojek feed', async () => {
  const scraper = createGojekScraper()

  await assert.rejects(scraper.run({
    fetchPage: async (url) => {
      if (url === CAREER_PAGE_URL) {
        return {
          status: 429,
          text: '<title>Vercel Security Checkpoint</title>',
        }
      }

      if (url === GOTO_CAREERS_URL) {
        return {
          status: 200,
          text: `
            <html>
              <body>
                <div>Temukan pekerjaan di ekosistem kami</div>
                <h3>Karier di Gojek</h3>
                <p>Mulailah perjalanan Anda bersama kami.</p>
                <script src="/_next/static/chunks/pages/careers-live.js"></script>
              </body>
            </html>
          `,
        }
      }

      if (url === 'https://www.gotocompany.com/_next/static/chunks/pages/careers-live.js') {
        return {
          status: 200,
          text: 'const api="https://content.goinfra.co.id/ent-hris/career/job?company=HoldCo"; const href="https://www.gojek.io/careers/all";',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => error.code === 'GOJEK_COVERAGE_GAP')
})

test('run throws when the official public signals no longer prove the checkpointed HoldCo-only Gojek state', async () => {
  const scraper = createGojekScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async () => ({
        status: 200,
        text: '<main>Unexpected careers experience</main>',
      }),
    }),
    error => error.code === 'GOJEK_COVERAGE_GAP',
  )
})
