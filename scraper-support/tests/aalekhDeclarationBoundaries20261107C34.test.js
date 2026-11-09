import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as aalekh from '../../scraper/aalekh/script.js'
import {getScraperCatalog, createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence, isVerifiedEmptyEvidence} from '../utils/inventoryEvidence.js'

const HOME = 'https://aalekh.co/', CONTACT = 'https://aalekh.co/contactUs'
const now = () => '2026-11-07T01:00:00.000Z'
const home = content => '<html><head><title>Aalekh Designs, Rajkot | Packaging Designer in Rajkot</title></head><body>' + content + '</body></html>'
const contact = '<html><head><title>Aalekh Designs Rajkot</title></head><body>Corporate contact.</body></html>'
// Altered pages are synthetic boundary controls, never public observations.
const page = (html, url) => ({url, requestedUrl: url, status: 200,
  headers: {'content-type': 'text/html; charset=utf-8'}, bodyBase64: Buffer.from(html).toString('base64'),
  sourceRequestedAt: '2026-11-07T00:00:00.000Z', sourceCompletedAt: '2026-11-07T00:00:00.001Z',
  syntheticBoundaryEntity: true})
const observe = async (content, options = {}) => {
  const requests = [], html = home(content)
  const jobs = await aalekh.run({now, ...options, fetchPage: async (url, init) => {
    requests.push(url)
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    assert.ok([HOME, CONTACT].includes(url), 'No undeclared third document')
    return page(url === HOME ? html : contact, url)
  }})
  return {requests, html, jobs, audit: gap(jobs)}
}
const gap = jobs => {
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs), audit = jobs.nativeCollectionEvidence
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, null)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.equal(audit.sourceScopeComplete, false)
  for (const key of ['nativeReportedTotal', 'nativeIndiaTotal', 'companyGlobalTotal', 'companyIndiaTotal', 'inventoryVerifiedAt']) assert.equal(audit[key], null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.corporateJavaScriptExecuted, false)
  assert.equal(audit.subresourcesRequested, false)
  return audit
}
const retainedContext = (result, reason) => {
  assert.deepEqual(result.requests, [HOME])
  assert.deepEqual(result.audit.declarations, [])
  assert.deepEqual(result.audit.observations, [])
  const response = result.audit.responses[0], original = Buffer.from(result.html)
  assert.equal(response.status, 200)
  assert.equal(response.bodyBase64, original.toString('base64'))
  assert.equal(response.bytes, original.length)
  assert.equal(response.sha256, createHash('sha256').update(original).digest('hex'))
  assert.equal(response.sourceRequestedAt, '2026-11-07T00:00:00.000Z')
  assert.equal(response.sourceCompletedAt, '2026-11-07T00:00:00.001Z')
  assert.equal(result.audit.rawPages[0].bodyBase64, original.toString('base64'))
  assert.deepEqual(result.audit.declarationQualification.map(row => ({documentUrl: row.documentUrl, qualified: row.qualified, reasons: row.reasons})),
    [{documentUrl: HOME, qualified: false, reasons: [reason]}])
  assert.ok(result.audit.issues.some(issue => issue.kind === 'unqualified-declaration-context'
    && issue.documentUrl === HOME && issue.reason === reason && issue.contextRetained === true && issue.declarationAuthority === false))
}

// Removing the source-local qualification must expose two real extra reads.
test('C34 regression recursive entity must not invent Aalekh contact authority', async () => {
  assert.equal(aalekh.CONTACT_URL, CONTACT)
  const result = await observe('<a href="/contact&#x26;#85;s">Contact</a>')
  // One reference consumes &#x26; only; its replacement is not another token.
  assert.equal(new URL('/contact&#85;s', HOME).href, 'https://aalekh.co/contact&#85;s')
  assert.notEqual('https://aalekh.co/contact&#85;s', CONTACT)
  console.log(JSON.stringify({control: 'aalekh-one-pass-entity', expectedLiteralUrl: 'https://aalekh.co/contact&#85;s',
    observedRequests: result.requests, observedContactDeclarations: result.audit.declarations.filter(row => row.url === CONTACT)}))
  assert.deepEqual(result.requests, [HOME])
  retainedContext(result, 'ambiguous-character-reference-spelling')
})

test('C34 regression self-closing MathML must not invent Aalekh contact authority', async () => {
  const result = await observe('<math><mtext/><a href="/contactUs">Contact</a></math>')
  console.log(JSON.stringify({control: 'aalekh-self-closing-mathml', observedRequests: result.requests,
    observedContactDeclarations: result.audit.declarations.filter(row => row.url === CONTACT)}))
  assert.deepEqual(result.requests, [HOME])
  retainedContext(result, 'unsupported-self-closing-MathML-integration-spelling')
})

