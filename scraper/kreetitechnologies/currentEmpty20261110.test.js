import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { run } from './script.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = new URL('./test-data-20261110/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', directory)))
const originals = new Map(manifest.records.map((item) => {
  const packet = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(item.file, directory))))
  const bytes = Buffer.from(packet.bodyBase64, 'base64')
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256)
  assert.equal(bytes.length, item.byteLength)
  return [item.id, { ...packet, bytes, html: bytes.toString('utf8') }]
}))
const now = () => '2026-11-10T09:50:18.000Z'

const replay = async (edit = (packet) => packet, options = {}) => {
  const counts = new Map(), requests = []
  const pageFor = (url) => {
    const name = manifest.records.find((record) => record.requestUrl === url)?.id.split('-').slice(1).join('-')
    assert.ok(name, 'No undeclared URL may be fetched: ' + url)
    const closing = (counts.get(url) || 0) > 0
    counts.set(url, (counts.get(url) || 0) + 1)
    const id = (closing ? 'closing-' : 'opening-') + name
    const original = originals.get(id)
    const packet = edit({ ...original }, id)
    requests.push({ url, id })
    return packet
  }
  const jobs = await run({ ...options, now,
    // The old registered reader consumes these same current originals and
    // returns a bare[]; the current transport consumes full typed responses.
    fetchText: async (url) => pageFor(url).html,
    fetchImpl: async (url, init) => {
      assert.equal(init.method, 'GET')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.redirect, 'error')
      const packet = pageFor(url)
      const bytes = packet.html === originals.get(requests.at(-1).id)?.html ? packet.bytes : Buffer.from(packet.html)
      const response = new Response(bytes, { status: packet.status, headers: { 'content-type': packet.headers['content-type'] } })
      Object.defineProperty(response, 'url', { value: packet.finalUrl })
      return response
    },
  })
  return { jobs, requests }
}

test('registered Kreeti retains explicit complete global-empty proof from current public Jobs and intake-only Students', async () => {
  const { jobs, requests } = await replay()
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(isVerifiedEmptyEvidence(evidence), true)
  assert.equal(evidence.reportedTotal, 0)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.surface, 'https://careers.kreeti.com/candidates')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(requests.length, 12)
  assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal, 0)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, 0)
  assert.equal(jobs.nativeCollectionEvidence.opening.jobs.emptyText, 'No Open Positions')
  assert.equal(jobs.nativeCollectionEvidence.opening.students.intakeUrl, 'https://careers.kreeti.com/candidates')
  assert.equal(jobs.nativeCollectionEvidence.currentContextRechecked, true)
})

for (const [label, replacement] of [
  ['hidden', '<h3 hidden class="section-title">No Open Positions</h3>'],
  ['inert', '<h3 inert class="section-title">No Open Positions</h3>'],
  ['template', '<template><h3 class="section-title">No Open Positions</h3></template>'],
  ['intake-only', '<h3 class="section-title">We welcome your interest</h3>'],
]) test('Kreeti rejects ' + label + ' empty text rather than manufacturing zero', async () => {
  await assert.rejects(replay((packet, id) => id === 'opening-jobs' ? { ...packet,
    html: packet.html.replace('<h3 class="section-title">No Open Positions</h3>', replacement),
  } : packet), /empty|openings|positions/i)
})

test('Kreeti rejects contradictory current vacancy links and pagination before verifying zero', async () => {
  for (const markup of ['<a href="/jobs/999">Current Engineer</a>', '<a rel="next" href="/candidates?page=2">Next</a>', '<form method="get"><select name="country"><option>India</option></select></form>']) {
    await assert.rejects(replay((packet, id) => id === 'opening-jobs' ? { ...packet,
      html: packet.html.replace('<section class="jobs">', '<section class="jobs">' + markup),
    } : packet), /vacancy|pagination|filter|scope/i)
  }
})

test('Kreeti rejects another current student vacancy or alternate internship application board', async () => {
  for (const markup of ['<a href="/jobs/999">Engineering Intern</a>', '<a href="https://unbound.example/jobs">Apply for Internship</a>']) {
    await assert.rejects(replay((packet, id) => id === 'opening-students' ? { ...packet,
      html: packet.html.replace('<section class="join-team text-center">', '<section class="join-team text-center">' + markup),
    } : packet), /student|vacancy|handoff|scope/i)
  }
})

