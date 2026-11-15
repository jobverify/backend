import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {createDripCapitalScraper, run, hasPublicJobsSignal} from './script.js'
import {run as nativeRun, DRIP_NATIVE_LIMITS} from './nativeCareers20261114.js'
import {readInventoryEvidence, sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {replayNative, originalBody, responseFromOriginal} from './fixtures/nativeReplay20261114.js'

test('The public-surface helper detects the actual current literal Drip Recruiterbox declaration', () => {
  assert.equal(hasPublicJobsSignal(originalBody(0).toString('utf8')), true)
})

test('Drip factory follows the genuine current declared handoff and closes four explicit India native text roles', async () => {
  const replay = replayNative()
  const jobs = await createDripCapitalScraper().run({fetchPage: replay.fetchImpl})
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map(job => job.sourceJobId), ['fk0znmm', 'fk0zlaf', 'fk0zldg', 'fk0pfc9'])
  assert.ok(jobs.every(job => job.country === 'India' && job.companyName === 'Drip Capital' && job.sourceDescriptionHTML.includes('jobdesciption')))
  assert.ok(jobs.every(job => job.postedAt === null && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(replay.reads.length, 14)
  assert.ok(replay.reads.every(row => row.method === 'GET' && row.redirect === 'manual' && row.credentials === 'omit'))
  assert.ok(replay.reads.every(row => !row.url.includes('fk0zlxm')))
})

const sha = value => createHash('sha256').update(value).digest('hex')
const changed = (raw, before, after) => {
  assert.ok(raw.includes(Buffer.from(before)), 'Mutation must target a genuine original carrier')
  return Buffer.from(raw.toString('utf8').replace(before, after))
}
const mutateAt = (requestIndex, transform) => replayNative({mutate: reply => reply.requestIndex === requestIndex ? transform(reply) : undefined})
const rejectsOriginalMutation = async (requestIndex, transform) => {
  const replay = mutateAt(requestIndex, transform)
  await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl}), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
    return true
  })
  assert.ok(replay.reads.length <= 14)
}

test('Both factory and exported run use the same native current acquisition and preserve exact original criteria/forms', async () => {
  for (const entry of [options => createDripCapitalScraper(options).run(), run, nativeRun]) {
    const replay = replayNative(), jobs = await entry({fetchImpl: replay.fetchImpl})
    assert.equal(jobs.length, 4)
    const audit = jobs.nativeCollectionEvidence
    assert.equal(audit.discoveryResponses, 6)
    assert.equal(audit.detailResponses, 8)
    assert.equal(audit.closingInventoryEqual, true)
    assert.equal(audit.closingCorporateHandoffEqual, true)
    assert.equal(audit.explicitOutOfCountryRecords[0].countries[0], 'United States')
    assert.equal(audit.wholeCompanyInventoryComplete, false)
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.ok(jobs.every(job => job.sourceDetailComplete && job.sourceNativeTextComplete && !job.sourceActivationComplete
      && !job.sourceRenderedCriteriaComplete && !job.sourceApplicationQualificationComplete && job.datePosted === null))
    for (const [index, record] of audit.openingRecords.entries()) {
      assert.equal(sha(record.fullNativeHTML), sha(originalBody(index + 3)))
      assert.equal(jobs[index].sourceDescriptionHTML, record.criteria.sourceDescriptionHTML)
      assert.equal(sha(jobs[index].sourceDescriptionHTML), record.originalCriteriaHTMLSHA256)
      assert.equal(record.forms.length, 2)
      assert.ok(record.forms.some(form => form.nativeReaderInert))
    }
    assert.match(jobs[0].sourceApplicationQuestions.join(' '), /individual contributor/i)
    assert.match(jobs[1].sourceApplicationQuestions.join(' '), /notice period/i)
    assert.match(jobs[2].sourceApplicationQuestions.join(' '), /travel|capital.*raised/i)
    assert.match(jobs[3].sourceApplicationQuestions.join(' '), /modelling|dataset/i)
    assert.match(jobs[2].sourceDescription, /5\s*-\s*10/)
    assert.match(jobs[2].sourceDescription, /6\s*-\s*10/)
  }
})

