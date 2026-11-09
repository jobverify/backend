import assert from 'node:assert/strict'
import test from 'node:test'
import { createUltravioletteAutomotiveScraper, createRequestScope } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readBoard, readAPI, readDetail, descriptionText } from './native.js'

const fixture = name => {
  const plain = new URL('./fixtures/' + name, import.meta.url)
  return JSON.parse(existsSync(plain) ? readFileSync(plain) : gunzipSync(readFileSync(new URL(plain.href + '.gz'))))
}
const captures = () => [fixture('official-response.json'), fixture('official-client-response.json'), fixture('legacy-official-response.json'), ...fixture('native-responses.json'), ...fixture('detail-responses.json')]

const response = (url, status, body) => ({ url, status, ok: status === 200, text: async () => body })
const homepage = '<html><title>Ultraviolette</title><footer>Ultraviolette Automotive</footer></html>'
const replaceNativeDetail = (html, detail) => {
  const literal = JSON.stringify([detail]).replaceAll('\\', '\\\\').replaceAll("'", "\\'")
  return html.replace(/var\s+jobs\s*=\s*JSON\.parse\(\s*'((?:\\.|[^'\\])*)'\s*\)/, () => "var jobs = JSON.parse('" + literal + "')")
}

test('secondary geography and explicit city/state country contradictions cannot certify India', () => {
  const [board, api] = fixture('native-responses.json')
  const row = readAPI(api.body, readBoard(board.body))[0]
  const captured = fixture('detail-responses.json')[0]
  const original = readDetail(captured.body, row).detail
  for (const geo of [{ SecondaryCountry:'Canada' }, { Locations:[{ Country:'Canada' }] }, { State:'CA' }, { City:'Toronto, Canada' }]) {
    const detail = { ...original, ...geo }
    const html = replaceNativeDetail(captured.body, detail)
    assert.throws(() => readDetail(html, { ...row, ...(geo.City ? { City:geo.City } : {}) }), /geograph|country|state/i)
  }
  const payload = JSON.parse(api.body)
  payload.data[0].SecondaryCountry = 'Canada'
  assert.throws(() => readAPI(JSON.stringify(payload), readBoard(board.body)), /geograph/i)
})

test('strong-only and bold-only long headings are not full descriptions', () => {
  for (const tag of ['strong','b']) assert.equal(descriptionText(`<${tag}>Candidate qualifications and detailed job description requirements</${tag}>`, 'Different title'), null)
})

test('every advertised continuation fails closed rather than certifying a partial first page', () => {
  const [board, api] = fixture('native-responses.json')
  for (const target of ['root','info']) for (const key of ['more_records','next_page','hasMore','next']) {
    const payload = JSON.parse(api.body)
    ;(target === 'root' ? payload : payload.info)[key] = true
    assert.throws(() => readAPI(JSON.stringify(payload), readBoard(board.body)), /pagination/)
  }
})

test('infinite and overflowing deadline values are rejected', () => {
  for (const option of ['timeoutMs','overallTimeoutMs']) for (const value of [Infinity, 2147483648, NaN]) assert.throws(() => createRequestScope({ [option]:value }), /timeout/i)
})

test('a same-origin redirect to a different path is rejected', async () => {
  const scope = createRequestScope({ fetchImpl: async () => response('https://ultraviolette.zohorecruit.in/jobs/Careers/2/Other', 200, '') })
  try { await assert.rejects(scope.get('https://ultraviolette.zohorecruit.in/jobs/Careers/1/Expected'), /redirect/i) } finally { scope.close() }
})

test('captured current official Zoho inventory extracts all 34 explicit India roles', async () => {
  const rows = captures()
  const jobs = await createUltravioletteAutomotiveScraper().run({ fetchImpl: async url => {
    const captured = rows.find(row => row.url === url) || (url.endsWith('.com/') ? { url, status: 200, body: homepage } : null)
    assert.ok(captured, 'Unexpected capture URL: ' + url)
    return response(captured.finalUrl || url, captured.status, captured.body)
  } })
  assert.equal(jobs.length, 34)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 34)
  assert.ok(jobs.every(job => job.company === 'Ultraviolette Automotive' && job.country === 'India'))
  assert.ok(jobs.every(job => job.jobDescription?.length > 100))
  assert.ok(jobs.every(job => job.postingDate === null && job.postedAt === null && job.nativeDateOpenedIsPublicationDate === false))
})