for (const [label, content] of [
  ['uppercase hexadecimal ampersand and leading zeros', '<a href="/contact&#X0026;#00085;s">Contact</a>'],
  ['nested named ampersand in a quoted query', '<a href="/careers?view=jobs&#038;amp;team=design">Jobs</a><a href="/contactUs">Contact</a>'],
  ['partly encoded nested named reference', '<a href="/careers?view=jobs&#38;a&#109;p;team=design">Jobs</a><a href="/contactUs">Contact</a>'],
  ['recursive entity after a quoted greater-than delimiter', '<a title="jobs > contact" href="/contact&#x26;#85;s">Contact</a>'],
  ['quoted recursive entity excludes otherwise ordinary contact', '<p data-note="&#x26;#85;">Corporate context.</p><a href="/contactUs">Contact</a>'],
]) test('C34 entity document exclusion retains exact unqualified context: ' + label, async () => {
  retainedContext(await observe(content), 'ambiguous-character-reference-spelling')
})

for (const tag of ['mtext', 'mi', 'mo', 'mn', 'ms', 'annotation-xml']) {
  test('C34 self-closing MathML integration cannot authorize a later anchor: ' + tag, async () => {
    const content = '<math><' + tag + (tag === 'annotation-xml' ? ' encoding="text/html"' : '') + '/><a href="/contactUs">Contact</a></math>'
    retainedContext(await observe(content), 'unsupported-self-closing-MathML-integration-spelling')
  })
}

for (const quote of ['"', "'"]) {
  test('C34 quoted greater-than cannot hide MathML self-closing syntax: ' + quote, async () => {
    retainedContext(await observe('<math><mtext data-note=' + quote + 'jobs > contact' + quote + '/><a href="/contactUs">Contact</a></math>'),
      'unsupported-self-closing-MathML-integration-spelling')
  })
  test('C34 quoted slash-greater-than cannot hide a later MathML self-close: ' + quote, async () => {
    retainedContext(await observe('<math><mtext data-note=' + quote + 'jobs /> contact' + quote + ' /><a href="/contactUs">Contact</a></math>'),
      'unsupported-self-closing-MathML-integration-spelling')
  })
}

for (const [label, content] of [
  ['ordinary decimal href', '<a href="/contact&#85;s">Contact</a>'],
  ['ordinary hexadecimal href', '<a href="/contact&#x55;s">Contact</a>'],
  ['normal named ampersand query', '<a href="/careers?feed=rss&amp;format=xml">Jobs</a><a href="/contactUs">Contact</a>'],
  ['normal decimal ampersand query', '<a href="/careers?feed=rss&#038;format=xml">Jobs</a><a href="/contactUs">Contact</a>'],
  ['paired MathML text integration', '<math><mtext><a href="/contactUs">Contact</a></mtext></math>'],
  ['paired MathML annotation integration', '<math><annotation-xml encoding="text/html"><a href="/contactUs">Contact</a></annotation-xml></math>'],
  ['HTML self-closing spelling outside MathML', '<mtext/><a href="/contactUs">Contact</a>'],
  ['paired MathML with quoted slash-greater-than', '<math><mtext data-note="literal />"><a href="/contactUs">Contact</a></mtext></math>'],
  ['paired MathML with single-quoted slash-greater-than', "<math><mtext data-note='literal />'><a href=\"/contactUs\">Contact</a></mtext></math>"],
]) test('C34 qualified ordinary declaration remains readable: ' + label, async () => {
  const result = await observe(content)
  assert.deepEqual(result.requests, [HOME, CONTACT])
  assert.equal(result.audit.declarations.filter(row => row.documentUrl === HOME && row.url === CONTACT && row.followed === true).length, 1)
  assert.ok(result.audit.declarationQualification.every(row => row.qualified === true && row.reasons.length === 0))
  if (label.includes('ampersand query')) {
    assert.ok(result.audit.declarations.some(row => row.url === 'https://aalekh.co/careers?feed=rss&format=xml' && row.followed === false))
  }
})

test('C34 contact document qualification is independent of the qualified homepage', async () => {
  const requests = [], contactHtml = contact.replace('Corporate contact.', '<math><mtext/><a href="https://example.invalid/jobs">Jobs</a></math>')
  const jobs = await aalekh.run({now, fetchPage: async url => {
    requests.push(url)
    return page(url === HOME ? home('<a href="/contactUs">Contact</a>') : contactHtml, url)
  }})
  const audit = gap(jobs)
  assert.deepEqual(requests, [HOME, CONTACT])
  assert.deepEqual(audit.declarationQualification.map(row => [row.documentUrl, row.qualified]), [[HOME, true], [CONTACT, false]])
  assert.ok(audit.declarations.every(row => row.documentUrl === HOME))
  assert.deepEqual(audit.observations, [])
  assert.equal(audit.responses[1].bodyBase64, Buffer.from(contactHtml).toString('base64'))
  assert.ok(audit.issues.some(issue => issue.kind === 'unqualified-declaration-context' && issue.documentUrl === CONTACT))
})