test('Kreeti rejects a changed native company identity or hidden Jobs handoff', async () => {
  for (const [id, edit] of [
    ['opening-company', (html) => html.replace('<title>Kreeti Technologies Pvt. Ltd.</title>', '<title>Other Employer</title>')],
    ['opening-home', (html) => html.replace(/<a\b(?=[^>]*href="\/candidates")[^>]*>/g, (tag) => tag.replace('<a', '<a hidden'))],
  ]) await assert.rejects(replay((packet, name) => name === id ? { ...packet, html: edit(packet.html) } : packet), /publisher|identity|handoff/i)
})

test('Kreeti rejects any unreviewed base, frame or active native renderer', async () => {
  for (const markup of ['<base href="https://unbound.example/">', '<iframe src="https://unbound.example/jobs"></iframe>', '<script src="/new-jobs.js"></script>']) {
    await assert.rejects(replay((packet, id) => id === 'opening-jobs' ? { ...packet,
      html: packet.html.replace('</head>', markup + '</head>'),
    } : packet), /base|frame|renderer|program/i)
  }
})

test('Kreeti rejects changes to closing Jobs, Students, publisher or renderer context', async () => {
  for (const [changed, mutate] of [
    ['closing-jobs', (html) => html.replace('No Open Positions', 'Positions available')],
    ['closing-students', (html) => html.replace('Apply for Internship', 'View Internship Vacancies')],
    ['closing-home', (html) => html.replace('href="/candidates"', 'href="/other-jobs"')],
    ['closing-company', (html) => html.replace('<title>Kreeti Technologies Pvt. Ltd.</title>', '<title>Other Employer</title>')],
    ['closing-renderer', (html) => html + '\nfetch("/new-jobs")'],
  ]) await assert.rejects(replay((packet, id) => id === changed ? { ...packet, html: mutate(packet.html) } : packet), /closing|empty|publisher|handoff|program|renderer/i)
})

test('Kreeti rejects an additional visible vacancy in both opening and closing Jobs, Home or Students', async () => {
  const vacancy = '<section class="current-vacancies"><h2>Open Position: Software Engineer</h2><p>We are hiring now. Apply using the form below.</p></section>'
  for (const surface of ['jobs', 'home', 'students']) {
    await assert.rejects(replay((packet, id) => id.endsWith('-' + surface) ? { ...packet,
      html: surface === 'jobs' ? packet.html.replace('<section class="jobs">', vacancy + '<section class="jobs">')
        : packet.html.replace(/<body\b[^>]*>/, (tag) => tag + vacancy),
    } : packet), /unreviewed|visible|context/i)
  }
})

test('Kreeti rejects active srcdoc frames and embedded documents in both opening and closing Jobs', async () => {
  for (const markup of [
    '<iframe srcdoc="&lt;h2&gt;Open Position: Software Engineer&lt;/h2&gt;"></iframe>',
    '<object data="https://unbound.example/jobs"></object>',
    '<embed src="https://unbound.example/jobs">',
    '<portal src="https://unbound.example/jobs"></portal>',
  ]) await assert.rejects(replay((packet, id) => id.endsWith('-jobs') ? { ...packet,
    html: packet.html.replace('<section class="jobs">', markup + '<section class="jobs">'),
  } : packet), /frame|embedded|object/i)
})

test('Kreeti rejects new inline handlers or hidden job state on reviewed controls in both phases', async () => {
  for (const surface of ['jobs', 'home', 'students']) for (const attributes of ['onclick="fetch(\'/jobs/current\')"', 'data-jobs="/jobs/current"', 'style="opacity:0"']) {
    await assert.rejects(replay((packet, id) => id.endsWith('-' + surface) ? { ...packet,
      html: packet.html.replace('<button', '<button ' + attributes),
    } : packet), /unreviewed|structure|context/i)
  }
})

test('Kreeti normalizes only the verified Rails CSRF meta value, preserving all other hidden metadata', async () => {
  const result = await replay((packet, id) => /-(?:jobs|home|students)$/.test(id) ? { ...packet,
    html: packet.html.replace(/(<meta name="csrf-token" content=")[^"]+("\s*\/?>)/, '$1' + 'B'.repeat(86) + '$2'),
  } : packet)
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(result.jobs)), true)
  for (const replacement of ['<meta name="csrf-token" data-jobs="/jobs/current" content="', '<meta name="jobs-state" content="']) {
    await assert.rejects(replay((packet, id) => id.endsWith('-jobs') ? { ...packet,
      html: packet.html.replace('<meta name="csrf-token" content="', replacement),
    } : packet), /unreviewed|structure|context/i)
  }
})

