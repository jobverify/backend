import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { hasOfficialHomepageSignal, createBharatSerumsAndVaccinesScraper, HOMEPAGE_URL, CAREERS_URL, CHECKED_NO_JOBS_ROUTE_URLS } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const html = url => captures.find(row => row.requestedUrl === url).html

test('binds the current BSV homepage through its exact canonical and native legal employer identity', () => {
  assert.equal(hasOfficialHomepageSignal(html(HOMEPAGE_URL)), true)
  assert.equal(hasOfficialHomepageSignal(html(HOMEPAGE_URL).replaceAll('https://bsvgroup.com/', 'https://unrelated.example/')), false)
})

test('keeps the current BSV testimonials surface explicitly unqualified as vacancy inventory', async () => {
  const jobs = await createBharatSerumsAndVaccinesScraper().run({ fetchPage: async url => {
    if (url === HOMEPAGE_URL || url === CAREERS_URL) return { status: 200, url, html: html(url) }
    assert.ok(CHECKED_NO_JOBS_ROUTE_URLS.includes(url))
    return { status: 404, url, html: '<title>Page Not Found</title>' }
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
})

test('propagates cancellation before a current BSV culture page can become zero-job evidence', async () => {
  const controller = new AbortController(), reason = new Error('cancel BSV homepage')
  await assert.rejects(createBharatSerumsAndVaccinesScraper().run({ signal: controller.signal,
    fetchPage: async (url, options) => {
      assert.equal(options.signal, controller.signal)
      controller.abort(reason)
      return { status: 200, url, html: html(url) }
    } }), error => error === reason)
})
