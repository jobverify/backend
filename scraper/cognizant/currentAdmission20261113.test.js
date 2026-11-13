import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { readObservedCognizantRole, runCognizantCurrent20261113 } from './currentNative20261113.js'
import { extractSearchResults, extractPaginationSummary, run } from './script.js'

const folder = new URL('./fixtures/current-20261113/positive-native/', import.meta.url)
const receipts = JSON.parse(readFileSync(new URL('receipts.json', folder)))
const css = gunzipSync(readFileSync(new URL('current-native.css.gz', folder))).toString()
const sourceHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
const role = id => {
  const receipt = receipts.find(row => row.requestedUrl.includes('/' + id + '/'))
  assert.ok(receipt, 'retained current role exists: ' + id)
  return { html: gunzipSync(readFileSync(new URL(receipt.file, folder))).toString(), sourceUrl: receipt.requestedUrl, id, css }
}
const observe = value => readObservedCognizantRole(value.html, value)

test('actual Hong Kong role cannot acquire an India country through provider defaults', () => {
  const row = observe(role('00070546091'))
  assert.deepEqual(row.nativeCountries, ['Hong Kong'])
  assert.equal(row.indiaCandidate, false)
  assert.equal(row.job, null)
})

test('actual singleton native India country and every authored employment condition survive', () => {
  const row = observe(role('00071271382'))
  assert.equal(row.indiaCandidate, true)
  assert.equal(row.criteriaComplete, true)
  assert.match(row.originalDescription, /current state or government issued ID/)
  assert.match(row.originalDescription, /attend interviews in person or by video conference/)
  assert.match(row.originalDescription, /front-to-back service blueprint/)
  assert.equal(row.declaredApplyRoleId, '00071271382')
  assert.equal(row.job, null, 'a handoff without a verified usable application remains audit only')
})

test('a current India role with an additional unresolved native location remains unqualified', () => {
  const value = role('00071271382')
  value.html = value.html.replace(/(<script[^>]+id="js-job-posting"[^>]*>)([\s\S]*?)(<\/script>)/i, (_all, open, raw, close) => {
    const record = JSON.parse(raw)
    record.jobLocation = [record.jobLocation, { '@type': 'Place', address: { addressLocality: 'Unresolved office' } }].flat()
    return open + JSON.stringify(record) + close
  })
  const row = observe(value)
  assert.equal(row.indiaCandidate, false)
  assert.equal(row.countryComplete, false)
  assert.equal(row.job, null)
})

test('offscreen or hidden authored criteria cannot qualify from JSON-LD alone', () => {
  for (const attribute of [' style="position:absolute;left:-99999px"', ' hidden']) {
    const value = role('00071271382')
    value.html = value.html.replace('<article class="cms-content">', '<article class="cms-content"' + attribute + '>')
    assert.equal(observe(value).criteriaComplete, false)
    assert.equal(observe(value).job, null)
  }
})

test('a hidden criterion child is held even when its raw text agrees with metadata', () => {
  const value = role('00071271382')
  value.html = value.html.replace('current state or government issued ID', '<span hidden>current state or government issued ID</span>')
  assert.equal(observe(value).criteriaComplete, false)
})

test('the actual Apply link cannot be rebound to a different RRID', () => {
  const value = role('00071271382')
  value.html = value.html.replace('RRID=00071271382&amp;', 'RRID=00070546091&amp;')
  const row = observe(value)
  assert.equal(row.applicationHandoffComplete, false)
  assert.equal(row.job, null)
})

test('changed CSS cannot authorize the role or its visible original criteria', () => {
  const value = role('00071271382')
  value.css += '\n.cms-content{position:absolute;left:-99999px}'
  assert.equal(observe(value).criteriaComplete, false)
})

test('all 80 retained native records preserve their countries and all 27 India articles preserve full conditions', () => {
  const records = receipts.filter(row => /\/jobs\/.+\//.test(new URL(row.requestedUrl).pathname)).map(receipt => {
    const html = gunzipSync(readFileSync(new URL(receipt.file, folder))).toString()
    const id = extractSearchResults(html)[0]?.jobId || html.match(/name="JobIdentifier"[^>]*content="([^"]+)"/)[1]
    return readObservedCognizantRole(html, { id, sourceUrl: receipt.requestedUrl, css })
  })
  assert.equal(records.length, 80)
  const india = records.filter(row => row.indiaCandidate)
  assert.equal(india.length, 27)
  for (const row of india) {
    assert.equal(row.criteriaComplete, true, row.id + ': ' + row.issues.join(';'))
    assert.equal(row.applicationHandoffComplete, true, row.id)
    assert.match(row.originalDescription, /current state or government issued ID/)
    assert.equal(row.job, null)
  }
})

