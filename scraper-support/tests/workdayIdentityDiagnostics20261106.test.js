import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runWorkdayScraper } from '../myworkday/engine.js'

const BOARD = 'https://identity-diagnostics.wd103.myworkdayjobs.com/Careers'
const API = 'https://identity-diagnostics.wd103.myworkdayjobs.com/wday/cxs/identity-diagnostics/Careers/jobs'
const CORPORATE = 'https://identity-diagnostics.example/careers'

// These are deliberately malformed protocol controls, not live native rows.
// A rejected row must stay rejected while its nonsecret identity is recorded.
const exercise = async (t, change) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-identity-diagnostic-'))
  t.after(() => {
    const resolved = fs.realpathSync(directory)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('workday-identity-diagnostic-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({
    listingStrategy: 'jobs-api', jobsApiUrl: API, detailUrlBase: BOARD,
    inventoryScope: 'complete-board-country-proof', officialCareersUrl: CORPORATE,
    locationCountry: null, searchText: '',
  }))
  const rows = Array.from({ length: 21 }, (_, index) => ({
    title: 'Nonsecret public title', externalPath: '/job/London/Engineer_R' + index,
    locationsText: 'London, United Kingdom', bulletFields: ['R' + index],
    privatePayloadControl: 'payload-must-stay-private',
  }))
  change(rows[20])
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input)
    let response
    if (init.method === 'POST') {
      assert.equal(url, API)
      const request = JSON.parse(init.body)
      response = Response.json({ total: request.offset ? 0 : 21,
        jobPostings: rows.slice(request.offset, request.offset + 20) })
    } else {
      assert.ok([BOARD, CORPORATE].includes(url), 'A malformed listing cannot start any native detail reads')
      response = new Response('<html><a href="' + BOARD + '">Careers</a></html>', {
        headers: { 'content-type': 'text/html', 'set-cookie': 'cookie-must-stay-private' },
      })
    }
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  return runWorkdayScraper({ source: 'identity-diagnostics', company: 'Identity Diagnostics',
    baseUrl: BOARD, scraperDir: directory, nativeDetailRecovery: false,
    retryBaseDelayMs: 0, requestTimeoutMs: 1000,
    requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} },
  })
}

for (const [label, change, reason, externalPath] of [
  ['blank title', row => { row.title = ' ' }, 'missing-title', '/job/London/Engineer_R20'],
  ['missing path', row => { delete row.externalPath }, 'invalid-external-path', null],
  ['nonstring path', row => { row.externalPath = { secret: 'payload-must-stay-private' } }, 'invalid-external-path', null],
  ['missing posting identifier', row => { row.externalPath = '/job/London/Unidentified' }, 'invalid-external-path', '/job/London/Unidentified'],
  ['query and fragment', row => { row.externalPath += '?token=query-must-stay-private#fragment-must-stay-private' }, 'outside-board', '/job/London/Engineer_R20'],
  ['absolute credentialed URL', row => { row.externalPath = 'https://username:password-must-stay-private@foreign.example/job/Engineer_R20' }, 'invalid-external-path', null],
]) test('Workday identity diagnostics retain hard rejection for ' + label, async t => {
  await assert.rejects(exercise(t, change), error => {
    assert.equal(error.name, 'WorkdayIncompleteListingError')
    assert.equal(error.failureKind, 'parser_or_contract_error')
    assert.notEqual(error.softFailure, true)
    assert.deepEqual(error.listingIdentity, { reason, board: BOARD, rowIndex: 20, externalPath })
    assert.ok(error.message.includes(JSON.stringify(error.listingIdentity)))
    assert.doesNotMatch(error.message, /(?:payload|cookie|query|fragment|password)-must-stay-private/)
    return true
  })
})
