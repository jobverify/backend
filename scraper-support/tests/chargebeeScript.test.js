import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  LINKEDIN_JOBS_URL,
  buildSearchUrl,
  createChargebeeScraper,
  pageIndicatesLinkedinOnly,
} from '../../scraper/chargebee/script.js'

test('pageIndicatesLinkedinOnly recognizes Chargebee careers pages that route applicants to LinkedIn', () => {
  const html = `
    <main>
      <h1>Join us. Do good work.</h1>
      <a href="${LINKEDIN_JOBS_URL}">Explore Opportunities</a>
    </main>
  `

  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
  assert.equal(pageIndicatesLinkedinOnly(html), true)
  assert.equal(pageIndicatesLinkedinOnly('<main>No jobs here</main>'), false)
})

test('run validates the official Chargebee careers page signal and returns an empty result set', async () => {
  const requestedUrls = []
  const scraper = createChargebeeScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return `
        <section>
          <p>Explore our LinkedIn Jobs</p>
          <a href="${LINKEDIN_JOBS_URL}">Explore Opportunities</a>
        </section>
      `
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run throws when the Chargebee careers page no longer matches the LinkedIn-only public flow', async () => {
  const scraper = createChargebeeScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async () => '<main>Unexpected careers experience</main>',
    }),
    /LinkedIn-only signal/i,
  )
})
