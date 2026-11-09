import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import test from 'node:test'
import * as aavishkar from '../../scraper/aavishkar/script.js'
import {getScraperCatalog, createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence, isVerifiedEmptyEvidence} from '../utils/inventoryEvidence.js'

const HOME = 'https://aavishkaargroup.com/', CONTACT = 'https://aavishkaargroup.com/contact-us/'
const now = () => '2026-11-07T01:00:00.000Z'
const hash = value => createHash('sha256').update(value).digest('hex')
const home = content => '<html><head><title>Aavishkaar Group: One of the largest Impact Platforms across the Global South</title></head><body>' + content + '</body></html>'
const contact = '<html><head><title>Contact Us - Aavishkaar Group</title></head><body>Corporate contact.</body></html>'
// These are original explicitly synthetic C35 offline inputs. No altered page
// is offered as a historical response, current public read or vacancy evidence.
const page = (html, url) => ({url, requestedUrl: url, status: 200,
  headers: {'content-type': 'text/html; charset=utf-8'}, bodyBase64: Buffer.from(html).toString('base64'),
  sourceRequestedAt: '2026-11-07T00:00:00.000Z', sourceCompletedAt: '2026-11-07T00:00:00.001Z',
  syntheticBoundaryEntity: true, provenance: {kind: 'original explicitly synthetic C35 offline input', historicalCapture: false}})
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
const observe = async (content, entry = 'actual-script-run', contactHtml = contact) => {
  const requests = [], audits = [], html = home(content)
  const provider = getScraperCatalog().find(row => row.source === 'aavishkar')
  assert.ok(provider)
  const run = entry === 'actual-default-catalog' ? createCatalogScraper(provider).run : aavishkar.run
  const jobs = await run({now, fetchPage: async (url, init) => {
    requests.push(url)
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    assert.ok([HOME, CONTACT].includes(url), 'No guessed third document')
    return page(url === HOME ? html : contactHtml, url)
  }, onAudit: audit => audits.push(audit)})
  const audit = gap(jobs)
  assert.equal(audits.length, 1)
  assert.deepEqual(audits[0], audit, 'Callback and returned evidence retain the same complete audit')
  console.log(JSON.stringify({kind: 'C35-boundary-observation', synthetic: true, historicalCapture: false,
    entry, content, contentSHA256: hash(content), homepageSHA256: hash(html), contactSHA256: hash(contactHtml),
    requests, callbackCount: audits.length, callbackQualification: audits[0].declarationQualification,
    callbackContactDeclarations: audits[0].declarations.filter(row => row.url === CONTACT)}))
  return {requests, audits, html, jobs, audit}
}
const retainedContext = (result, reason = 'unsupported-self-closing-MathML-integration-spelling') => {
  assert.deepEqual(result.requests, [HOME])
  assert.deepEqual(result.audit.declarations, [])
  assert.deepEqual(result.audit.observations, [])
  const response = result.audit.responses[0], original = Buffer.from(result.html)
  assert.equal(response.status, 200)
  assert.deepEqual(response.headers, {'content-type': 'text/html; charset=utf-8'})
  assert.equal(response.bodyBase64, original.toString('base64'))
  assert.equal(response.bytes, original.length)
  assert.equal(response.sha256, hash(original))
  assert.equal(response.sourceRequestedAt, '2026-11-07T00:00:00.000Z')
  assert.equal(response.sourceCompletedAt, '2026-11-07T00:00:00.001Z')
  assert.equal(result.audit.rawPages[0].bodyBase64, original.toString('base64'))
  assert.deepEqual(result.audit.declarationQualification.map(row => ({documentUrl: row.documentUrl, qualified: row.qualified, reasons: row.reasons})),
    [{documentUrl: HOME, qualified: false, reasons: [reason]}])
  assert.ok(result.audit.issues.some(issue => issue.kind === 'unqualified-declaration-context'
    && issue.documentUrl === HOME && issue.reason === reason && issue.contextRetained === true && issue.declarationAuthority === false))
}
const qualifiedContact = result => {
  assert.deepEqual(result.requests, [HOME, CONTACT])
  assert.equal(result.audit.declarations.filter(row => row.documentUrl === HOME && row.url === CONTACT && row.followed).length, 1)
  assert.ok(result.audit.declarationQualification.every(row => row.qualified === true && row.reasons.length === 0))
}

// A screen that treats attribute-name quotes as value delimiters misses the
// self-close, invents an HTML child and issues one extra source callback read.
for (const [label, content] of [
  ['double quote in attribute name', '<math><mtext data"note/><a href="/contact-us/">Contact</a></math>'],
  ['apostrophe in attribute name', "<math><mtext data'note/><a href=\"/contact-us/\">Contact</a></math>"],
]) for (const entry of ['actual-script-run', 'actual-default-catalog']) {
  test('C35 rejects attribute-name quote contact authority: ' + label + ' through ' + entry, async () => {
    retainedContext(await observe(content, entry))
  })
}