test('C34 genuine C32 default-catalog replay preserves original bodies, clocks and unknown scope without callbacks', async () => {
  const fixture = new URL('./fixtures/aalekhPublicReads20261107C32/', import.meta.url)
  const c32 = JSON.parse(fs.readFileSync(new URL('c32/manifest.json', fixture)))
  const c31 = JSON.parse(fs.readFileSync(new URL('c31/manifest.json', fixture)))
  const originals = [
    {manifest: c32, receipt: c32.records[0], version: 'c32'},
    {manifest: c31, receipt: c31.records[1], version: 'c31'},
  ].map(({manifest, receipt, version}) => {
    const bytes = gunzipSync(fs.readFileSync(new URL(version + '/' + receipt.bodyFile, fixture)))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
    return {url: receipt.finalUrl, requestedUrl: receipt.requestedUrl, status: receipt.status, headers: structuredClone(receipt.headers),
      bodyBase64: bytes.toString('base64'), sourceRequestedAt: receipt.sourceRequestedAt, sourceCompletedAt: receipt.sourceCompletedAt,
      sourceHttpDate: receipt.sourceHttpDate, originalReceipt: structuredClone(receipt),
      provenance: {transport: manifest.transport, bodyFile: receipt.bodyFile, corporateJavaScriptExecuted: false, subresourcesRequested: false}}
  })
  const requests = [], provider = getScraperCatalog().find(row => row.source === 'aalekh')
  assert.ok(provider)
  const jobs = await createCatalogScraper(provider).run({now, fetchPage: async url => {
    requests.push(url)
    const index = url === HOME ? 0 : url === CONTACT ? 1 : -1
    assert.notEqual(index, -1, 'No historical guessed route becomes a read')
    return structuredClone(originals[index])
  }})
  const audit = gap(jobs)
  assert.deepEqual(requests, [HOME, CONTACT])
  assert.equal(audit.declarationQualification.length, 2)
  assert.ok(audit.declarationQualification.every(row => row.qualified === true && row.reasons.length === 0))
  assert.deepEqual(audit.observations, [])
  for (const [index, original] of originals.entries()) {
    const response = audit.responses[index]
    assert.equal(response.status, original.status)
    assert.deepEqual(response.headers, original.headers)
    assert.equal(response.bodyBase64, original.bodyBase64)
    assert.equal(response.bytes, original.originalReceipt.bytes)
    assert.equal(response.sha256, original.originalReceipt.sha256)
    assert.equal(response.sourceRequestedAt, original.sourceRequestedAt)
    assert.equal(response.sourceCompletedAt, original.sourceCompletedAt)
    assert.deepEqual(audit.rawPages[index].originalReceipt, original.originalReceipt)
  }
  assert.equal(audit.responses[0].sha256, '099d3d54305265ef62b4211c82c5843a2d3d02e6a05e8600e115ee88090beaa6')
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-06T23:12:46.826Z')
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-06T23:12:58.993Z')
})

// C34-IR-02: quotes belong to attribute names until an equals sign introduces
// a value. Removing the corrected lexical boundary must expose an extra GET.
for (const [label, content] of [
  ['reviewer double quote in attribute name', '<math><mtext data"note/><a href="/contactUs">Contact</a></math>'],
  ['reviewer apostrophe in attribute name', "<math><mtext data'note/><a href=\"/contactUs\">Contact</a></math>"],
  ['double quote at attribute-name start', '<math><mtext "note/><a href="/contactUs">Contact</a></math>'],
  ['apostrophe at attribute-name start', "<math><mtext 'note/><a href=\"/contactUs\">Contact</a></math>"],
  ['quote in valued attribute name', '<math><mtext data"note=plain /><a href="/contactUs">Contact</a></math>'],
  ['apostrophe after an ordinary quoted value', "<math><mtext data-note=\"literal >\" data'note/><a href=\"/contactUs\">Contact</a></math>"],
  ['annotation integration with malformed attribute name', '<math><annotation-xml encoding="text/html" data"note/><a href="/contactUs">Contact</a></math>'],
  ['uppercase text integration and tab separator', "<MaTh><MI\tdata'note /><a href=\"/contactUs\">Contact</a></MaTh>"],
]) test('C34-IR-02 regression self-closing malformed attribute-name boundary: ' + label, async () => {
  const result = await observe(content)
  console.log(JSON.stringify({control: 'C34-IR-02', label, observedRequests: result.requests,
    qualification: result.audit.declarationQualification,
    contactDeclarations: result.audit.declarations.filter(row => row.url === CONTACT)}))
  retainedContext(result, 'unsupported-self-closing-MathML-integration-spelling')
})

for (const [label, content] of [
  ['paired element with double quote in name and quoted slash-greater-than value', '<math><mtext data"note="/>"><a href="/contactUs">Contact</a></mtext></math>'],
  ['paired element with apostrophe in name and quoted greater-than value', "<math><mtext data'note='>'><a href=\"/contactUs\">Contact</a></mtext></math>"],
  ['unquoted slash is part of the attribute value', '<math><mtext data-note=literal/><a href="/contactUs">Contact</a></mtext></math>'],
]) test('C34-IR-02 value boundaries retain qualified paired integration: ' + label, async () => {
  const result = await observe(content)
  assert.deepEqual(result.requests, [HOME, CONTACT])
  assert.ok(result.audit.declarationQualification.every(row => row.qualified === true && row.reasons.length === 0))
  assert.equal(result.audit.declarations.filter(row => row.documentUrl === HOME && row.url === CONTACT && row.followed).length, 1)
})
