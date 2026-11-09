import assert from 'node:assert/strict'
import test from 'node:test'
import * as sky from '../../scraper/skyscanner/script.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'

const tenant = 'eb485598-6bf3-40a5-8560-d70150131305'
const api = `https://api.ashbyhq.com/posting-api/job-board/${tenant}`
const bundleUrl = 'https://js.skyscnr.com/sttc/hamilton/falcon/static/js/skyscanner-internal-landing-pages-shared-ui-src-components-JobsApp.abc123.chunk.js'
const shell = '<title>Skyscanner Jobs</title><h1>Current jobs</h1><select>All teams</select><select>All locations</select><input placeholder="Search by title, team or location">'
const page = shell + `<script src="${bundleUrl}"></script>`
const bundle = `const board="${tenant}",api=\`https://api.ashbyhq.com/posting-api/job-board/\${board}\`;async function load(){const response=await fetch(api);return response.json()}`
const row = (id = 'native-role', location = 'Bengaluru, India', country = 'India') => ({ id, title: 'Software Engineer', isListed: true,
  location, address: { postalAddress: { addressCountry: country } },
  jobUrl: `https://jobs.ashbyhq.com/${tenant}/${id}`, applyUrl: `https://jobs.ashbyhq.com/${tenant}/${id}/application`,
  publishedAt: '2026-10-22T12:00:00Z', descriptionHtml: '<p>Build and operate production travel services.</p>' })
const options = (jobs, overrides = {}) => ({
  fetchText: async () => shell,
  fetchPage: async url => ({ status: 200, url, html: url === bundleUrl ? bundle : page }),
  fetchJson: async url => { assert.equal(url, api); return { apiVersion: '1', jobs } }, ...overrides,
})
const run = (jobs, overrides) => createCatalogScraper(getScraperCatalog().find(p => p.source === 'skyscanner')).run(options(jobs, overrides))

test('Skyscanner registered extraction replaces the empty sentinel with the current employer-bound native feed', async () => {
  const jobs = await run([row()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'skyscanner')
  assert.equal(jobs[0].company, 'Skyscanner')
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /production travel services/)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('Skyscanner distinguishes complete foreign-only inventory, native empty and unknown scope', async () => {
  for (const [rows, status] of [[[row('foreign', 'London', 'United Kingdom')], 'complete-inventory'],
    [[], 'verified-empty'], [[row('unknown', 'Remote', '')], 'discovery-only']]) {
    const jobs = await run(rows)
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs)?.status, status)
  }
})

test('Skyscanner current page and executable bundle are required even for zero jobs', async () => {
  for (const html of [shell, shell + `<script type="application/ld+json" src="${bundleUrl}"></script>`,
    shell + `<div hidden><script src="${bundleUrl}"></script></div>`,
    shell + `<script src="${bundleUrl.replace('js.skyscnr.com','js.skyscnr.com.evil.invalid')}"></script>`]) {
    await assert.rejects(run([], { fetchPage: async url => ({ status: 200, url, html }) }), /bundle|binding|employer/i)
  }
  await assert.rejects(run([], { fetchPage: async url => ({ status: 403, url, html: page }) }), /page|binding|employer/i)
  await assert.rejects(run([], { fetchPage: async () => ({ status: 200,
    url: 'https://www.skyscanner.com/sttc/px/captcha-v2/index.html', html: '<title>Skyscanner</title><p>Access challenge</p>' }),
  }), /page|binding|employer/i)
})

test('Skyscanner comments, quoted examples, shadowed fetch and foreign board contracts cannot bind the live feed', async () => {
  for (const js of [`/* ${bundle} */`, `const example=${JSON.stringify(bundle)};`,
    bundle.replaceAll(tenant, 'different-tenant'), `const fetch=()=>null;${bundle}`]) {
    await assert.rejects(run([], { fetchPage: async url => ({ status: 200, url, html: url === bundleUrl ? js : page }) }), /bundle|binding|contract/i)
  }
})

test('Skyscanner native schema, role and description evidence cannot be promoted by its wrapper', async () => {
  for (const payload of [{ apiVersion: '2', jobs: [] }, { apiVersion: '1', jobs: [], error: 'denied' },
    { apiVersion: '1', jobs: [{ ...row(), jobUrl: 'https://jobs.ashbyhq.com/another-company/native-role' }] }]) {
    await assert.rejects(run([], { fetchJson: async () => payload }), /inventory|identity|schema|board/i)
  }
  const jobs = await run([{ ...row(), descriptionHtml: '' }])
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('Skyscanner country-less city names do not establish an India vacancy', async () => {
  const jobs = await run([row('unproven-city', 'Delhi, NY', '')])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('Skyscanner transport cancellation retains the caller reason', async () => {
  const reason = new Error('cancel current Skyscanner surface')
  await assert.rejects(run([], { signal: AbortSignal.abort(reason) }), error => error === reason)
})

test('Skyscanner registered job limits preserve fetched native totals and incomplete output evidence', async () => {
  const jobs = await run([row()], { maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
