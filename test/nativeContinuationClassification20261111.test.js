import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'

// Authored declaration protocols only: these inputs are not employer captures,
// PDF/board models, vacancy facts, country evidence or recovery evidence.
// The optional root is used only to execute this outside-backend draft against
// the actual checkout. Installed tests resolve their backend from this file.
const backend = process.env.NATIVE_CONTINUATION_BACKEND_URL
  ? new URL(process.env.NATIVE_CONTINUATION_BACKEND_URL)
  : new URL('../', import.meta.url)
const load = relative => import(new URL(relative, backend))
const { classifyScraperError } = await load('scraper-support/utils/failureClassification.js')
const html = (head, body) => '<!doctype html><html><head>' + head + '</head><body>' + body + '</body></html>'
const hash = value => createHash('sha256').update(value).digest('hex')
const soft = { softFailure: true, upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed' }
const hard = { softFailure: false, upstreamOutage: false, failureKind: 'hard_failure' }
const definitions = [
  {
    family: 'btlindia', model: 'currentDeclarations.js', prefix: 'BTL India native: ', code: 'BTL_INDIA_NATIVE_CONTRACT',
    head: '<title>BTL India: Making Technology that Changes Lives for the Better</title>',
    body: '<h1>BE PART OF OUR TEAM !</h1><p>btlinrd-hr@btlnet.com</p><div class="card"><div class="card-header"><h4>Job Opportunities</h4></div><h4><a href="/admin/image/career/authored-protocol.pdf">Authored declaration role</a></h4></div>',
    parserMessage: 'HTML contract: Active native content: Unterminated native attribute value',
    transportMessage: 'public GET failed at https://www.btlnet.co.in/careers.php',
  },
  {
    family: 'circleci', model: 'currentModels.js', prefix: 'CircleCI native: ', code: 'CIRCLECI_NATIVE_CONTRACT',
    head: '<title>Career Opportunities - CircleCI</title>',
    body: '<h1>Current open roles</h1><div id="jobs-list"><a href="/careers/jobs/123/?gh_jid=123"><h3>Authored declaration role</h3><p>India</p></a></div>',
    parserMessage: 'HTML contract failed',
    transportMessage: 'public GET failed at https://circleci.com/careers/jobs/',
  },
]
const selected = process.env.NATIVE_CONTINUATION_FAMILY
if (selected !== undefined) assert.ok(definitions.some(row => row.family === selected), 'Unknown test family')
if (process.env.NATIVE_CONTINUATION_OBSERVATIONS === '1') console.log('NATIVE_CONTINUATION_RUN_METADATA ' + JSON.stringify({
  nodeVersion: process.version, family: selected ?? 'both', DOMMatrixDefined: typeof globalThis.DOMMatrix !== 'undefined',
  authoredDeclarationProtocolsOnly: true, nativeCapturesUsed: false, qualifiedJobs: 0,
}))
const capture = async operation => {
  try { await operation() } catch (error) { return error }
  assert.fail('Expected source rejection')
}
const metadata = error => ({ softFailure: error.softFailure, upstreamOutage: error.upstreamOutage, failureKind: error.failureKind })
const observe = (source, label, kind, input, error, calls = [], observers = null) => {
  if (process.env.NATIVE_CONTINUATION_OBSERVATIONS !== '1') return
  console.log('NATIVE_CONTINUATION_OBSERVATION ' + JSON.stringify({ family: source.family, label, kind,
    provenance: 'authored declaration protocol or injected local collaborator',
    inputSHA256: input === null ? null : hash(input), rejected: error !== null,
    classification: error === null ? null : classifyScraperError(error),
    metadata: error === null ? null : metadata(error),
    error: error === null ? null : { name: error.name, message: error.message, code: error.code, abortRetries: error.abortRetries },
    ownedByActualSourceFactory: error === null ? null : source.isFailure(error),
    inventoryEvidence: error?.inventoryEvidence ?? null,
    originalResponseReceipts: error?.nativeOriginalResponses ?? [], calls, observers,
    employerVacanciesEstablished: false, nativeSourcePositive: false }))
}
const checkOwned = (source, error, message) => {
  assert.ok(error instanceof Error)
  assert.equal(error.message, source.prefix + message)
  assert.equal(source.isFailure(error), true)
  assert.equal(error.code, source.code)
  assert.equal(error.abortRetries, true)
  assert.deepEqual(error.inventoryEvidence, {
    status: 'coverage-gap', surface: source.CAREERS, firstParty: true,
    listingComplete: false, reportedTotal: null, indiaFacetCount: null,
  })
}
const checkReceipt = (source, error, input) => {
  assert.equal(error.nativeOriginalResponses.length, 1)
  const row = error.nativeOriginalResponses[0], bytes = Buffer.from(input)
  assert.equal(row.source, source.family)
  assert.equal(row.sequence, 1)
  assert.equal(row.requestedURL, source.CAREERS)
  assert.equal(row.method, 'GET')
  assert.equal(row.body, null)
  assert.deepEqual(row.requestHeaders, { Accept: 'text/html' })
  assert.equal(row.status, 200)
  assert.equal(row.finalURL, source.CAREERS)
  assert.equal(row.contentType, 'text/html; charset=utf-8')
  assert.deepEqual(row.headers, { 'content-type': 'text/html; charset=utf-8' })
  assert.equal(row.originalBodyComplete, true)
  assert.equal(row.bodyBytes, bytes.length)
  assert.equal(row.bodySHA256, hash(input))
  assert.equal(row.bodyBase64, bytes.toString('base64'))
  assert.ok(Number.isFinite(Date.parse(row.startedAt)))
  assert.ok(Number.isFinite(Date.parse(row.completedAt)))
  assert.equal(Object.hasOwn(row, 'upstreamErrorName'), false)
}
const publicBody = async (source, input) => {
  const calls = [], observers = { audit: 0, records: 0 }
  const error = await capture(() => source.run({ now: '2026-11-11T00:00:00.000Z',
    fetchResponse: async (url, init) => {
      calls.push(url)
      assert.equal(url, source.CAREERS)
      assert.equal(calls.length, 1, 'No continuation, PDF, board, detail or asset is admitted')
      assert.equal(init.method, 'GET')
      assert.equal(init.redirect, 'manual')
      assert.equal(init.credentials, 'omit')
      assert.deepEqual(init.headers, { Accept: 'text/html' })
      return { status: 200, finalURL: url, contentType: 'text/html; charset=utf-8',
        headers: { 'content-type': 'text/html; charset=utf-8' }, bytes: Buffer.from(input) }
    }, onAudit: () => { observers.audit++ }, onRecords: () => { observers.records++ } }))
  assert.deepEqual(calls, [source.CAREERS])
  assert.deepEqual(observers, { audit: 0, records: 0 })
  checkReceipt(source, error, input)
  return { error, calls, observers }
}
const checkContinuationCategory = error => assert.deepEqual({ classification: classifyScraperError(error), metadata: metadata(error) },
  { classification: soft, metadata: soft }, 'NATIVE_CONTINUATION_CATEGORY: explicit unqualified continuation stays rejected as structured soft surface drift')

for (const definition of definitions.filter(row => selected === undefined || row.family === selected)) {
  const source = { ...definition, ...await load('scraper/' + definition.family + '/' + definition.model),
    run: (await load('scraper/' + definition.family + '/script.js')).run }
  const inputs = {
    baseline: html(source.head, source.body),
    sameOriginContinuation: html(source.head, source.body + '<a rel="next" href="/authored-next-page">Next</a>'),
    foreignContinuation: html(source.head + '<link rel="alternate NeXt" href="https://example.invalid/authored-next-page">', source.body),
    malformedAttribute: html(source.head, source.body + '<div data-authored="unterminated'),
  }
  await test(source.family + ' authored envelope without continuation reaches declaration parsing only', () => {
    const model = source.readCareers(inputs.baseline)
    assert.equal(model.roles.length, 1)
    assert.equal(model.publisherProgramsExecuted, false)
    observe(source, 'direct authored envelope without continuation', 'declaration-baseline', inputs.baseline, null)
  })
  for (const inputName of ['sameOriginContinuation', 'foreignContinuation']) {
    await test(source.family + ' direct ' + inputName + ' rejects with structured soft surface drift', async () => {
      const error = await capture(() => source.readCareers(inputs[inputName]))
      checkOwned(source, error, 'new native continuation requires qualification')
      assert.equal(Object.hasOwn(error, 'nativeOriginalResponses'), false)
      assert.equal(Object.hasOwn(error, 'cause'), false)
      observe(source, 'direct ' + inputName, 'continuation-target', inputs[inputName], error)
      checkContinuationCategory(error)
    })
    await test(source.family + ' public ' + inputName + ' rejects before later admission with structured soft surface drift', async () => {
      const { error, calls, observers } = await publicBody(source, inputs[inputName])
      checkOwned(source, error, 'new native continuation requires qualification')
      assert.equal(Object.hasOwn(error, 'cause'), false)
      observe(source, 'actual public current run ' + inputName, 'continuation-target', inputs[inputName], error, calls, observers)
      checkContinuationCategory(error)
    })
  }
  await test(source.family + ' actual direct malformed attribute parser rejection stays owned and hard', async () => {
    const error = await capture(() => source.readCareers(inputs.malformedAttribute))
    checkOwned(source, error, source.parserMessage)
    observe(source, 'direct actual parser exception', 'hard-control', inputs.malformedAttribute, error)
    assert.equal(error.softFailure, undefined)
    assert.deepEqual(classifyScraperError(error), hard)
  })
  await test(source.family + ' actual public malformed attribute parser rejection stays owned and hard', async () => {
    const { error, calls, observers } = await publicBody(source, inputs.malformedAttribute)
    checkOwned(source, error, source.parserMessage)
    observe(source, 'actual public current run parser exception', 'hard-control', inputs.malformedAttribute, error, calls, observers)
    assert.equal(error.softFailure, undefined)
    assert.deepEqual(classifyScraperError(error), hard)
  })
  for (const [label, options, message, owned] of [
    ['invalid clock', { now: 'authored invalid date' }, source.prefix + 'invalid observation clock', true],
    ['invalid job cap', { maxJobs: -1 }, source.prefix.replace(': ', ' ') + 'invalid job cap', false],
    ['invalid page cap', { maxPages: -1 }, source.prefix.replace(': ', ' ') + 'invalid page cap', false],
    ...(source.family === 'circleci'
      ? [['insufficient page cap', { maxPages: 1 }, source.prefix + 'caller page limit prevents careers and board channel closure', true]] : []),
  ]) {
    await test(source.family + ' public local ' + label + ' stays hard before any transport', async () => {
      const calls = [], observers = { audit: 0, records: 0 }
      const error = await capture(() => source.run({ now: '2026-11-11T00:00:00.000Z', ...options,
        fetchResponse: async url => { calls.push(url); assert.fail('Local invalid input cannot admit transport') },
        onAudit: () => { observers.audit++ }, onRecords: () => { observers.records++ } }))
      assert.equal(error.message, message)
      assert.equal(source.isFailure(error), owned)
      if (owned) checkOwned(source, error, message.slice(source.prefix.length))
      else assert.ok(error instanceof RangeError)
      assert.deepEqual(calls, [])
      assert.deepEqual(observers, { audit: 0, records: 0 })
      observe(source, 'actual public current run local ' + label, 'hard-control', null, error, calls, observers)
      assert.equal(error.softFailure, undefined)
      assert.deepEqual(classifyScraperError(error), hard)
    })
  }
  await test(source.family + ' public ordinary frozen transport fault keeps its exact cause and hard category', async () => {
    const primary = Object.freeze(Error('authored ordinary collaborator fault')), calls = [], observers = { audit: 0, records: 0 }
    const error = await capture(() => source.run({ now: '2026-11-11T00:00:00.000Z',
      fetchResponse: async url => { calls.push(url); throw primary },
      onAudit: () => { observers.audit++ }, onRecords: () => { observers.records++ } }))
    checkOwned(source, error, source.transportMessage)
    assert.equal(error.cause, primary)
    assert.equal(Object.hasOwn(primary, 'softFailure'), false)
    assert.deepEqual(calls, [source.CAREERS])
    assert.deepEqual(observers, { audit: 0, records: 0 })
    assert.equal(error.nativeOriginalResponses.length, 1)
    const receipt = error.nativeOriginalResponses[0]
    assert.equal(receipt.requestedURL, source.CAREERS)
    assert.equal(receipt.originalBodyComplete, false)
    assert.equal(receipt.upstreamErrorName, 'Error')
    observe(source, 'actual public current run ordinary transport cause', 'hard-control', null, error, calls, observers)
    assert.equal(error.softFailure, undefined)
    assert.deepEqual(classifyScraperError(error), hard)
  })
  await test(source.family + ' ordinary mixed failure factory keeps its owned hard default', () => {
    const error = source.failure('authored ordinary owned contract fault')
    checkOwned(source, error, 'authored ordinary owned contract fault')
    assert.equal(Object.hasOwn(error, 'nativeOriginalResponses'), false)
    observe(source, 'direct mixed factory ordinary error', 'hard-control', null, error)
    assert.equal(error.softFailure, undefined)
    assert.deepEqual(classifyScraperError(error), hard)
  })
}
