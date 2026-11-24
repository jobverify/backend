import fs from 'node:fs'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import test, { after } from 'node:test'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'

// Seven unchanged actual-original mutators/oracles from the independent review.
// These controlled variants are parser regressions, never current vacancy proof.
const C = 'reports/scraper-20261118-soft-failures/continuation-20261119'
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const fixtureFile = 'scraper/edutinker/fixtures/native-parser-originals-20261119.json.gz'
const fixture = jsonFromGzip(fixtureFile)
function jsonFromGzip(file) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(file))) }
const originals = fixture.responses.map((row, index) => {
  const body = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(body.length, row.bytes)
  assert.equal(hash(body), row.sha256)
  assert.equal(row.status, 200)
  assert.equal(row.method, 'GET')
  const retained = `${C}/backlog/captures/edutinker/edutinker-${index}.body.gz`
  assert.deepEqual(zlib.gunzipSync(fs.readFileSync(retained)), body)
  return { index, url: row.requestedUrl, bytes: body.length, sha256: hash(body), html: body.toString('utf8') }
})
assert.equal(originals.length, 3)
assert.equal(originals.reduce((sum, row) => sum + row.bytes, 0), 1067103)
const types = (value, type) => (Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']]).includes(type)
const walk = (value, type, out = []) => {
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) { for (const item of value) walk(item, type, out); return out }
  if (types(value, type)) out.push(value)
  for (const [key, child] of Object.entries(value)) if (key !== '@context' && child && typeof child === 'object') walk(child, type, out)
  return out
}
const compact = job => job ? Object.fromEntries([
  'title', 'sourceUrl', 'nativeEmployer', 'country', 'city', 'location', 'postingDate',
  'sourceEmployerConflict', 'sourceIdentityConflict', 'sourceCountryConflict',
  'sourceCountryScopeUnresolved', 'sourceScopeComplete', 'sourceDetailComplete',
].filter(key => Object.hasOwn(job, key)).map(key => [key, job[key]])) : null
const mutate = change => {
  let html = originals[1].html
  const d = readNativeDocument(html)
  const scripts = d.nodes(node => node.tag === 'script' && !node.attrs.src && (node.attrs.type || '').toLowerCase() === 'application/ld+json')
  const packet = scripts.map(node => ({ node, model: readLiteralModel(node.raw || '').value }))
  const posting = packet.flatMap(row => walk(row.model, 'JobPosting'))
  const webPages = packet.flatMap(row => walk(row.model, 'WebPage'))
  assert.equal(posting.length, 1)
  const webPage = webPages.find(row => row.url === originals[1].url)
  assert(webPage)
  // Only controlled JSON-LD fields change. Actual own title, full criteria,
  // application form, all other programmes and the second role remain original.
  posting[0].hiringOrganization.name = 'Edutinker'
  change(posting[0], webPage)
  const edits = []
  for (const { node, model } of packet) {
    const replacement = JSON.stringify(model)
    assert.equal(html.split(node.raw).length, 2)
    html = html.replace(node.raw, replacement)
    edits.push({ beforeSHA256: hash(node.raw), afterSHA256: hash(replacement) })
  }
  return {
    html,
    provenance: { originalIndex: 1, originalBodySHA256: originals[1].sha256, controlledBodySHA256: hash(html), jsonLDProgrammeEdits: edits },
  }
}
const place = country => ({ '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: country } })
const cases = [
  {
    label: 'coherent one-role issuer preserves its partial while the actual other Test issuer is held',
    change() {},
    assert({ jobs, row }) {
      assert.equal(jobs.length, 1)
      assert.equal(row.title, 'Python Developer (3-6 years experience)')
      assert.equal(row.country, null)
      assert.equal(row.sourceCountryScopeUnresolved, true)
      assert.equal(jobs.nativeCollectionEvidence.heldRoles.length, 1)
      assert.equal(jobs.nativeCollectionEvidence.heldRoles[0].job.nativeEmployer, 'Test')
      assert.equal(row.sourceScopeComplete, false)
    },
  },
  {
    label: 'single explicit native India address supplies a country only for an unqualified partial',
    change(posting) { posting.jobLocation = place('India') },
    assert({ row }) { assert.equal(row.country, 'India'); assert.equal(row.sourceCountryScopeUnresolved, false); assert.equal(row.sourceScopeComplete, false) },
  },
  {
    label: 'unknown second native workplace cannot disappear from India country uncertainty',
    change(posting) { posting.jobLocation = [place('India'), place('Unspecified')] },
    acceptsContractHold: true,
    assert({ row }) {
      assert(row.country === null || row.sourceCountryScopeUnresolved === true || row.sourceCountryConflict === true,
        'Known India plus unknown explicit native workplace was emitted with country India and country scope resolved')
    },
  },
  {
    label: 'unknown-only native country stays unknown without invented country',
    change(posting) { posting.jobLocation = place('Unspecified') },
    acceptsContractHold: true,
    assert({ row }) { assert.equal(row.country, null); assert.equal(row.sourceCountryScopeUnresolved, true) },
  },
  {
    label: 'two contradictory explicit native countries remain a held conflict',
    change(posting) { posting.jobLocation = [place('India'), place('Canada')] },
    acceptsContractHold: true,
    assert({ row, jobs, error }) {
      assert.equal(row.country, null)
      assert.equal(row.sourceCountryConflict, true)
      assert.ok(error || !jobs.some(job => job.sourceUrl === originals[1].url))
    },
  },
  {
    label: 'contradictory same-role WebPage aliases cannot source an earlier foreign-document posting date',
    change(_posting, webPage) { webPage.url = 'https://other-employer.example/foreign-document/'; webPage.datePublished = '2020-01-01T00:00:00+00:00' },
    acceptsContractHold: true,
    assert({ row }) {
      assert(row.sourceIdentityConflict === true || row.postingDate === '2022-02-28T01:43:30.000Z',
        'Foreign WebPage.url with retained same-role @id supplied 2020 age without an identity conflict')
    },
  },
  {
    label: 'coherent unrelated WebPage date does not affect selected original role age',
    change(_posting, webPage) { webPage.url = 'https://other-employer.example/foreign-document/'; webPage['@id'] = webPage.url; webPage.datePublished = '2020-01-01T00:00:00+00:00' },
    assert({ row }) { assert.equal(row.sourceIdentityConflict, false); assert.equal(row.postingDate, '2022-02-28T01:43:30.000Z') },
  },
]
let networkCalls = 0
const blocked = () => { networkCalls++; throw new Error('Independent review network fence: no live transport permitted') }
const saved = { fetch: globalThis.fetch, httpRequest: http.request, httpGet: http.get, httpsRequest: https.request, httpsGet: https.get }
globalThis.fetch = blocked
http.request = http.get = https.request = https.get = blocked

const { createEdutinkerScraper } = await import('./script.js')
const results = []
after(() => {
  globalThis.fetch = saved.fetch
  http.request = saved.httpRequest; http.get = saved.httpGet
  https.request = saved.httpsRequest; https.get = saved.httpsGet
  assert.equal(networkCalls, 0)
})
for (const control of cases) {
  test(control.label, { concurrency: false }, async () => {
    const controlled = mutate(control.change)
    const calls = []
    let jobs, error, row
    try {
      jobs = await createEdutinkerScraper().run({ fetchText: async url => {
        calls.push(url)
        const original = originals.find(item => item.url === url)
        assert(original, `Unretained URL requested by control: ${url}`)
        return original.index === 1 ? controlled.html : original.html
      } })
      row = jobs.find(item => item.sourceUrl === originals[1].url)
    } catch (caught) {
      error = caught
      row = caught.nativeCollectionEvidence?.observedRoles?.find(item => item.sourceUrl === originals[1].url)
    }
    let verdict = 'pass', failure = null
    try {
      if (!row && control.acceptsContractHold && error?.abortRetries === true && /^Edutinker role:/.test(error.message)) {
        // A deliberate parser refusal is a valid outcome for contradictory or
        // unknown supplied facts. Arbitrary import/assertion/harness failures are not.
      } else {
        assert(row, `Selected role observation missing: ${error?.message ?? 'no source error'}`)
        control.assert({ row, jobs, error })
      }
    } catch (caught) {
      failure = { name: caught.name, message: caught.message }
      verdict = caught.name === 'AssertionError' ? 'finding' : 'harness-error'
    }
    if (error && !error.nativeCollectionEvidence && !(control.acceptsContractHold && error.abortRetries === true && /^Edutinker role:/.test(error.message))) {
      verdict = 'harness-error'; failure = { name: error.name, message: error.message }
    }
    assert.deepEqual(calls, originals.map(item => item.url))
    results.push({ label: control.label, verdict, failure, row: compact(row), error: error ? { name: error.name, message: error.message } : null, provenance: controlled.provenance, calls })
    assert.equal(verdict, 'pass', failure?.message ?? 'Independent source control failed')
  })
}