for (const [label, content] of [
  ['double quote at attribute-name start', '<math><mtext "note/><a href="/contact-us/">Contact</a></math>'],
  ['apostrophe at attribute-name start', "<math><mtext 'note/><a href=\"/contact-us/\">Contact</a></math>"],
  ['quote in valued attribute name', '<math><mtext data"note=plain /><a href="/contact-us/">Contact</a></math>'],
  ['quote in equals-prefixed attribute name', '<math><mtext =data"note/><a href="/contact-us/">Contact</a></math>'],
  ['apostrophe after an ordinary quoted value', "<math><mtext data-note=\"literal >\" data'note/><a href=\"/contact-us/\">Contact</a></math>"],
  ['annotation integration with malformed attribute name', '<math><annotation-xml encoding="text/html" data"note/><a href="/contact-us/">Contact</a></math>'],
  ['uppercase text integration and tab separator', "<MaTh><MI\tdata'note /><a href=\"/contact-us/\">Contact</a></MaTh>"],
]) test('C35 rejects related self-closing attribute-name boundaries: ' + label, async () => {
  retainedContext(await observe(content))
})

for (const tag of ['mtext', 'mi', 'mo', 'mn', 'ms', 'annotation-xml']) {
  test('C35 attribute-name quote cannot hide self-closing integration: ' + tag, async () => {
    retainedContext(await observe('<math><' + tag + (tag === 'annotation-xml' ? ' encoding="text/html"' : '')
      + ' data"note/><a href="/contact-us/">Contact</a></math>'))
  })
}

for (const quote of ['"', "'"]) {
  test('C35 value greater-than does not hide a later self-close: ' + quote, async () => {
    retainedContext(await observe('<math><mtext data-note=' + quote + 'jobs > contact' + quote + '/><a href="/contact-us/">Contact</a></math>'))
  })
  test('C35 value slash-greater-than does not hide a later self-close: ' + quote, async () => {
    retainedContext(await observe('<math><mtext data-note=' + quote + 'jobs /> contact' + quote + ' /><a href="/contact-us/">Contact</a></math>'))
  })
}

// Exact content copies of original C33 synthetic declaration-negative controls.
// Existing C33 tests and genuine original gzip entities remain immutable.
for (const [label, content, reason] of [
  ['hexadecimal ampersand then decimal reference', '<a href="/contact&#x26;#45;us/">Contact</a>', 'ambiguous-character-reference-spelling'],
  ['encoded ampersand then named reference', '<a href="/contact&#38;ndash;us/">Contact</a>', 'ambiguous-character-reference-spelling'],
  ['partly encoded nested named reference', '<a href="/contact&#38;l&#116;;us/">Contact</a>', 'ambiguous-character-reference-spelling'],
  ['self-closing MathML text integration', '<math><mtext/><a href="/contact-us/">Contact</a></math>', 'unsupported-self-closing-MathML-integration-spelling'],
]) test('C35 offline copy retains original C33 negative control: ' + label, async () => {
  retainedContext(await observe(content), reason)
})

// A scanner that treats slash in an unquoted value as a self-close, or quotes
// in a name as a value, would incorrectly suppress these ordinary declarations.
for (const [label, content] of [
  ['ordinary decimal href', '<a href="/contact&#45;us/">Contact</a>'],
  ['ordinary hexadecimal href', '<a href="/contact&#x2d;us/">Contact</a>'],
  ['normal named ampersand query', '<a href="/careers?feed=rss&amp;format=xml">Jobs</a><a href="/contact-us/">Contact</a>'],
  ['normal decimal ampersand query', '<a href="/careers?feed=rss&#038;format=xml">Jobs</a><a href="/contact-us/">Contact</a>'],
  ['paired MathML text integration', '<math><mtext><a href="/contact-us/">Contact</a></mtext></math>'],
  ['paired MathML annotation integration', '<math><annotation-xml encoding="text/html"><a href="/contact-us/">Contact</a></annotation-xml></math>'],
  ['self-closing spelling outside MathML', '<mtext/><a href="/contact-us/">Contact</a>'],
  ['paired element with double quote in name and quoted slash-greater-than value', '<math><mtext data"note="/>"><a href="/contact-us/">Contact</a></mtext></math>'],
  ['paired element with apostrophe in name and quoted greater-than value', "<math><mtext data'note='>'><a href=\"/contact-us/\">Contact</a></mtext></math>"],
  ['paired MathML with quoted slash-greater-than', '<math><mtext data-note="literal />"><a href="/contact-us/">Contact</a></mtext></math>'],
  ['paired MathML with single-quoted slash-greater-than', "<math><mtext data-note='literal />'><a href=\"/contact-us/\">Contact</a></mtext></math>"],
  ['unquoted slash belongs to the value', '<math><mtext data-note=literal/><a href="/contact-us/">Contact</a></mtext></math>'],
  ['unquoted quote and slash belong to the value', '<math><mtext data-note=literal"/><a href="/contact-us/">Contact</a></mtext></math>'],
  ['unquoted apostrophe and slash belong to the value', "<math><mtext data-note=literal'/><a href=\"/contact-us/\">Contact</a></mtext></math>"],
  ['candidate spelling inside a quoted integration value', '<math><mtext data-note="<mi/>"><a href="/contact-us/">Contact</a></mtext></math>'],
]) test('C35 ordinary value boundaries retain qualified contact: ' + label, async () => {
  const result = await observe(content)
  qualifiedContact(result)
  if (label.includes('ampersand query')) {
    assert.ok(result.audit.declarations.some(row => row.url === 'https://aavishkaargroup.com/careers?feed=rss&format=xml' && row.followed === false))
  }
})