test('an explicit foreign inventory keeps its native total without claiming verified empty', async () => {
  const rows = captures()
  const jobs = await createUltravioletteAutomotiveScraper().run({ fetchImpl: async url => {
    const captured = rows.find(row => row.url === url)
    return response(captured.finalUrl, captured.status, captured.body.replaceAll('India', 'Canada').replaceAll('Karnataka', 'Ontario'))
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 34)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('missing or inert descriptions stay null rather than claiming a full JD', () => {
  for (const description of [undefined, '', '<h1>Job Description</h1>', '<script>full description content here with many words</script>', '<template><p>Full job responsibilities and requirements are present here.</p></template>', '<div inert>Full job responsibilities and requirements are present here.</div>', '<p style="content-visibility:hidden">Full job responsibilities and requirements are present here.</p>', '<p hidden>Full job responsibilities and requirements are present here.</p>', '<p>Senior Battery Management Systems Engineer</p>']) {
    assert.equal(descriptionText(description, 'Senior Battery Management Systems Engineer'), null)
  }
})

test('native API cannot silently truncate or introduce additional IDs', () => {
  const [board, api] = fixture('native-responses.json')
  const payload = JSON.parse(api.body)
  payload.data.pop()
  assert.throws(() => readAPI(JSON.stringify(payload), readBoard(board.body)), /ID mismatch/)
  payload.info.more_records = true
  assert.throws(() => readAPI(JSON.stringify(payload), readBoard(board.body)), /pagination/)
})

test('detail country conflicts, unknown country, wrong title and employer fail closed', () => {
  const [board, api] = fixture('native-responses.json')
  const row = readAPI(api.body, readBoard(board.body))[0]
  const captured = fixture('detail-responses.json')[0]
  assert.throws(() => readDetail(captured.body, { ...row, Country1: 'United States' }), /contradictory explicit country/)
  assert.throws(() => readDetail(captured.body, { ...row, Posting_Title: 'Different role' }), /identity mismatch/)
  assert.throws(() => readDetail(captured.body.replaceAll('Ultraviolette Automotive Private Limited', 'Unrelated employer'), row), /employer changed/)
  assert.throws(() => readDetail(captured.body.replaceAll('India', 'Unknownland'), { ...row, Country: 'Unknownland' }), /explicit country/)
})

test('a missing JD keeps an otherwise eligible role and makes the attempt partial', async () => {
  const rows = captures()
  const api = JSON.parse(rows.find(row => row.url.includes('/recruit/v2/public/')).body)
  const first = api.data[0]
  const captured = rows.find(row => row.url === first.$url)
  const detail = readDetail(captured.body, first).detail
  detail.Job_Description = '<h1>Job Description</h1>'
  delete detail.Date_Opened
  const literal = JSON.stringify([detail]).replaceAll('\\', '\\\\').replaceAll("'", "\\'")
  captured.body = captured.body.replace(/var\s+jobs\s*=\s*JSON\.parse\(\s*'((?:\\.|[^'\\])*)'\s*\)/, () => "var jobs = JSON.parse('" + literal + "')")
  const jobs = await createUltravioletteAutomotiveScraper().run({ fetchImpl: async url => {
    const capture = rows.find(row => row.url === url)
    assert.ok(capture, url)
    return response(capture.finalUrl, capture.status, capture.body)
  } })
  assert.equal(jobs.length, 34)
  const job = jobs.find(job => job.id === first.id)
  assert.equal(job.jobDescription, null)
  assert.equal(job.postingDate, null)
  assert.equal(job.nativeDateOpened, null)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a fatal detail failure aborts active requests and never starts queued detail work', async () => {
  const rows = captures()
  const detailURLs = new Set(fixture('detail-responses.json').map(row => row.url))
  let started = 0
  await assert.rejects(createUltravioletteAutomotiveScraper().run({ fetchImpl: async url => {
    if (detailURLs.has(url)) {
      started++
      if (started === 1) return response(url, 503, 'temporary outage')
      return new Promise(() => {})
    }
    const captured = rows.find(row => row.url === url)
    return response(captured.finalUrl, captured.status, captured.body)
  } }), /detail HTTP 503/)
  assert.ok(started <= 4)
})

test('retired careers routes produce an explicit coverage gap instead of verified zero', async () => {
  const calls = []
  const jobs = await createUltravioletteAutomotiveScraper().run({ fetchImpl: async url => {
    calls.push(url)
    return response(url, url.endsWith('.com/') ? 200 : 404, url.endsWith('.com/') ? homepage : '<h1>ERROR 404</h1>')
  } })
  assert.deepEqual(calls, ['https://www.ultraviolette.com/careers'])
  assert.deepEqual([...jobs], [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.reportedTotal, null)
})

test('changed successful careers page cannot certify zero without inventory', async () => {
  const jobs = await createUltravioletteAutomotiveScraper().run({ fetchImpl: async url => response(url, 200, homepage + '<h1>Current openings</h1>') })
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
})

test('network failure is surfaced and cannot be converted into zero', async () => {
  const reason = new Error('network unavailable')
  await assert.rejects(createUltravioletteAutomotiveScraper().run({ fetchImpl: async () => { throw reason } }), e => e === reason)
})

test('caller cancellation preserves exact reason even when fetch ignores its signal', async () => {
  const controller = new AbortController()
  const reason = { caller: 'cancelled' }
  const pending = createUltravioletteAutomotiveScraper().run({ signal: controller.signal, fetchImpl: () => new Promise(() => {}) })
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason)
})

test('caller cancellation interrupts a hung body with the exact reason', async () => {
  const controller = new AbortController()
  const reason = new Error('caller stopped body')
  let bodyStarted
  const started = new Promise(resolve => { bodyStarted = resolve })
  const pending = createUltravioletteAutomotiveScraper().run({ signal: controller.signal, fetchImpl: async url => ({ ...response(url, 200, ''), text: () => { bodyStarted(); return new Promise(() => {}) } }) })
  await started
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason)
})

test('body reads are bounded even when upstream ignores signal', async () => {
  await assert.rejects(createUltravioletteAutomotiveScraper().run({ timeoutMs: 20, fetchImpl: async url => ({ ...response(url, 200, ''), text: () => new Promise(() => {}) }) }), /timed out/)
})

test('fetch itself is bounded when upstream ignores signal', async () => {
  await assert.rejects(createUltravioletteAutomotiveScraper().run({ timeoutMs: 20, fetchImpl: () => new Promise(() => {}) }), /timed out/)
})

test('an overall deadline bounds multiple requests', async () => {
  let calls = 0
  const scope = createRequestScope({ timeoutMs: 100, overallTimeoutMs: 15, fetchImpl: async url => {
    calls++
    await new Promise(resolve => setTimeout(resolve, 10))
    return response(url, 200, homepage)
  } })
  try { await assert.rejects((async () => { await scope.get('https://www.ultraviolette.com/first'); await scope.get('https://www.ultraviolette.com/second') })(), /overall request timed out/) } finally { scope.close() }
  assert.ok(calls <= 2)
})

test('fatal HTTP failure prevents later fetches', async () => {
  const calls = []
  await assert.rejects(createUltravioletteAutomotiveScraper().run({ fetchImpl: async url => {
    calls.push(url)
    return response(url, 503, homepage)
  } }), /HTTP 503/)
  assert.equal(calls.length, 1)
})

test('import is safe with unrelated --dry-run process argument', async () => {
  const { spawnSync } = await import('node:child_process')
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import fs from 'node:fs';let writes=0;fs.writeFileSync=()=>{writes++};process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('import fetched')};await import('./scraper/ultravioletteautomotive/script.js');if(writes)throw Error('import wrote files')"], { encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
})
