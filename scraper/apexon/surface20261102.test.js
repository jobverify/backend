import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createApexonScraper, EXPLORE_JOBS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const fetchText = async url => {
  const row = captures.findLast(row => row.requestedUrl === url && row.status === 200)
  assert.ok(row, 'unrecorded successful first-party request ' + url)
  return row.html
}

test('reconciles the full current Apexon table and all eighteen India descriptions with a closing inventory', async () => {
  let listingReads = 0
  const jobs = await createApexonScraper().run({ fetchText: async url => {
    if (url === EXPLORE_JOBS_URL) listingReads++
    return fetchText(url)
  } })
  assert.equal(jobs.length, 18)
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription.length > 500))
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 35)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 18)
  assert.ok(jobs.every(job => job.nativeBoardListingComplete === true && job.sourceScopeComplete === false
    && job.lifecycleCleanupAllowed === false && job.sourceDetailComplete === true))
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.equal(listingReads, 2)
})

test('does not certify a native Apexon table with an unparsed foreign row', async () => {
  const jobs = await createApexonScraper().run({ fetchText: async url => {
    const html = await fetchText(url)
    return url === EXPLORE_JOBS_URL ? html.replace(/(id=1&amp;jobid=\d+" title=")[^"]+/, '$1') : html
  } })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('does not certify Apexon if a location country mapping becomes unknown', async () => {
  const jobs = await createApexonScraper().run({ fetchText: async url => {
    const html = await fetchText(url)
    return url === EXPLORE_JOBS_URL ? html.replaceAll('data-country="us"', 'data-country="unknown"') : html
  } })
  assert.equal(jobs.length, 18)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('rejects a mismatched first native Apexon detail requisition', async () => {
  await assert.rejects(createApexonScraper().run({ fetchText: async url => {
    const html = await fetchText(url)
    return url.endsWith('jobid=7473') ? html.replace('Job Reference No#: </strong>7473', 'Job Reference No#: </strong>999999') : html
  } }), /identity|requisition/i)
})

test('retains a gap if the native Apexon inventory changes during detail hydration', async () => {
  let listingReads = 0
  const jobs = await createApexonScraper().run({ fetchText: async url => {
    const html = await fetchText(url)
    return url === EXPLORE_JOBS_URL && ++listingReads === 2 ? html.replaceAll('jobid=7485', 'jobid=999998') : html
  } })
  assert.equal(jobs.length, 18)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('rejects the first native Apexon role redirected into another employer', async () => {
  await assert.rejects(createApexonScraper().run({ fetchText: async url => ({ html: await fetchText(url), status: 200,
    url: url.includes('jobid=7473') ? 'https://unrelated.example/role' : url,
  }) }), /first-party response identity/)
})

test('passes cancellation to native Apexon detail requests and propagates the original reason', async () => {
  const controller = new AbortController(), reason = new Error('cancel native Apexon details')
  await assert.rejects(createApexonScraper().run({ signal: controller.signal, fetchText: async (url, options) => {
    assert.equal(options.signal, controller.signal)
    if (url.includes('jobid=7473')) controller.abort(reason)
    return fetchText(url)
  } }), error => error === reason)
})
