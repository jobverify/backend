import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as turn } from 'node:timers/promises'
import { collectOracleRequisitionJobs } from '../utils/oracleRequisitionInventory.js'

const role = index => ({ Id: String(910000 + index), Title: `Native concurrency control ${index}`,
  PrimaryLocationCountry: 'IN', PrimaryLocation: 'Bengaluru, Karnataka, India', secondaryLocations: [] })
const body = 'Design and maintain production services, investigate operational issues and work with the engineering team on testing and delivery.'
const run = (fetchJson, options = {}) => collectOracleRequisitionJobs({ source: 'oracle-concurrency-control', siteNumber: 'CX_3',
  buildSearchUrl: ({ page = 0 } = {}) => `https://control.invalid/list?offset=${page * 24}`,
  buildJobDetailApiUrl: id => `https://control.invalid/detail/${id}`,
  extractSearchResults: payload => payload.items[0].requisitionList.map(row => ({
    jobId: row.Id, title: row.Title, sourceUrl: `https://control.invalid/job/${row.Id}`,
  })),
  extractJobDetail: payload => ({ jobId: payload.Id, title: payload.Title, jobDescription: payload.ExternalDescriptionStr }),
  fetchJson, ...options,
})
const listing = total => ({ items: [{ SiteNumber: 'CX_3', Offset: 0, Limit: 24, TotalJobsCount: total,
  requisitionList: Array.from({ length: total }, (_, index) => role(index)) }] })
const detail = url => ({ ...role(Number(url.split('/').at(-1)) - 910000), ExternalDescriptionStr: body })

test('Oracle optional native detail concurrency preserves bounded admission and stable output order', async () => {
  for (const detailConcurrency of [1, 3]) {
    let active = 0, maximum = 0
    const jobs = await run(async url => {
      if (url.includes('/list?')) return listing(8)
      maximum = Math.max(maximum, ++active)
      await turn()
      active--
      return detail(url)
    }, { detailConcurrency })
    assert.equal(maximum, detailConcurrency)
    assert.deepEqual(jobs.map(job => job.jobId), Array.from({ length: 8 }, (_, index) => String(910000 + index)))
    assert.ok(jobs.every(job => job.sourceDetailComplete === true))
  }
})

test('Oracle native identity failure aborts paced peers before any queued detail can start', async () => {
  let releaseFirst, releasePeers
  const first = new Promise(resolve => { releaseFirst = resolve })
  const peers = new Promise(resolve => { releasePeers = resolve })
  const starts = []
  const operation = run(async url => {
    if (url.includes('/list?')) return listing(8)
    starts.push(url)
    if (url.endsWith('/910000')) { await first; return { ...detail(url), Id: '910007' } }
    await peers
    return detail(url)
  }, { detailConcurrency: 3 })
  const observed = operation.then(value => ({ value }), error => ({ error }))
  try {
    await turn(); await turn()
    assert.equal(starts.length, 3)
    releaseFirst()
    const settled = await Promise.race([observed, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 100))])
    assert.equal(settled.timedOut, undefined)
    assert.match(settled.error?.message ?? '', /identity/)
    await turn()
    assert.equal(starts.length, 3, 'Unstarted peers must not issue late requests after terminal identity failure')
  } finally { releaseFirst(); releasePeers(); await observed }
})

test('Oracle parallel details preserve the exact opaque source abort even when readers ignore it', async () => {
  const controller = new AbortController(), reason = Object.freeze({ opaqueSourceStop: true })
  let release
  const wait = new Promise(resolve => { release = resolve })
  let requests = 0
  const operation = run(async url => {
    if (url.includes('/list?')) return listing(8)
    requests++
    await wait
    return detail(url)
  }, { detailConcurrency: 3, signal: controller.signal })
  const observed = operation.then(value => ({ value }), error => ({ error }))
  try {
    await turn(); await turn()
    assert.equal(requests, 3)
    controller.abort(reason)
    const settled = await observed
    assert.equal(settled.error, reason)
    await turn()
    assert.equal(requests, 3)
  } finally { controller.abort(reason); release(); await observed }
})

test('Oracle a parallel transport failure retains other details and forbids cleanup', async () => {
  const jobs = await run(async url => {
    if (url.includes('/list?')) return listing(8)
    if (url.endsWith('/910000')) throw Object.assign(new Error('HTTP 503'), { status: 503 })
    await turn()
    return detail(url)
  }, { detailConcurrency: 3 })
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 7)
  assert.equal(jobs[0].sourceDetailFailureKind, 'upstream')
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('Oracle rejects invalid detail concurrency before reading any native response', async () => {
  for (const detailConcurrency of [0, -1, 2.5, 11, Infinity]) {
    let requests = 0
    await assert.rejects(run(async url => { requests++; return url.includes('/list?') ? listing(1) : detail(url) },
      { detailConcurrency }), /detailConcurrency/)
    assert.equal(requests, 0)
  }
})
