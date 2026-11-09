import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_PAGE_URL,
  JOBS_API_URL,
  JOBS_PAGE_URL,
  createLybrateScraper,
  hasOfficialAboutPageSignal,
  isDeadEmbeddedJobsApiResponse,
  isVerifiedJobsPageRedirectLoop,
} from './script.js'

const ABOUT_HTML = `<!DOCTYPE html>
<html>
<head><title>About Us - Lybrate</title></head>
<body>
  <section>Be a part of Lybrate.</section>
  <section>We're Hiring</section>
  <a href="https://www.lybrate.com/jobs">Jobs</a>
</body>
</html>`

test('Lybrate still verifies the about-page hiring CTA', () => {
  assert.equal(hasOfficialAboutPageSignal(ABOUT_HTML), true)
})

test('Lybrate recognizes the current first-party jobs redirect loop', () => {
  assert.equal(isVerifiedJobsPageRedirectLoop({
    status: 301,
    url: 'https://www.lybrate.com/jobs',
    location: 'https://www.lybrate.com/jobs',
    html: '',
  }), true)

  assert.equal(isVerifiedJobsPageRedirectLoop({
    status: 308,
    url: 'https://www.lybrate.com/jobs/',
    location: '/jobs',
    html: '',
  }), true)
})

test('Lybrate still treats the dead Lever payload as the authoritative empty result', () => {
  assert.equal(isDeadEmbeddedJobsApiResponse({
    ok: false,
    error: 'Document not found',
  }), true)
})

test('Lybrate returns an empty set when about CTA, jobs redirect loop, and dead Lever payload all match', async () => {
  const scraper = createLybrateScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === ABOUT_PAGE_URL) return ABOUT_HTML
      throw new Error(`Unexpected text URL ${url}`)
    },
    fetchPage: async (url) => {
      if (url === JOBS_PAGE_URL) {
        return {
          status: 301,
          url,
          location: 'https://www.lybrate.com/jobs',
          html: '',
        }
      }

      throw new Error(`Unexpected page URL ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(url, JOBS_API_URL)
      return {
        ok: false,
        error: 'Document not found',
      }
    },
  })

  assert.deepEqual(jobs, [])
})
