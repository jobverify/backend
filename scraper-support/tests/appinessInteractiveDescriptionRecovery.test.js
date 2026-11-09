import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/appinessinteractive/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'

const fixture = id => JSON.parse(readFileSync(new URL(`./fixtures/appinessinteractive/native-${id}-20261024.json`, import.meta.url)))
const captured = fixture('4')
const now = () => '2026-10-24T18:07:00.996Z'
const execute = (sample = captured, options = {}) => {
  const fetchPage = options.fetchPage || (async (url, { signal } = {}) => {
    signal?.throwIfAborted()
    assert.ok([source.CAREERS_URL, sample.detailUrl].includes(url))
    return { status: 200, url, html: url === source.CAREERS_URL ? sample.listingHtml : sample.detailHtml }
  })
  return source.run({ now, requestIntervalMs: 0,
    fetchText: async (url, request) => (await fetchPage(url, request)).html,
    fetchPage, ...options,
  })
}

test('actual Appiness role4 recovers full employer sections and its original2024 date from the bound detail page', async () => {
  const jobs = await execute()
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, 'seo-expert')
  assert.equal(job.sourceNativeJobId, '4')
  assert.equal(job.sourceUrl, captured.detailUrl)
  assert.equal(job.applyUrl, captured.detailUrl)
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bangalore')
  assert.equal(job.postingDate, '2024-05-31')
  assert.match(job.sourceDescription, /Improve organic search results/)
  assert.match(job.sourceDescription, /Pre Requisites/)
  assert.ok(job.sourceDescription.length > 1500)
  assert.equal(job.jobDescription, job.sourceDescription)
  assert.match(job.jobDescriptionHtml, /<ul>/)
  assert.doesNotMatch(job.sourceDescription, /Explore SEO jobs|Current Employer|Submit Application/)
  assert.equal(job.scrapedAt, now())
  assert.equal(job.sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.match(readInventoryEvidence(jobs)?.reason, /native-listing-total-unreported/)
  const normalized = normalizeScrapedJob(job, { source: 'appinessinteractive' })
  assert.equal(new Date(normalized.postingDate).toISOString(), '2024-05-31T00:00:00.000Z')
  const eligible = analyzePublishableJobs([normalized], { now: new Date(now()) })
  assert.equal(eligible.eligibleJobs.length, 0)
  assert.equal(eligible.filterCounts.old, 1)
})

test('actual Appiness role25 accepts only native literal schema newlines while retaining its publication date', async () => {
  const sample = fixture('25')
  const jobs = await execute(sample)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceNativeJobId, '25')
  assert.equal(jobs[0].postingDate, '2025-07-21')
  assert.match(jobs[0].sourceDescription, /Social Media Manager/)
  assert.ok(jobs[0].sourceDescription.length > 1000)
})

test('Appiness detail identity, employer, country, date and active content contradictions are rejected', () => {
  const listing = source.extractNativeListings(captured.listingHtml)[0]
  for (const change of [
    html => html.replace('<h1>SEO Expert</h1>', '<h1>Other role</h1>'),
    html => html.replace('id="job-id" value="4"', 'id="job-id" value="99"'),
    html => html.replace('Location: <span>Bangalore</span>', 'Location: <span>Dallas</span>'),
    html => html.replace('1-4 Years', '8-10 Years'),
    html => html.replace('"name": "Appiness World"', '"name": "Other Employer"'),
    html => html.replace('https://appinessworld.com/', 'https://unrelated.example/'),
    html => html.replace('"addressCountry": "India"', '"addressCountry": "USA"'),
    html => html.replace('"addressCountry": "India"', '"addressCountry": {"identifier":"IN"}'),
    html => html.replace('"datePosted": "2024-05-31"', '"datePosted": "2024-02-31"'),
    html => html.replace('"datePosted": "2024-05-31"', '"datePosted": null'),
    html => html.replace('<div class="job-inner-content">', '<div class="job-inner-content" inert>'),
    html => `<template>${html}</template>`,
    html => html.replace('"@type": "JobPosting"', '"@type": JobPosting'),
    html => html.replace('"title": "SEO Expert | SEO Jobs"', '"title": null'),
    html => html.replace('"title": "SEO Expert | SEO Jobs"', '"title": "SEO Expert | Other role"'),
    html => html.replace('id="jobApplicationForm"', 'hidden id="jobApplicationForm"'),
    html => html.replace('id="jobApplicationForm"', 'aria-hidden="true" id="jobApplicationForm"'),
    html => html.replace('id="jobApplicationForm"', 'style="content-visibility:hidden" id="jobApplicationForm"'),
    html => html.replace('id="myModaljobs"', 'aria-hidden="true" id="myModaljobs"'),
  ]) assert.throws(() => source.extractNativeDetail(change(captured.detailHtml), listing, { url: captured.detailUrl }), /Appiness/)
  assert.throws(() => source.extractNativeDetail(captured.detailHtml, listing, { url: 'https://unrelated.example/seo-expert/' }), /Appiness/)
  assert.throws(() => source.extractNativeDetail(captured.detailHtml.replace('<h1>SEO Expert</h1>', '<h1>Other role</h1>'), { ...listing, title: 'Other role' }), /Appiness/)
})

test('Appiness accepts only native role links and current exact employer branding', () => {
  for (const html of [
    captured.listingHtml.replace(captured.detailUrl, 'https://unrelated.example/seo-expert/'),
    captured.listingHtml.replace('Appiness Interactive Pvt. Ltd.', 'Other Employer'),
    captured.listingHtml.replace('data-job-id="4"', 'data-job-id=""'),
    `<template>${captured.listingHtml}</template>`,
  ]) assert.throws(() => source.extractNativeListings(html), /Appiness/)
})