test('C35 contact qualification is independent of a qualified homepage', async () => {
  const contactHtml = contact.replace('Corporate contact.', '<math><mtext data"note/><a href="https://example.invalid/jobs">Jobs</a></math>')
  const result = await observe('<a href="/contact-us/">Contact</a>', 'actual-default-catalog', contactHtml)
  assert.deepEqual(result.requests, [HOME, CONTACT])
  assert.deepEqual(result.audit.declarationQualification.map(row => [row.documentUrl, row.qualified]), [[HOME, true], [CONTACT, false]])
  assert.deepEqual(result.audit.declarationQualification[1].reasons, ['unsupported-self-closing-MathML-integration-spelling'])
  assert.ok(result.audit.declarations.every(row => row.documentUrl === HOME))
  assert.deepEqual(result.audit.observations, [])
  assert.equal(result.audit.responses[1].bodyBase64, Buffer.from(contactHtml).toString('base64'))
  assert.equal(result.audit.responses[1].sha256, hash(contactHtml))
  assert.ok(result.audit.issues.some(issue => issue.kind === 'unqualified-declaration-context' && issue.documentUrl === CONTACT))
})

// C35-IR-01: exact original reviewer cases. A candidate in an inert literal
// must not move the lexical cursor past a later genuine self-closing tag.
for (const [label, content] of [
  ['script literal', '<script>const example = \'<mtext data="\';</script><math><mtext/><a href="/contact-us/">Contact</a></math>'],
  ['comment literal', '<!-- <mtext data=" --><math><mtext/><a href="/contact-us/">Contact</a></math>'],
]) for (const entry of ['actual-script-run', 'actual-default-catalog']) {
  test('C35-IR-01 rejects exact inert prefix bypass: ' + label + ' through ' + entry, async () => {
    retainedContext(await observe(content, entry))
  })
}

for (const [label, content] of [
  ['script literal', '<script>const example = \'<mtext data="\';</script><math><mtext><a href="/contact-us/">Contact</a></mtext></math>'],
  ['comment literal', '<!-- <mtext data=" --><math><mtext><a href="/contact-us/">Contact</a></mtext></math>'],
]) for (const entry of ['actual-script-run', 'actual-default-catalog']) {
  test('C35-IR-01 inert prefix retains qualified paired integration: ' + label + ' through ' + entry, async () => {
    qualifiedContact(await observe(content, entry))
  })
}

// These synthetic adjacent controls exercise only the lexical boundaries used
// by this source and its existing shared tree, not browser conformance.
for (const [label, content] of [
  ['style raw text', '<style>.example { content: "<mtext data=\'"; }</style><math><mtext/><a href="/contact-us/">Contact</a></math>'],
  ['textarea raw text', '<textarea><mtext data="</textarea><math><mtext/><a href="/contact-us/">Contact</a></math>'],
  ['literal in an ordinary quoted attribute', '<div data-note="<mtext data=\'"></div><math><mtext/><a href="/contact-us/">Contact</a></math>'],
  ['processing-instruction bogus comment', '<?example <mtext data="><math><mtext/><a href="/contact-us/">Contact</a></math>'],
  ['SVG self-closing title', '<svg><title/></svg><math><mtext/><a href="/contact-us/">Contact</a></math>'],
  ['SVG self-closing script', '<svg><script/></svg><math><mtext/><a href="/contact-us/">Contact</a></math>'],
]) test('C35-IR-01 enclosing lexical boundary cannot hide a later self-close: ' + label, async () => {
  retainedContext(await observe(content))
})

for (const [label, content] of [
  ['SVG self-closing title', '<svg><title/></svg><math><mtext><a href="/contact-us/">Contact</a></mtext></math>'],
  ['SVG self-closing script', '<svg><script/></svg><math><mtext><a href="/contact-us/">Contact</a></mtext></math>'],
]) test('C35-IR-01 self-closing foreign raw-name prefix retains paired integration: ' + label, async () => {
  qualifiedContact(await observe(content))
})