const fixtureFetch = () => {
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url, method: init.method })
    assert.equal(init.method, 'GET')
    let body, status = 200, mime = 'text/html'
    const receipt = receipts.find(row => row.requestedUrl === url)
    if (receipt) body = gunzipSync(readFileSync(new URL(receipt.file, folder)))
    else if (url.includes('/phb/style.css.')) { body = css; mime = 'text/css' }
    // The captured Angular shell has no role-specific content. This synthetic
    // transport supplies that same inert shell, never application availability.
    else if (url.startsWith('https://talent.cognizant.com/4681/?RRID=')) body = gunzipSync(readFileSync(new URL('application-shell.html.gz', folder)))
    else if (url.endsWith('/main.e62755a514d3e160.js')) {
      body = gunzipSync(readFileSync(new URL('application-main-denied.html.gz', folder))); status = 403
    } else throw Error('Unexpected declared read: ' + url)
    const response = new Response(body, { status, headers: { 'content-type': mime } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  return { fetchImpl, requests }
}

test('registered run withholds all observations when the public application program is denied', async () => {
  const { fetchImpl, requests } = fixtureFetch()
  let audit
  const jobs = await run({ fetchImpl, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.observedRecordCount, 80)
  assert.equal(audit.observations.filter(row => row.indiaCandidate && row.criteriaComplete).length, 27)
  assert.equal(audit.applicationEvidence.available, false)
  assert.match(audit.applicationEvidence.reason, /HTTP 403/)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.closingStable, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(requests.filter(row => row.url.includes('/main.')).length, 1)
})

test('caller cancellation rejects while the terminal audit callback remains held', async () => {
  const { fetchImpl } = fixtureFetch()
  const controller = new AbortController(), reason = Error('caller cancelled held audit')
  let entered
  const entry = new Promise(resolve => { entered = resolve })
  const pending = runCognizantCurrent20261113({ fetchImpl, signal: controller.signal,
    onAudit: () => { entered(); return new Promise(() => {}) } }, { extractSearchResults, extractPaginationSummary, maxPages: 1, headers: sourceHeaders })
  await entry
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason)
})

test('registered current acquisition rejects HTTP500 as an upstream error before parsing or fallback', async () => {
  await assert.rejects(run({ fetchImpl: async () => new Response('upstream startup error', { status: 500 }) }), error =>
    error.status === 500 && error.upstreamOutage && error.failureKind === 'network_or_timeout')
})

test('the current reader preserves the existing public client profile that serves native page two', async () => {
  const fixture = fixtureFetch()
  let audit
  const fetchImpl = async (url, init) => {
    if (url === 'https://careers.cognizant.com/india-en/jobs/?page=2') {
      const profile = new Headers(init.headers).get('User-Agent') === sourceHeaders['User-Agent'] ? 'existing-source' : 'new-generic-helper'
      const body = gunzipSync(readFileSync(new URL('pagination-client-context/' + profile + '.body.gz', folder)))
      const response = new Response(body, { headers: { 'content-type': 'text/html' } })
      Object.defineProperty(response, 'url', { value: url })
      return response
    }
    return fixture.fetchImpl(url, init)
  }
  await runCognizantCurrent20261113({ fetchImpl, onAudit: value => { audit = value } }, {
    extractSearchResults, extractPaginationSummary, maxPages: 2, headers: sourceHeaders,
  })
  assert.equal(audit.observedRecordCount, 20)
})

test('cancellation during native detail reads retains already completed original observations', async () => {
  const fixture = fixtureFetch(), controller = new AbortController(), reason = Error('cancel native detail batch')
  let reached
  const entry = new Promise(resolve => { reached = resolve })
  let detailReads = 0
  const fetchImpl = async (url, init) => {
    if (/\/india-en\/jobs\/\d+\//.test(new URL(url).pathname) && ++detailReads === 5) {
      reached(); return new Promise(() => {})
    }
    return fixture.fetchImpl(url, init)
  }
  const pending = runCognizantCurrent20261113({ fetchImpl, signal: controller.signal }, {
    extractSearchResults, extractPaginationSummary, maxPages: 1, headers: sourceHeaders,
  })
  await entry
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason && error.sourceAudit.observedRecordCount >= 4
    && error.sourceAudit.observations.every(row => row.nativeRecord && row.nativeArticleHtml)
    && error.sourceAudit.lifecycleCleanupAllowed === false)
})
