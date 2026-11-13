import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runWorkdayScraper } from '../myworkday/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const BOARD = 'https://transient-identity.wd103.myworkdayjobs.com/Careers'
const API = 'https://transient-identity.wd103.myworkdayjobs.com/wday/cxs/transient-identity/Careers/jobs'
const CORPORATE = 'https://transient-identity.example/careers'

const collect = async (context, persistent = false) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-transient-identity-'))
  context.after(() => {
    const resolved = fs.realpathSync(directory)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('workday-transient-identity-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({
    listingStrategy: 'jobs-api', jobsApiUrl: API, detailUrlBase: BOARD,
    inventoryScope: 'complete-board-country-proof', officialCareersUrl: CORPORATE,
    locationCountry: null, searchText: '',
  }))
  const rows = Array.from({ length: 21 }, (_, index) => ({ title: 'Engineer',
    externalPath: '/job/London/Engineer_R' + index, locationsText: 'London, United Kingdom', bulletFields: ['R' + index] }))
  let passes = 0
  context.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input)
    let response
    if (init.method === 'POST') {
      assert.equal(url, API)
      const { offset } = JSON.parse(init.body)
      if (offset === 0) passes++
      const jobs = rows.slice(offset, offset + 20)
      if (offset === 20 && (passes === 1 || persistent)) jobs[0] = {}
      response = Response.json({ total: offset ? 0 : rows.length, jobPostings: jobs })
    } else {
      assert.ok([BOARD, CORPORATE].includes(url), 'foreign-only listing cannot start a detail read')
      response = new Response('<html><a href="' + BOARD + '">Careers</a></html>', { headers: { 'content-type': 'text/html' } })
    }
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  const running = runWorkdayScraper({ source: 'transient-identity', company: 'Transient Identity',
    baseUrl: BOARD, scraperDir: directory, nativeDetailRecovery: false, retryBaseDelayMs: 0, requestTimeoutMs: 1000,
    requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} } })
  return { running, passes: () => passes }
}

test('Workday discards an incomplete native page and reconciles one fresh complete enumeration', async context => {
  const operation = await collect(context)
  const jobs = await operation.running
  assert.equal(jobs.length, 0)
  assert.ok(operation.passes() >= 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 21)
})

test('Workday still hard-rejects a persistently missing role identity after one fresh enumeration', async context => {
  const operation = await collect(context, true)
  await assert.rejects(operation.running, error => {
    assert.equal(error.failureKind, 'parser_or_contract_error')
    assert.deepEqual(error.listingIdentity, { reason: 'missing-title', board: BOARD, rowIndex: 20, externalPath: null })
    return true
  })
  assert.equal(operation.passes(), 2)
})
