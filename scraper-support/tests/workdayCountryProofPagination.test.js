import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runWorkdayScraper } from '../myworkday/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const replay = (t, change = () => {}) => {
  const baseUrl = 'https://proof-pages.wd103.myworkdayjobs.com/Careers'
  const api = 'https://proof-pages.wd103.myworkdayjobs.com/wday/cxs/proof-pages/Careers/jobs'
  const corporate = 'https://proof-pages.example/careers'
  const rows = Array.from({ length: 21 }, (_, n) => ({ title: 'Engineer ' + n,
    externalPath: '/job/London/Engineer_R' + n, locationsText: 'London, United Kingdom', bulletFields: ['R' + n] }))
  // Temenos CXS returns the real count only at offset 0. Later pages carry 0,
  // even when they contain the remaining rows of the same complete inventory.
  const pages = [
    { total: 21, jobPostings: rows.slice(0, 20) }, { total: 0, jobPostings: rows.slice(20) },
    { total: 21, jobPostings: rows.slice(0, 20) }, { total: 0, jobPostings: rows.slice(20) },
  ]
  change(pages)
  const directory = mkdtempSync(path.join(tmpdir(), 'workday-proof-pagination-'))
  t.after(() => {
    const target = realpathSync(directory)
    assert.equal(path.dirname(target), realpathSync(tmpdir()))
    assert.ok(path.basename(target).startsWith('workday-proof-pagination-'))
    rmSync(target, { recursive: true })
  })
  writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ listingStrategy: 'jobs-api',
    jobsApiUrl: api, detailUrlBase: baseUrl, locationCountry: null, searchText: '',
    inventoryScope: 'complete-board-country-proof', officialCareersUrl: corporate }))
  let requests = 0
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    let response
    if (init.method === 'POST') {
      assert.equal(String(url), api)
      assert.ok(requests < pages.length)
      assert.equal(JSON.parse(init.body).offset, requests % 2 ? 20 : 0)
      response = Response.json(pages[requests++])
    } else {
      assert.ok([baseUrl, corporate].includes(String(url)))
      response = new Response(`<html><a href="${baseUrl}">Current openings</a></html>`, {
        headers: { 'content-type': 'text/html' },
      })
    }
    Object.defineProperty(response, 'url', { value: String(url) })
    return response
  })
  return runWorkdayScraper({ company: 'Proof pages', source: 'proof-pages', baseUrl, scraperDir: directory,
    requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} }, retryBaseDelayMs: 0 })
}

test('complete-board proof reconciles both snapshots when later CXS pages reset total to zero', async t => {
  const jobs = await replay(t)
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 21)
  assert.equal(evidence.pagesFetched, 4)
  assert.equal(evidence.indiaFacetCount, 0)
})

for (const [name, change] of [
  ['missing initial final row', pages => { pages[1].jobPostings = [] }],
  ['missing closing final row', pages => { pages[3].jobPostings = [] }],
  ['changed nonzero initial total', pages => { pages[1].total = 22 }],
  ['changed closing first total', pages => { pages[2].total = 0 }],
  ['changed nonzero closing total', pages => { pages[3].total = 22 }],
  ['changed closing role', pages => { pages[3].jobPostings = [{ ...pages[3].jobPostings[0], title: 'Changed role' }] }],
]) {
  test(`complete-board zero-sentinel pagination rejects ${name}`, async t => {
    await assert.rejects(replay(t, pages => {
      change(pages)
      // Opening drift now receives one clean restart. Keep the bad opening
      // on both attempts; closing-only failures still reject in their phase.
      if (name.includes('initial')) pages.splice(2, 0, structuredClone(pages[0]), structuredClone(pages[1]))
    }), { name: 'WorkdayIncompleteListingError' })
  })
}

test('complete-board pagination restarts once after overlapping offset pages and still reconciles closing IDs', async t => {
  const jobs = await replay(t, pages => {
    pages.unshift(structuredClone(pages[0]), { total: 21, jobPostings: [structuredClone(pages[0].jobPostings[0])] })
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 21)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 6)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('persistent overlapping Workday pages remain an upstream inventory failure after two bounded passes', async t => {
  await assert.rejects(replay(t, pages => {
    pages[1] = { total: 21, jobPostings: [structuredClone(pages[0].jobPostings[0])] }
    pages.splice(2, 0, structuredClone(pages[0]), structuredClone(pages[1]))
  }), error => error.name === 'WorkdayIncompleteListingError' && error.softFailure === true
    && error.failureKind === 'upstream_inventory_changed')
})