const roleMutations = [
  ['hidden owner', '<div class="jobdesciption">', '<div hidden class="jobdesciption">'],
  ['hidden ancestor', '<div class="col-md-9">', '<div hidden class="col-md-9">'],
  ['opacity ancestor', '<div class="col-md-9">', '<div style="opacity:0" class="col-md-9">'],
  ['CSS hide class', '<div class="jobdesciption">', '<div class="jobdesciption d-none">'],
  ['ARIA hidden criteria', '<div class="jobdesciption">', '<div class="jobdesciption" aria-hidden="true">'],
  ['duplicate raw attribute', '<div class="jobdesciption">', '<div class="jobdesciption" class="hidden">'],
  ['client trigger', '<div class="jobdesciption">', '<div class="jobdesciption" data-toggle="collapse">'],
  ['event program', '<div class="jobdesciption">', '<div class="jobdesciption" onclick="hideCriteria()">'],
  ['new input', '<div class="jobdesciption">', '<div class="jobdesciption"><input required name="new_mandatory_qualification">'],
  ['new textarea', '<div class="jobdesciption">', '<div class="jobdesciption"><textarea>Additional mandatory criteria</textarea>'],
  ['new link criteria', '<div class="jobdesciption">', '<div class="jobdesciption"><a href="/new-criteria">Read mandatory terms</a>'],
  ['new image criteria', '<div class="jobdesciption">', '<div class="jobdesciption"><img src="/mandatory-criteria.png">'],
  ['new video criteria', '<div class="jobdesciption">', '<div class="jobdesciption"><video src="/mandatory-criteria.mp4"></video>'],
  ['duplicate criteria', '<div class="jobdesciption">', '<div class="jobdesciption">Unreviewed</div><div class="jobdesciption">'],
  ['new stylesheet', '</head>', '<link rel="stylesheet" href="https://example.org/mandatory.css"></head>'],
  ['token case stylesheet', '</head>', '<link rel="alternate STYLESHEET" href="https://example.org/mandatory.css"></head>'],
  ['generated inline criteria', '</head>', '<style>.jobdesciption:after{content:"Mandatory qualification"}</style></head>'],
  ['new inline program', '</head>', '<script>document.querySelector(".jobdesciption").remove()</script></head>'],
  ['new external program', '</head>', '<script src="https://example.org/criteria.js"></script></head>'],
  ['new frame', '<div class="jobdesciption">', '<div class="jobdesciption"><iframe src="/mandatory-criteria"></iframe>'],
  ['new native publication date', '</head>', '<meta itemprop="datePosted" content="2026-11-14"></head>'],
  ['new native expiry', '</head>', '<meta itemprop="validThrough" content="2026-11-01"></head>'],
  ['new native time', '<div class="jobdesciption">', '<div class="jobdesciption"><time datetime="2026-11-14">Published today</time>'],
  ['alternate JSONLD', '</head>', '<script type="application/ld+json">{"@type":"JobPosting","description":"Different"}</script></head>'],
  ['changed employer title', ' at Drip Capital\n</title>', ' at Other Employer\n</title>'],
  ['explicit foreign native country', 'meta-job-location-country">India', 'meta-job-location-country">United States'],
  ['unknown native country', 'meta-job-location-country">India', 'meta-job-location-country">Unknown'],
  ['changed form identity', 'action="/jobs/fk0znmm"', 'action="/jobs/fk0zlaf"'],
  ['changed application question', 'Individual contributor?', 'new mandatory certification?'],
  ['explicit closed notice', '<div class="jobdesciption">', '<div class="jobdesciption">This position is closed. We are no longer accepting applications.'],
  ['explicit filled notice', '<div class="jobdesciption">', '<div class="jobdesciption">This role has been filled.'],
  ['explicit expired notice', '<div class="jobdesciption">', '<div class="jobdesciption">This vacancy is expired.'],
]
for (const [label, before, after] of roleMutations) test('Exact original native role rejects ' + label, async () => {
  await rejectsOriginalMutation(3, ({raw}) => changed(raw, before, after))
})

