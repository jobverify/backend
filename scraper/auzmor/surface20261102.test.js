import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAuzmorScraper, CAREERS_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const fetchPage = async url => {
  const row = captures.findLast(row => row.requestedUrl === url && row.status === 200)
  assert.ok(row, 'unrecorded successful native request ' + url)
  return { html: row.html, status: row.status, url: row.finalUrl }
}
const nativeInventoryUrl = 'https://hire.api.auzmor.com/api/v1/careers/auzmor/groupByDepartment?limit=100&offset=0'

test('follows the current Auzmor widget and reconciles all native roles including underlying India locations of Remote cards', async () => {
  const jobs = await createAuzmorScraper().run({ fetchPage })
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription.length > 500))
  assert.equal(jobs.filter(job => job.workplaceType === 'Remote').length, 8)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 21)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 14)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('rejects a different tenant in the corporate Auzmor widget', async () => {
  await assert.rejects(createAuzmorScraper().run({ fetchPage: async url => {
    const response = await fetchPage(url)
    return url === CAREERS_PAGE_URL ? { ...response, html: response.html.replace("data_org='auzmor'", "data_org='another-employer'") } : response
  } }), /Auzmor.*(?:widget|careers)/i)
})

test('rejects a truncated native Auzmor department group even when the pagination says all groups were returned', async () => {
  await assert.rejects(createAuzmorScraper().run({ fetchPage: async url => {
    const response = await fetchPage(url)
    if (url !== nativeInventoryUrl) return response
    const body = JSON.parse(response.html); body.data[0].jobs.pop()
    return { ...response, html: JSON.stringify(body) }
  } }), /count|truncat|inventory/i)
})

test('does not certify a native Auzmor India role after its detail UUID changes', async () => {
  await assert.rejects(createAuzmorScraper().run({ fetchPage: async url => {
    const response = await fetchPage(url)
    if (!url.endsWith('/getJob/auzmor/73e401c483d24e2992eebf5ed835a434')) return response
    const body = JSON.parse(response.html); body.job.uuid = '99999999999999999999999999999999'
    return { ...response, html: JSON.stringify(body) }
  } }), /identity|UUID/i)
})

test('keeps caller-limited Auzmor extraction explicitly incomplete', async () => {
  const jobs = await createAuzmorScraper().run({ fetchPage, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('rejects a native Auzmor organization that belongs to another corporate domain', async () => {
  await assert.rejects(createAuzmorScraper().run({ fetchPage: async url => {
    const response = await fetchPage(url)
    if (!url.endsWith('/organization/domain/auzmor')) return response
    const body = JSON.parse(response.html); body.url = 'another-employer.example'
    return { ...response, html: JSON.stringify(body) }
  } }), /employer identity/i)
})

test('rejects missing native Auzmor job criteria instead of synthesizing a description', async () => {
  await assert.rejects(createAuzmorScraper().run({ fetchPage: async url => {
    const response = await fetchPage(url)
    if (!url.endsWith('/getJob/auzmor/73e401c483d24e2992eebf5ed835a434')) return response
    const body = JSON.parse(response.html); body.job.description = '<p><br></p>'
    return { ...response, html: JSON.stringify(body) }
  } }), /full description/i)
})

test('keeps Auzmor incomplete when a role identity changes in the closing native inventory', async () => {
  let reads = 0
  const jobs = await createAuzmorScraper().run({ fetchPage: async url => {
    const response = await fetchPage(url)
    if (url !== nativeInventoryUrl || ++reads !== 2) return response
    const body = JSON.parse(response.html); body.data[0].jobs[1].title = 'Changed native title'
    return { ...response, html: JSON.stringify(body) }
  } })
  assert.equal(jobs.length, 14)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('forwards native Auzmor cancellation and cannot convert it into empty inventory', async () => {
  const controller = new AbortController(), reason = new Error('cancel Auzmor detail')
  await assert.rejects(createAuzmorScraper().run({ signal: controller.signal, fetchPage: async (url, options) => {
    assert.equal(options.signal, controller.signal)
    if (url.includes('/getJob/')) controller.abort(reason)
    return fetchPage(url)
  } }), error => error === reason)
})