test('Appiness cancellation is preserved before requests and after a transport ignores its signal', async () => {
  const before = new AbortController(), reason = Error('stop Appiness')
  before.abort(reason)
  let calls = 0
  await assert.rejects(execute(captured, { signal: before.signal, fetchPage: async () => { calls++; return {} } }), error => error === reason)
  assert.equal(calls, 0)
  const after = new AbortController()
  await assert.rejects(execute(captured, { signal: after.signal, fetchPage: async url => {
    if (url === captured.detailUrl) after.abort(reason)
    return { status: 200, url, html: url === source.CAREERS_URL ? captured.listingHtml : captured.detailHtml }
  } }), error => error === reason)
})

test('Appiness failed detail responses cannot become verified empty inventory or fabricated content', async () => {
  const jobs = await execute(captured, { fetchPage: async url => {
    if (url === captured.detailUrl) throw Object.assign(Error('HTTP503 from native role'), { status: 503 })
    return { status: 200, url, html: captured.listingHtml }
  } })
  assert.deepEqual([...jobs], [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
  assert.match(readInventoryEvidence(jobs)?.reason, /detail-failures=1/)
})

const twoRoleHtml = readFileSync(new URL('./fixtures/appinessinteractive/two-role-listing-20261024.html', import.meta.url), 'utf8')
const twoRoles = [captured, fixture('25')]
const twoRolePage = async url => ({ status: 200, url, html: url === source.CAREERS_URL ? twoRoleHtml
  : twoRoles.find(sample => sample.detailUrl === url)?.detailHtml })

test('Appiness detail caps retain current listing evidence and start no requests for omitted roles', async () => {
  const requested = []
  const jobs = await execute(captured, { maxJobs: 1, fetchPage: async url => {
    requested.push(url)
    return twoRolePage(url)
  } })
  assert.deepEqual(jobs.map(job => job.sourceNativeJobId), ['4'])
  assert.deepEqual(requested, [source.CAREERS_URL, captured.detailUrl])
  assert.match(readInventoryEvidence(jobs).reason, /observed-roles=2;selected-details=1;verified-details=1/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Appiness serial detail reads respect request pacing and retain valid roles after a conflicting sibling', async () => {
  const starts = []
  const jobs = await execute(captured, { requestIntervalMs: 30, fetchPage: async url => {
    starts.push(Date.now())
    const response = await twoRolePage(url)
    if (url === twoRoles[1].detailUrl) response.html = response.html.replace('id="job-id" value="25"', 'id="job-id" value="99"')
    return response
  } })
  assert.equal(starts.length, 3)
  assert.ok(starts.slice(1).every((start, index) => start - starts[index] >= 20))
  assert.deepEqual(jobs.map(job => job.sourceNativeJobId), ['4'])
  assert.match(readInventoryEvidence(jobs).reason, /detail-failures=1/)
})

test('Appiness source deadline settles a cooperative detail request and cannot authorize partial success', async () => {
  let active = 0, detailStarts = 0
  await assert.rejects(execute(captured, { sourceBudgetMs: 50, fetchPage: async (url, { signal }) => {
    if (url === source.CAREERS_URL) return twoRolePage(url)
    active++; detailStarts++
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => {
      active--
      reject(signal.reason)
    }, { once: true }))
  } }), /source deadline exhausted/)
  assert.equal(detailStarts, 1)
  assert.equal(active, 0)
})

test('Appiness cancellation while pacing starts no next detail request', async () => {
  const controller = new AbortController(), reason = Error('stop paced Appiness')
  let calls = 0, abortTimer
  try {
    await assert.rejects(execute(captured, { requestIntervalMs: 100, signal: controller.signal, fetchPage: async url => {
      calls++
      abortTimer = setTimeout(() => controller.abort(reason), 5)
      return twoRolePage(url)
    } }), error => error === reason)
  } finally { clearTimeout(abortTimer) }
  assert.equal(calls, 1)
})

test('Appiness native runtime rejects text-only hooks that cannot prove response status or final URL', async () => {
  let calls = 0
  await assert.rejects(source.run({ requestIntervalMs: 0, fetchText: async url => {
    calls++
    return url === source.CAREERS_URL ? captured.listingHtml : captured.detailHtml
  } }), /Appiness.*response receipts/)
  assert.equal(calls, 0)
})

test('Appiness deadline terminates its lifecycle when a transport never settles, without claiming transport cleanup', async () => {
  const running = source.run({ sourceBudgetMs: 10, requestIntervalMs: 0, fetchPage: async () => new Promise(() => {}) })
  const outcome = await Promise.race([
    running.then(() => ({ unexpectedSuccess: true }), error => ({ error })),
    new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 500)),
  ])
  assert.equal(outcome.timedOut, undefined, 'The source must not wait indefinitely for an uncooperative transport')
  assert.match(outcome.error?.message || '', /Appiness.*source deadline exhausted/)
})

test('Appiness caller abort allows finite cooperative fetch cleanup before propagating the original reason', async () => {
  const controller = new AbortController(), reason = Error('stop delayed Appiness fetch')
  let active = 0, started
  const ready = new Promise(resolve => { started = resolve })
  const running = source.run({ signal: controller.signal, requestIntervalMs: 0, fetchPage: async (url, { signal }) => {
    active++
    started()
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => setTimeout(() => {
      active--
      reject(signal.reason)
    }, 20), { once: true }))
  } })
  await ready
  controller.abort(reason)
  await assert.rejects(running, error => error === reason)
  assert.equal(active, 0)
})