for (const [label, index, before, after] of [
  ['corporate account', 0, 'https://dripcapital.recruiterbox.com/#content', 'https://other.recruiterbox.com/#content'],
  ['corporate hidden declaration', 0, 'href="https://dripcapital.recruiterbox.com/#content"', 'hidden href="https://dripcapital.recruiterbox.com/#content"'],
  ['board country inferred from India office', 2, 'meta-job-location-country">United States', 'meta-job-location-country">India'],
  ['board empty is not verified zero', 2, 'View 5\n', 'View 0\n'],
  ['closing criteria change', 7, '<div class="jobdesciption">', '<div class="jobdesciption">Changed closing requirements'],
  ['closing publisher change', 11, 'https://dripcapital.recruiterbox.com/#content', 'https://other.recruiterbox.com/#content'],
  ['closing native inventory', 13, 'View 5\n', 'View 4\n'],
]) test('Original native response rejects ' + label, async () => rejectsOriginalMutation(index, ({raw}) => changed(raw, before, after)))

test('HTTP denial retains its physical status and cannot be reported as empty or successful inventory', async () => {
  const replay = mutateAt(3, ({receipt}) => responseFromOriginal(receipt, 'Forbidden', {status: 403}))
  await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl}), error => error.status === 403)
  assert.equal(replay.reads.length, 4)
})

for (const requestIndex of [1, 12]) for (const location of ['https://other.hire.trakstar.com/?', 'https://dripcapital.hire.trakstar.com/', 'https://dripcapital.hire.trakstar.com/?page=2']) {
  test('Exact original native301 rejects changed Location at read ' + requestIndex + ': ' + location, async () => {
    await rejectsOriginalMutation(requestIndex, ({receipt, raw}) => responseFromOriginal(receipt, raw, {headers: {...receipt.headers, location}}))
  })
}

for (const [label, transform] of [
  ['UTF8 BOM prefix', raw => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), raw])],
  ['invalid UTF8', raw => Buffer.concat([raw.subarray(0, 120), Buffer.from([0xc0, 0xaf]), raw.subarray(122)])],
  ['same-size raw program mutation', raw => raw.includes(Buffer.from('(window.NREUM')) ? changed(raw, '(window.NREUM', '(Window.NREUM') : changed(raw, '<script', '<scripT')],
  ['truncated entity', raw => raw.subarray(0, raw.length - 1)],
  ['extra entity suffix', raw => Buffer.concat([raw, Buffer.from(' ')])],
]) for (const requestIndex of [0, 2, 3]) test('Original raw byte admission rejects ' + label + ' at read ' + requestIndex, async () => {
  await rejectsOriginalMutation(requestIndex, ({raw}) => transform(raw))
})

const timingValue = (raw, replacement) => {
  const text = raw.toString(), match = text.match(/"applicationTime":\d+/)
  assert.ok(match)
  return Buffer.from(text.replace(match[0], '"applicationTime":' + replacement))
}
for (const invalid of ['-1', '01', '1.1', '1e3', '"222"', 'null', 'NaN', '9007199254740992', '99999999999999999', '1,"newKey":true', '1,"applicationTime":2', '(()=>2)()']) {
  test('Exact telemetry data slot rejects ' + invalid, async () => rejectsOriginalMutation(3, ({raw}) => timingValue(raw, invalid)))
}
for (const valid of ['0', '9007199254740991']) test('Exact raw slot permits only typed timing data without granting activation: ' + valid, async () => {
  const replay = replayNative({mutate: ({raw, receipt}) => receipt.status === 200 && receipt.index !== 0 && receipt.index !== 12 ? timingValue(raw, valid) : undefined})
  const jobs = await nativeRun({fetchImpl: replay.fetchImpl})
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => !job.sourceActivationComplete && !job.sourceApplicationQualificationComplete))
})

