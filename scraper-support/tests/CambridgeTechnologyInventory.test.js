import assert from 'node:assert/strict'
import test from 'node:test'

import * as cambridge from '../../scraper/cambridgetechnologyenterprises/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const verifiedAt = '2026-10-20T12:00:00.000Z'
const homepage = '<title>Agentic AI Solutions for Enterprise Workflows | Cambridge Technology</title><p>Cambridge Technology</p><a href="https://cambridgetechnology.freshteam.com/jobs">See Open Positions</a>'
const firstRow = '<li><a class="job-title" href="/jobs/a1/software-engineer">Software Engineer</a><a class="location-info" href="/jobs/a1/software-engineer">Hyderabad, Telangana<br>Full Time</a></li>'
const secondRow = '<li><a class="job-title" href="/jobs/a2/data-engineer">Data Engineer</a><a class="location-info" href="/jobs/a2/data-engineer">Bengaluru, India<br>Full Time</a></li>'
const board = (rows, { count = 2, next = '' } = {}) => `<title>Careers</title>${count == null ? '' : `<meta property="og:description" content="#${count} Jobs - Hyderabad">`}<h2>Open Positions</h2><div class="job-role-list"><ul>${rows}</ul></div>${next}`
const detail = (title) => `<h1>${title}</h1><div class="job-details-content"><p>Build and maintain enterprise systems with the engineering team.</p></div>`
const firstUrl = 'https://cambridgetechnology.freshteam.com/jobs/a1/software-engineer'
const secondUrl = 'https://cambridgetechnology.freshteam.com/jobs/a2/data-engineer'
const runBoard = (listingHtml, { maxJobs = null, pages = {}, details = {} } = {}) => cambridge.createCambridgeTechnologyEnterprisesScraper({ maxJobs }).run({
  now: () => verifiedAt,
  fetchText: async (url) => {
    if (url === cambridge.OFFICIAL_HOMEPAGE_URL) return homepage
    if (url === cambridge.LISTING_URL) return listingHtml
    if (Object.hasOwn(pages, url)) return pages[url]
    if (Object.hasOwn(details, url)) return details[url]
    if (url === firstUrl) return detail('Software Engineer')
    if (url === secondUrl) return detail('Data Engineer')
    throw new Error(`Unexpected fixture request: ${url}`)
  },
})

test('Cambridge reconciles current reported totals and attaches complete inventory evidence after every detail succeeds', async () => {
  const jobs = await runBoard(board(firstRow + secondRow))
  assert.equal(jobs.length, 2)
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'complete-inventory', surface: 'https://cambridgetechnology.freshteam.com/jobs',
    firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 2,
    indiaFacetCount: 2, verifiedAt, reason: 'complete-freshteam-public-inventory',
  })
})

test('Cambridge rejects missing rows when the public board reports more jobs than were parsed', async () => {
  await assert.rejects(runBoard(board(firstRow)), /incomplete|count|total/i)
})

test('Cambridge follows first-party next-page links before declaring inventory complete', async () => {
  const jobs = await runBoard(board(firstRow, { next: '<a rel="next" href="/jobs?page=2">Next</a>' }), {
    pages: { 'https://cambridgetechnology.freshteam.com/jobs?page=2': board(secondRow) },
  })
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs)?.pagesFetched, 2)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('Cambridge rejects a repeated pagination page or a next-page URL outside the verified board', async () => {
  await assert.rejects(runBoard(board(firstRow, { next: '<a rel="next" href="/jobs">Next</a>' })), /incomplete|repeat|pagination/i)
  await assert.rejects(runBoard(board(firstRow, { next: '<a rel="next" href="https://unrelated.example/jobs?page=2">Next</a>' })), /trusted|first-party|pagination/i)
})

test('Cambridge rejects numbered pagination that skips the adjacent page', async () => {
  await assert.rejects(runBoard(board(firstRow, { count: 1, next: '<a href="/jobs?page=3">3</a>' })), /incomplete|pagination/i)
})

test('Cambridge rejects changing page totals and duplicate vacancies across pages', async () => {
  for (const secondPage of [board(secondRow, { count: 3 }), board(firstRow)]) {
    await assert.rejects(runBoard(board(firstRow, { next: '<a rel="next" href="/jobs?page=2">Next</a>' }), {
      pages: { 'https://cambridgetechnology.freshteam.com/jobs?page=2': secondPage },
    }), /incomplete|total|repeat/i)
  }
})

test('Cambridge reconciles conflicting social metadata totals instead of choosing one', async () => {
  await assert.rejects(runBoard(board(firstRow, { count: 1 }) + '<meta name="twitter:description" content="#2 Jobs - Hyderabad">'), /incomplete|total/i)
})

test('Cambridge recognizes the current official homepage title and verified direct Freshteam handoff', () => {
  assert.equal(cambridge.hasOfficialHomepageSignal(homepage.replace('Enterprise Workflows |', 'Enterprise |')), true)
})

test('Cambridge marks capped runs incomplete even when the cap exceeds the reported inventory', async () => {
  for (const maxJobs of [1, 5]) {
    const jobs = await runBoard(board(firstRow + secondRow), { maxJobs })
    assert.equal(jobs.length, maxJobs === 1 ? 1 : 2)
    assert.equal(jobs.every(job => job.sourceListingComplete === false), true)
    assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 2)
    assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 2)
  }
})

test('Cambridge keeps an uncounted board in discovery-only status rather than inventing a reported total', async () => {
  const jobs = await runBoard(board(firstRow, { count: null }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
})

test('Cambridge verifies an explicit empty board using current evidence and rejects a contradictory nonzero total', async () => {
  const jobs = await runBoard(board('<p>No jobs found</p>', { count: 0 }))
  assert.deepEqual(jobs, [])
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'verified-empty', surface: 'https://cambridgetechnology.freshteam.com/jobs',
    firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 0,
    indiaFacetCount: 0, verifiedAt, reason: 'verified-freshteam-explicit-empty',
  })
  await assert.rejects(runBoard(board('<p>No jobs found</p>', { count: 2 })), /incomplete|count|total/i)
})

test('Cambridge uses the explicit public empty message when the board omits social metadata counts', async () => {
  const jobs = await runBoard(board('<p>No jobs found</p>', { count: null }))
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 0)
})

test('Cambridge refuses to silently omit a listing whose supplied detail is absent', () => {
  assert.throws(() => cambridge.extractSearchResults({
    listingHtml: board(firstRow + secondRow), detailHtmlByUrl: { [firstUrl]: detail('Software Engineer') },
  }), /detail|incomplete/i)
})

test('Cambridge rejects empty detail content instead of replacing it with a listing summary', async () => {
  await assert.rejects(runBoard(board(firstRow, { count: 1 }), {
    details: { [firstUrl]: '<h1>Software Engineer</h1><div class="job-details-content"></div>' },
  }), /detail|description|incomplete/i)
})

test('Cambridge rejects a failed detail fetch without returning a partial inventory', async () => {
  await assert.rejects(runBoard(board(firstRow + secondRow), { details: { [secondUrl]: '<title>Unavailable</title>' } }), /detail|incomplete/i)
})
