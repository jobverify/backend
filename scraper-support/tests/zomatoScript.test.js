import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  LEGACY_CAREER_PAGE_URL,
  buildSearchUrl,
  createZomatoScraper,
  pageIndicatesReferralOnlyHiring,
} from '../../scraper/zomato/script.js'

test('pageIndicatesReferralOnlyHiring recognizes Eternal careers pages that only accept employee referrals', () => {
  const html = `
    <main>
      <h1>Careers</h1>
      <p>We only accept applications through employee referrals.</p>
    </main>
  `

  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
  assert.equal(LEGACY_CAREER_PAGE_URL, 'https://www.zomato.com/careers')
  assert.equal(pageIndicatesReferralOnlyHiring(html), true)
  assert.equal(pageIndicatesReferralOnlyHiring('<main>Unexpected careers experience</main>'), false)
})

test('run validates the public Eternal referrals-only message and returns an empty result set', async () => {
  const requestedUrls = []
  const scraper = createZomatoScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return `
        <section>
          <p>We only accept applications through employee referrals.</p>
        </section>
      `
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run falls back to the current Eternal Astro bundle when the referrals-only copy is client-rendered', async () => {
  const requestedUrls = []
  const scraper = createZomatoScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_PAGE_URL) {
        return `
          <html>
            <head><title>Careers - Hiring at Eternal</title></head>
            <body>
              <script type="module" src="/_astro/careers.bundle.js"></script>
            </body>
          </html>
        `
      }

      if (url === 'https://www.eternal.com/_astro/careers.bundle.js') {
        return 'const copy = "we only accept applications through employee referrals";'
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    'https://www.eternal.com/_astro/careers.bundle.js',
  ])
  assert.deepEqual(jobs, [])
})

test('run recognizes the live Eternal Astro bundle when the referrals copy is split across JSX fragments', async () => {
  const scraper = createZomatoScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === CAREER_PAGE_URL) {
        return '<script type="module" src="/_astro/careers.live.js"></script>'
      }

      if (url === 'https://www.eternal.com/_astro/careers.live.js') {
        return '...we only accept applications through ",C.jsx("br",{})," employee referrals...'
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('run throws when the Eternal careers page no longer matches the referrals-only public flow', async () => {
  const scraper = createZomatoScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async () => '<main>Unexpected careers experience</main>',
    }),
    /referrals-only signal/i,
  )
})