const csrfPattern = /(<input type="hidden" name="csrfmiddlewaretoken" value=")[A-Za-z0-9]{64}(?=">)/g
test('Exact public hidden-input data may rotate while every original surrounding byte remains bound', async () => {
  const replay = replayNative({mutate: ({raw}) => Buffer.from(raw.toString().replace(csrfPattern, '$1' + 'A'.repeat(64)))})
  const jobs = await nativeRun({fetchImpl: replay.fetchImpl})
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.sourceDescriptionHTML.includes('jobdesciption')))
})
for (const [label, transform] of [
  ['short public token', raw => Buffer.from(raw.toString().replace(csrfPattern, '$1' + 'A'.repeat(63)))],
  ['nonalphanumeric public token', raw => Buffer.from(raw.toString().replace(csrfPattern, '$1' + '<'.repeat(64)))],
  ['inconsistent same-page token relationship', raw => { let index = 0; return Buffer.from(raw.toString().replace(csrfPattern, (whole, prefix) => prefix + (index++ === 0 ? 'A' : 'B').repeat(64))) }],
  ['extra relocated hidden input', raw => changed(raw, '<div class="jobdesciption">', '<div class="jobdesciption"><input type="hidden" name="csrfmiddlewaretoken" value="' + 'A'.repeat(64) + '">')],
]) test('Exact original public hidden-input context rejects ' + label, async () => rejectsOriginalMutation(3, ({raw}) => transform(raw)))

for (const [label, change] of [
  ['auto-followed HTTP response', {redirected: true}],
  ['different native response URL', {url: 'https://other.hire.trakstar.com/jobs/fk0znmm/'}],
  ['missing native empty-query delimiter', {url: 'https://dripcapital.hire.trakstar.com/'}],
  ['wrong entity MIME', {headers: {'content-type': 'application/json'}}],
  ['wrong entity charset', {headers: {'content-type': 'text/html; charset=iso-8859-1'}}],
]) test('Full response boundary rejects ' + label, async () => rejectsOriginalMutation(3, ({receipt, raw}) => responseFromOriginal(receipt, raw, change)))