test('Kreeti rejects a changed native stylesheet declaration, CSS body or CSS response type', async () => {
  for (const [changed, update] of [
    ['opening-jobs', (packet) => ({ ...packet, html: packet.html.replace('</head>', '<link rel="stylesheet" href="/hidden-jobs.css"></head>') })],
    ['opening-style', (packet) => ({ ...packet, html: packet.html + '\n.jobs{display:none}' })],
    ['closing-style', (packet) => ({ ...packet, html: packet.html + '\n.jobs{display:none}' })],
    ['closing-style', (packet) => ({ ...packet, headers: { 'content-type': 'text/html; note=text/css' } })],
  ]) await assert.rejects(replay((packet, id) => id === changed ? update(packet) : packet), /CSS|stylesheet|MIME|program/i)
})

test('Kreeti rejects closing HTTP failure, authority change and mismatched base MIME', async () => {
  for (const patch of [
    { status: 403 },
    { finalUrl: 'https://unbound.example/candidates' },
    { headers: { 'content-type': 'application/json; note=text/html' } },
  ]) await assert.rejects(replay((packet, id) => id === 'closing-jobs' ? { ...packet, ...patch } : packet), /HTTP|response|MIME|authority/i)
})

test('Kreeti preserves opaque pre-abort reasons without making any request', async () => {
  const controller = new AbortController(), reason = { caller: 'stop' }
  controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal, fetchImpl: () => assert.fail('No request after caller abort') }), (error) => error === reason)
})

test('Kreeti cancels actual unread response bodies for rejected status, MIME or declared length', async () => {
  for (const patch of [
    { status: 403 },
    { headers: { 'content-type': 'application/json; note=text/html' } },
    { headers: { 'content-type': 'text/html', 'content-length': '1500001' } },
  ]) {
    const cancellations = []
    const body = new ReadableStream({ cancel: (reason) => { cancellations.push(reason) } })
    const response = new Response(body, { status: 200, headers: { 'content-type': 'text/html' }, ...patch })
    Object.defineProperty(response, 'url', { value: 'https://www.kreeti.com/' })
    let rejection
    await assert.rejects(run({ fetchImpl: async () => response }), (error) => {
      rejection = error
      return /HTTP|MIME|bounds/.test(error.message)
    })
    assert.deepEqual(cancellations, [rejection])
  }
})

test('Kreeti disposes an actual late response after a signal-ignoring fetch without changing caller reason', async () => {
  const controller = new AbortController(), reason = Object.freeze({ caller: 'during-headers' })
  const cancellations = []
  const response = new Response(new ReadableStream({ cancel: (value) => { cancellations.push(value) } }))
  Object.defineProperty(response, 'url', { value: 'https://www.kreeti.com/' })
  let resolveResponse
  const pending = new Promise((resolve) => { resolveResponse = resolve })
  const running = run({ signal: controller.signal, fetchImpl: () => pending })
  controller.abort(reason)
  await assert.rejects(running, (error) => error === reason)
  resolveResponse(response)
  await new Promise(setImmediate)
  assert.deepEqual(cancellations, [reason])
  assert.deepEqual(reason, { caller: 'during-headers' })
})

test('Kreeti cancels a stalled actual body reader once and preserves opaque caller cancellation', async () => {
  const controller = new AbortController(), reason = Object.freeze({ caller: 'during-body' })
  const cancellations = []
  const response = new Response(new ReadableStream({ cancel: (value) => { cancellations.push(value) } }), {
    headers: { 'content-type': 'text/html' },
  })
  Object.defineProperty(response, 'url', { value: 'https://www.kreeti.com/' })
  const running = run({ signal: controller.signal, fetchImpl: async () => response })
  await new Promise(setImmediate)
  assert.equal(response.body.locked, true)
  controller.abort(reason)
  await assert.rejects(running, (error) => error === reason)
  assert.deepEqual(cancellations, [reason])
  assert.deepEqual(reason, { caller: 'during-body' })
})
