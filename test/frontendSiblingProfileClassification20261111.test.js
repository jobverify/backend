import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { classifyScraperError } from '../scraper-support/utils/failureClassification.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { run as cloudRun } from '../scraper/cloudambassadors/script.js'
import { readCareers as cloudCareers } from '../scraper/cloudambassadors/currentDeclarations.js'
import { readData as cloudData } from '../scraper/cloudambassadors/currentData.js'
import { failure as cloudFailure, need as cloudNeed, isFailure as cloudOwned } from '../scraper/cloudambassadors/currentErrors.js'
import { run as finacusRun } from '../scraper/finacussolutions/script.js'
import { readCareers as finacusCareers, document as finacusDocument } from '../scraper/finacussolutions/currentDeclarations.js'
import { failure as finacusFailure, need as finacusNeed, isFailure as finacusOwned } from '../scraper/finacussolutions/currentErrors.js'

// All documents and parser inputs in this file are authored diagnostics. They
// are not employer captures, native role data, live drift or vacancy evidence.
const html = (head, body) => '<!doctype html><html><head>' + head + '</head><body>' + body + '</body></html>'
const hash = value => createHash('sha256').update(value).digest('hex')
const soft = { softFailure: true, upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed' }
const hard = { softFailure: false, upstreamOutage: false, failureKind: 'hard_failure' }
const sources = [
  {
    name: 'Cloud Ambassadors', run: cloudRun, careers: cloudCareers, failure: cloudFailure, need: cloudNeed, owned: cloudOwned,
    homeURL: 'https://cloudambassadors.com/', careersURL: 'https://cloudambassadors.com/careers',
    home: html('<title>Cloud Ambassadors \u2014 Maximizing Cloud Impact</title>', '<a href="https://cloudambassadors.com/careers">Careers</a>'),
    profile: html('<title>Careers | Cloud Ambassadors</title>', '<div><p>Open Roles</p><button class="cursor-pointer">Authored diagnostic label</button></div><script src="/_next/unreviewed-profile.js"></script>'),
    localCoordinate: html('<title>Careers | Cloud Ambassadors</title>', '<div>No renderer coordinate in this authored model</div>'),
    guard: 'Cloud Ambassadors native: unreviewed declared asset boundary', code: 'CLOUD_AMBASSADORS_NATIVE_CONTRACT', abortRetries: true,
  },
  {
    name: 'Finacus current default', run: finacusRun, careers: finacusCareers, failure: finacusFailure, need: finacusNeed, owned: finacusOwned,
    homeURL: 'https://www.finacus.co.in/', careersURL: 'https://www.finacus.co.in/careers/',
    home: html('', '<footer>Finacus Solutions Private Limited</footer><a href="https://www.finacus.co.in/careers/">Careers</a><a href="https://www.finacus.co.in/about/">About</a>'),
    profile: html('<script src="/cdn-cgi/scripts/7d0fa10a/cloudflare-static/rocket-loader.min.js" data-cf-settings="unreviewed-profile"></script>', '<footer>Finacus Solutions Private Limited</footer><h2>Current Openings</h2>'),
    localCoordinate: html('', '<footer>Finacus Solutions Private Limited</footer><h2>Current Openings</h2>'),
    guard: 'Finacus native unreviewed native loader settings', code: undefined, abortRetries: undefined,
  },
]
const capture = operation => { try { operation() } catch (error) { return error } assert.fail('Expected the guard to reject') }
const profileFailure = (source, error) => {
  assert.ok(error instanceof Error)
  assert.equal(error.message, source.guard)
  assert.equal(source.owned(error), true)
  assert.equal(error.code, source.code)
  assert.equal(error.abortRetries, source.abortRetries)
  assert.deepEqual(classifyScraperError(error), soft)
}
for (const source of sources) {
  test(source.name + ' public run keeps the explicit unfamiliar profile closed and classifies soft drift', async () => {
    const calls = []
    let audits = 0, records = 0
    await assert.rejects(source.run({ fetchResponse: async url => {
      calls.push(url)
      assert.equal(url, calls.length === 1 ? source.homeURL : source.careersURL)
      assert.ok(calls.length <= 2, 'No asset/client or later native read is admitted')
      const body = calls.length === 1 ? source.home : source.profile
      return { status: 200, finalURL: url, contentType: 'text/html', headers: {}, bytes: Buffer.from(body) }
    }, onAudit: () => { audits++ }, onRecords: () => { records++ } }), error => {
      profileFailure(source, error)
      assert.equal(error.nativeOriginalResponses.length, 2)
      assert.deepEqual(error.nativeOriginalResponses.map(row => row.bodySHA256), [hash(source.home), hash(source.profile)])
      return true
    })
    assert.deepEqual(calls, [source.homeURL, source.careersURL])
    assert.equal(audits, 0)
    assert.equal(records, 0)
  })
  test(source.name + ' direct unfamiliar profile guard keeps its own error identity/category', () => {
    profileFailure(source, capture(() => source.careers(source.profile)))
  })
  test(source.name + ' invalid local clock stays owned and hard with zero reads', async () => {
    let calls = 0
    await assert.rejects(source.run({ now: 'invalid authored local clock', fetchResponse: async () => { calls++; assert.fail('No read for invalid local clock') } }), error => {
      assert.equal(source.owned(error), true)
      assert.match(error.message, /invalid observation clock/)
      assert.equal(error.softFailure, undefined)
      assert.deepEqual(classifyScraperError(error), hard)
      return true
    })
    assert.equal(calls, 0)
  })
  test(source.name + ' invalid local cap stays a hard RangeError with zero reads', async () => {
    let calls = 0
    await assert.rejects(source.run({ maxJobs: -1, fetchResponse: async () => { calls++; assert.fail('No read for invalid local cap') } }), error => {
      assert.ok(error instanceof RangeError)
      assert.equal(error.softFailure, undefined)
      assert.equal(classifyScraperError(error).softFailure, false)
      return true
    })
    assert.equal(calls, 0)
  })
  test(source.name + ' ordinary frozen collaborator error retains its exact cause and hard category', async () => {
    const primary = Object.freeze(new Error('Authored ordinary collaborator fault'))
    let calls = 0
    await assert.rejects(source.run({ fetchResponse: async () => { calls++; throw primary } }), error => {
      assert.equal(error.cause, primary)
      assert.equal(source.owned(error), true)
      assert.deepEqual(classifyScraperError(error), hard)
      assert.equal(Object.hasOwn(primary, 'softFailure'), false)
      return true
    })
    assert.equal(calls, 1)
  })
  test(source.name + ' default mixed failure and need remain owned hard errors', () => {
    for (const error of [source.failure('invalid local coordinate'), capture(() => source.need(false, 'invalid local coordinate'))]) {
      assert.equal(source.owned(error), true)
      assert.equal(error.softFailure, undefined)
      assert.equal(error.code, source.code)
      assert.equal(error.abortRetries, source.abortRetries)
      assert.deepEqual(classifyScraperError(error), hard)
    }
  })
  test(source.name + ' zero cap keeps the existing no-read coverage hold', async () => {
    let reads = 0, clocks = 0
    const jobs = await source.run({ maxJobs: 0, now: () => { clocks++; assert.fail('Zero cap does not use clock') }, fetchResponse: async () => { reads++; assert.fail('Zero cap does not read') } })
    assert.equal(reads, 0)
    assert.equal(clocks, 0)
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  })
  for (const [label, reason] of [['null', null], ['false', false], ['zero', 0], ['empty', ''], ['frozen', Object.freeze({ caller: 'opaque diagnostic reason' })], ['default', undefined]]) {
    test(source.name + ' caller ' + label + ' wins at the profile response with exact reason and no facts', async () => {
      const controller = new AbortController()
      let calls = 0, audits = 0
      await assert.rejects(source.run({ signal: controller.signal, fetchResponse: async url => {
        calls++
        if (calls === 2) controller.abort(reason)
        return { status: 200, finalURL: url, contentType: 'text/html', headers: {}, bytes: Buffer.from(calls === 1 ? source.home : source.profile) }
      }, onAudit: () => { audits++ } }), error => error === controller.signal.reason)
      assert.equal(calls, 2)
      assert.equal(audits, 0)
      if (reason && typeof reason === 'object') assert.equal(Object.hasOwn(reason, 'softFailure'), false)
    })
  }
  test(source.name + ' missing local renderer coordinate remains a hard owned error', () => {
    const error = capture(() => source.careers(source.localCoordinate))
    assert.equal(source.owned(error), true)
    assert.match(error.message, /expected one/)
    assert.equal(error.softFailure, undefined)
    assert.deepEqual(classifyScraperError(error), hard)
  })
}
test('Cloud Ambassadors actual Acorn syntax rejection stays an owned hard parser-family fault', () => {
  const error = capture(() => cloudData([{ kind: 'javascript', text: 'if(' }], []))
  assert.equal(cloudOwned(error), true)
  assert.match(error.message, /declared client syntax unreviewed/)
  assert.equal(error.softFailure, undefined)
  assert.deepEqual(classifyScraperError(error), hard)
})
test('Finacus actual malformed HTML parser rejection stays owned and hard', () => {
  const error = capture(() => finacusDocument('<div data-diagnostic="unterminated>'))
  assert.equal(finacusOwned(error), true)
  assert.match(error.message, /HTML contract|Unterminated/)
  assert.equal(error.softFailure, undefined)
  assert.equal(classifyScraperError(error).softFailure, false)
})