test('Body-only callback cannot impersonate an original HTTP response', async () => {
  let reads = 0
  await assert.rejects(nativeRun({fetchPage: async url => { reads++; return {url, status: 200, html: originalBody(0).toString()} }}), /complete original manual HTTP Response/)
  assert.equal(reads, 1)
})
for (const [key, value, maximumReads] of [['maxRequests', 13, 13], ['maxPages', 5, 13], ['maxDetails', 7, 3], ['maxEntityBytes', 10000, 1], ['maxAggregateBytes', 100000, 3]]) {
  test('Caller may reduce original budget ' + key, async () => {
    const replay = replayNative()
    await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl, [key]: value}), /cap|byte/i)
    assert.ok(replay.reads.length <= maximumReads)
  })
}
test('Caller cannot increase any original source/request/read/entity cap', async () => {
  const replay = replayNative(), raised = Object.fromEntries(Object.keys(DRIP_NATIVE_LIMITS).map(key => [key, 100000000]))
  const jobs = await nativeRun({fetchImpl: replay.fetchImpl, ...raised})
  assert.deepEqual(jobs.nativeCollectionEvidence.limits, DRIP_NATIVE_LIMITS)
  assert.equal(replay.reads.length, 14)
})
for (const [key, value] of [['maxRequests', 0], ['maxPages', -1], ['maxDetails', 1.5], ['sourceTimeoutMs', NaN], ['requestTimeoutMs', Infinity], ['maxEntityBytes', '4000000'], ['maxAggregateBytes', 0]]) {
  test('Invalid caller budget is rejected before acquisition: ' + key, async () => {
    const replay = replayNative()
    await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl, [key]: value}), /Invalid acquisition budget/)
    assert.equal(replay.reads.length, 0)
  })
}
for (const key of ['sourceTimeoutMs', 'requestTimeoutMs']) test('Reduced ' + key + ' bounds a transport which has not returned', async () => {
  const replay = replayNative({beforeRead: async ({requestIndex}) => { if (requestIndex === 0) await new Promise(resolve => setTimeout(resolve, 30)) }})
  await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl, [key]: 5}), error => error.name === 'TimeoutError')
  assert.equal(replay.reads.length, 1)
})
test('Original bounded entity stream is cancelled before an oversized chunk can be parsed', async () => {
  let cancelled = false
  const replay = mutateAt(0, ({raw, receipt}) => responseFromOriginal(receipt, new ReadableStream({start(controller) { controller.enqueue(raw) }, cancel() { cancelled = true }})))
  await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl, maxEntityBytes: 10000}), /byte cap/)
  assert.equal(cancelled, true)
})
test('Opaque caller cancellation before acquisition is preserved by identity', async () => {
  const controller = new AbortController(), reason = Object.freeze({cancel: 'before acquisition'})
  controller.abort(reason)
  await assert.rejects(nativeRun({signal: controller.signal, fetchImpl: () => assert.fail('must not acquire')}), error => error === reason)
})
for (const requestIndex of [0, 3, 7, 11, 12, 13]) test('Opaque caller cancellation at original read ' + requestIndex + ' is preserved by identity', async () => {
  const controller = new AbortController(), reason = Object.freeze({cancel: 'read ' + requestIndex})
  const replay = replayNative({beforeRead: ({requestIndex: index}) => { if (index === requestIndex) controller.abort(reason) }})
  await assert.rejects(nativeRun({signal: controller.signal, fetchImpl: replay.fetchImpl}), error => error === reason)
  assert.equal(replay.reads.length, requestIndex + 1)
})
test('A transport that aborts and rejects together preserves opaque cancellation without orphaned rejections', async () => {
  const controller = new AbortController(), reason = Object.freeze({cancel: 'transport abort and reject'})
  await assert.rejects(nativeRun({signal: controller.signal, fetchImpl: async () => { controller.abort(reason); throw reason }}), error => error === reason)
  await new Promise(resolve => setTimeout(resolve, 10))
})

test('Opaque caller cancellation during the original entity stream cancels the reader and preserves identity', async () => {
  const controller = new AbortController(), reason = Object.freeze({cancel: 'original entity stream'})
  let cancelled = false
  const replay = mutateAt(0, ({raw, receipt}) => responseFromOriginal(receipt, new ReadableStream({
    start(stream) { stream.enqueue(raw.subarray(0, 10)) },
    pull(stream) { controller.abort(reason); stream.enqueue(raw.subarray(10)) },
    cancel() { cancelled = true },
  })))
  await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl, signal: controller.signal}), error => error === reason)
  assert.equal(cancelled, true)
  assert.equal(replay.reads.length, 1)
})
test('An empty successful native body is unknown inventory, never verified empty', async () => {
  const replay = mutateAt(2, ({receipt}) => responseFromOriginal(receipt, Buffer.alloc(0)))
  await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl}), error => error.failureKind === 'coverage_gap' && error.lifecycleCleanupAllowed === false)
  assert.equal(replay.reads.length, 3)
})
test('Oversized declared original entity is rejected before body parsing', async () => {
  const replay = mutateAt(0, ({receipt, raw}) => responseFromOriginal(receipt, raw, {headers: {...receipt.headers, 'content-length': '4000001'}}))
  await assert.rejects(nativeRun({fetchImpl: replay.fetchImpl}), /exceeds byte cap/)
  assert.equal(replay.reads.length, 1)
})
test('A native DNS error preserves its original identity and transport cause', async () => {
  const error = Object.assign(new Error('fetch failed'), {cause: {code: 'ENOTFOUND'}})
  await assert.rejects(nativeRun({fetchImpl: async () => { throw error }}), current => current === error && current.cause.code === 'ENOTFOUND')
})
