import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readCurrentCorporate, readCurrentIndex, readCurrentRole, runCurrentPublished } from './currentPublished20261120.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publication-20261120.json.gz', import.meta.url))))
const at = fixture.completedAt, ID = '25001', body = record => Buffer.from(record.bodyBase64, 'base64').toString('utf8')
const corporate = body(fixture.responses.find(record => record.phase === 'opening-corporate'))
const index = fixture.responses.find(record => record.phase.startsWith('opening-native-page-'))
const row = readCurrentIndex(body(index), index.requestedUrl, at).rows.find(record => record.nativePublicJobId === ID)
const role = body(fixture.responses.find(record => record.phase === 'opening-role-' + ID))
const cls = (node, name) => (node.attrs.class ?? '').split(/\s+/).includes(name)
const edit = (html, predicate, attribute) => {
  const d = document(html), nodes = d.nodes(node => predicate(node, d))
  assert.ok(nodes.length, 'Actual current carrier must exist')
  const node = nodes[0], original = d.outer(node)
  const changed = original.slice(0, node.openEnd - node.start - 1) + ' ' + attribute + '>' + original.slice(node.openEnd - node.start)
  assert.notEqual(changed, original)
  return html.slice(0, node.start) + changed + html.slice(node.end)
}
const addition = html => { assert.equal(role.split('</main>').length, 2); return role.replace('</main>', html + '</main>') }
const place = (country = 'India', city = 'Hyderabad') => ({ '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: country, addressLocality: city } })
const schema = extra => addition('<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'JobPosting', title: row.title, url: row.url, hiringOrganization: { '@type': 'Organization', name: 'Macquarie Group' }, jobLocation: place(), ...extra }) + '</script>')
const parse = html => readCurrentRole(html, row, at)

test('independent finding: actual corporate h1 publication must remain available', () => {
  assert.throws(() => readCurrentCorporate(edit(corporate, node => node.tag === 'h1', 'data-is-published="false"'), at))
})

for (const [label, predicate] of [['role title', node => node.tag === 'h2' && cls(node, 'title--11')], ['actual Apply', (node, d) => node.tag === 'a' && d.text(node) === 'Apply now']]) {
  for (const [key, value] of [['data-application-link', 'https://other.invalid/apply'], ['data-job-url', 'https://other.invalid/role']]) {
    test('independent finding: ' + label + ' ' + key + ' constrains same-role binding', () => {
      assert.throws(() => parse(edit(role, predicate, key + '="' + value + '"')))
    })
    test('coherent ' + label + ' ' + key + ' retains current role and criteria', () => {
      const expected = key === 'data-job-url' ? row.url : row.applyUrl
      const result = parse(edit(role, predicate, key + '="' + expected + '"'))
      assert.equal(result.nativePublicJobId, ID)
      assert.match(result.jobDescription, /Python and SQL/)
    })
  }
}

test('independent finding: semantic Apply Link cannot contradict the actual same-role Apply', () => {
  assert.throws(() => parse(addition('<section><span>Apply Link</span><span>https://other.invalid/apply</span></section>')))
})
test('coherent semantic Apply Link remains accepted and retained', () => {
  const result = parse(addition('<section><span>Apply Link</span><span>' + row.applyUrl + '</span></section>'))
  assert.ok(result.originalSemanticRoleProperties.some(property => property.key === 'Apply Link' && property.value === row.applyUrl))
})

for (const type of ['WebPage', 'JobPosting']) test('independent finding: ' + type + ' workLocation cannot be discarded beside jobLocation', () => {
  assert.throws(() => parse(schema({ '@type': type, workLocation: place('Canada', 'Toronto') })))
})
for (const field of ['workLocations', 'jobLocations']) test('independent finding: plural ' + field + ' without India constrains the current role', () => {
  assert.throws(() => parse(schema({ [field]: [place('Canada', 'Toronto')] })))
})
for (const field of ['jobLocation', 'workLocation', 'jobLocations', 'workLocations']) test('coherent India and foreign alternatives remain accepted in ' + field, () => {
  const result = parse(schema({ [field]: [place(), place('Canada', 'Toronto')] }))
  assert.equal(result.nativePublicJobId, ID)
  assert.match(JSON.stringify(result.originalStructuredModels), /Toronto/)
})
test('independent finding: HTTP schema WebPage country has the same meaning', () => {
  assert.throws(() => parse(schema({ '@type': 'http://schema.org/WebPage', country: 'Canada' })))
})
test('coherent HTTP schema WebPage India remains qualified', () => {
  assert.equal(parse(schema({ '@type': 'http://schema.org/WebPage', country: 'India' })).nativePublicJobId, ID)
})
test('independent finding: typed PostalAddress application alias constrains its same-role model', () => {
  const value = place(); value.address.applicationUrl = 'https://other.invalid/apply'
  assert.throws(() => parse(schema({ jobLocation: value })))
})
test('coherent typed PostalAddress application alias retains the original model', () => {
  const value = place(); value.address.applicationUrl = row.applyUrl
  const result = parse(schema({ jobLocation: value }))
  assert.match(JSON.stringify(result.originalStructuredModels), /applicationUrl/)
})

const replay = async options => {
  let reads = 0
  const jobs = await runCurrentPublished({ now: at, requestIntervalMs: 0, ...options, fetchImpl: async (url, request) => {
    const original = fixture.responses[reads++]
    assert.ok(original, 'No unbound native request')
    assert.equal(url, original.requestedUrl)
    assert.equal(request.method, original.method)
    assert.equal(request.body, original.originalRequestBody)
    assert.equal(request.redirect, 'manual')
    assert.equal(request.credentials, 'omit')
    assert.equal(url.includes('ApplicationMethods'), false)
    return Object.defineProperty(new Response(Buffer.from(original.bodyBase64, 'base64'), { status: original.status, headers: original.headers }), 'url', { value: url })
  } })
  assert.equal(reads, 174)
  return jobs
}
test('independent finding: cancellation queued in supported final audit preserves opaque reason', async () => {
  const controller = new AbortController(), reason = Object.freeze({ kind: 'cancelled-by-final-audit-microtask' })
  await assert.rejects(replay({ signal: controller.signal, onAudit: () => queueMicrotask(() => controller.abort(reason)) }), error => error === reason)
})
test('supported asynchronous audit completes with cloned facts before successful return', async () => {
  let completed = false
  const jobs = await replay({ onAudit: async audit => { await Promise.resolve(); audit.companyIndiaTotal = 0; completed = true } })
  assert.equal(completed, true)
  assert.equal(jobs.length, 75)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, null)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.sourceLegalEmployer === null && job.requisitionId === null && !job.lifecycleCleanupAllowed))
})
