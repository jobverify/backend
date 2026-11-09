import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import test from 'node:test'
import * as aalekh from '../../scraper/aalekh/script.js'
import {getScraperCatalog, createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence, isVerifiedEmptyEvidence} from '../utils/inventoryEvidence.js'

const HOME = 'https://aalekh.co/', CONTACT = 'https://aalekh.co/contactUs'
const reason = 'unsupported-self-closing-MathML-integration-spelling'
const now = () => '2026-11-07T04:00:00.000Z'
const home = body => '<html><head><title>Aalekh Designs, Rajkot | Packaging Designer in Rajkot</title></head><body>' + body + '</body></html>'
const contact = body => '<html><head><title>Aalekh Designs Rajkot</title></head><body>' + body + '</body></html>'
const contactLink = '<a href="/contactUs">Contact</a>'
const selfClosing = '<math><mtext/>' + contactLink + '</math>'
// Every entity in this file is a synthetic lexical boundary control. It is
// never a captured publisher response or evidence of vacancies/company zero.
const page = (html, url) => ({url, requestedUrl: url, status: 200,
  headers: {'content-type': 'text/html; charset=utf-8'}, bodyBase64: Buffer.from(html).toString('base64'),
  sourceRequestedAt: '2026-11-07T03:00:00.000Z', sourceCompletedAt: '2026-11-07T03:00:00.001Z',
  syntheticBoundaryEntity: true})
const routes = [
  ['actual-script', options => aalekh.run(options)],
  ['default-catalog', options => {
    const provider = getScraperCatalog().find(row => row.source === 'aalekh')
    assert.ok(provider, 'The actual default catalog must expose Aalekh')
    assert.equal(provider.adapter, 'script')
    return createCatalogScraper(provider).run(options)
  }],
]
const observe = async (run, body, contactBody = 'Corporate contact.') => {
  const requests = [], callbackAudits = [], metadata = [], records = []
  const originals = new Map([[HOME, page(home(body), HOME)], [CONTACT, page(contact(contactBody), CONTACT)]])
  const jobs = await run({now, fetchPage: async (url, init) => {
    assert.ok(originals.has(url), 'Only the exact configured homepage/contact can be requested')
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    assert.ok(init.signal instanceof AbortSignal)
    init.throwIfAborted()
    requests.push(url)
    return structuredClone(originals.get(url))
  }, onAudit: audit => callbackAudits.push(audit), onMetadata: value => metadata.push(value),
  onRecords: value => records.push(value)})
  const audit = jobs.nativeCollectionEvidence, inventory = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 0)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.verifiedAt, null)
  assert.equal(isVerifiedEmptyEvidence(inventory), false)
  assert.equal(audit.outcome, 'coverage-gap')
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  for (const key of ['nativeReportedTotal', 'nativeIndiaTotal', 'companyGlobalTotal', 'companyIndiaTotal', 'inventoryVerifiedAt']) assert.equal(audit[key], null)
  assert.equal(audit.corporateJavaScriptExecuted, false)
  assert.equal(audit.subresourcesRequested, false)
  assert.equal(audit.redirectsFollowed, false)
  assert.equal(audit.startedAt, '2026-11-07T04:00:00.000Z')
  assert.equal(audit.completedAt, '2026-11-07T04:00:00.000Z')
  assert.deepEqual(callbackAudits, [audit], 'The callback and retained full audit must agree')
  assert.deepEqual(records, [[]])
  assert.equal(metadata.length, 1)
  assert.equal(metadata[0].sourceScopeComplete, false)
  assert.equal(metadata[0].lifecycleCleanupAllowed, false)
  assert.equal(audit.responses.length, requests.length)
  for (const [index, url] of requests.entries()) {
    const original = originals.get(url), bytes = Buffer.from(original.bodyBase64, 'base64'), response = audit.responses[index]
    assert.equal(response.requestUrl, url)
    assert.equal(response.finalUrl, url)
    assert.equal(response.status, 200)
    assert.equal(response.bodyBase64, original.bodyBase64)
    assert.equal(response.bytes, bytes.length)
    assert.equal(response.sha256, createHash('sha256').update(bytes).digest('hex'))
    assert.equal(response.sourceRequestedAt, '2026-11-07T03:00:00.000Z')
    assert.equal(response.sourceCompletedAt, '2026-11-07T03:00:00.001Z')
    assert.equal(response.transportQualified, true)
    assert.equal(response.bodyComplete, true)
    assert.deepEqual(audit.rawPages[index], original)
  }
  return {requests, audit, callbackAudits, originals}
}
const excluded = result => {
  assert.deepEqual(result.requests, [HOME], 'An unsupported MathML spelling must not authorize the contact GET')
  assert.deepEqual(result.audit.declarations, [])
  assert.deepEqual(result.audit.observations, [])
  assert.deepEqual(result.audit.declarationQualification.map(row => [row.documentUrl, row.qualified, row.reasons]), [[HOME, false, [reason]]])
  assert.ok(result.audit.issues.some(row => row.kind === 'unqualified-declaration-context'
    && row.documentUrl === HOME && row.reason === reason && row.contextRetained === true && row.declarationAuthority === false))
}

// Losing enclosing raw-text/comment/value boundaries would skip the real
// self-close, expose a fabricated declaration and cause a second injected GET.
const prefixes = [
  ['raw script candidate', `<script>const example = '<mtext data="';</script>`, true],
  ['comment candidate', '<!-- <mtext data=" -->', true],
  ['raw style candidate', `<style>.example::before {content: '<mtext data="';}</style>`],
  ...['textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'].map(tag => ['raw ' + tag + ' candidate', '<' + tag + '><mtext data="</' + tag + '>']),
  ['enclosing quoted attribute candidate', `<p data-example='<mtext data="'>Corporate context.</p>`],
  ['SVG title self-close then raw script candidate', `<svg><title/></svg><script>const example = '<mtext data="';</script>`],
]
for (const [route, run] of routes) {
  for (const [label, prefix, exactReproduction] of prefixes) {
    test('C36 regression ' + route + ' does not skip a real MathML self-close after ' + label, async () => {
      const result = await observe(run, prefix + selfClosing)
      if (exactReproduction) console.log(JSON.stringify({control: 'C36-exact-prefix-reproduction', synthetic: true,
        route, label, originalHomepage: result.originals.get(HOME), requests: result.requests,
        callbackAudits: result.callbackAudits, returnedAudit: result.audit}))
      excluded(result)
    })
  }
  for (const tag of ['mi', 'mo', 'mn', 'ms', 'annotation-xml']) {
    test('C36 regression ' + route + ' screens ' + tag + ' self-close after an inert comment prefix', async () => {
      const attributes = tag === 'annotation-xml' ? ' encoding="text/html"' : ''
      excluded(await observe(run, '<!-- <mtext data=" --><math><' + tag + attributes + '/>' + contactLink + '</math>'))
    })
  }
  // Blanket MathML rejection, treating quoted /> as syntax, or scanning inert
  // tag-looking text would wrongly suppress these actual literal declarations.
  for (const [label, body] of [
    ['paired MathML text with quoted greater-than and slash-greater-than', '<math><mtext data-note="literal > and />">' + contactLink + '</mtext></math>'],
    ['paired MathML annotation', '<math><annotation-xml encoding="text/html">' + contactLink + '</annotation-xml></math>'],
    ['direct decimal character reference', '<a href="/contact&#85;s">Contact</a>'],
    ['direct hexadecimal character reference', '<a href="/contact&#x55;s">Contact</a>'],
    ['ordinary decimal query separator', '<a href="/careers?feed=rss&#038;format=xml">Jobs</a>' + contactLink],
    ['quoted integration spelling in an ordinary attribute', `<p data-example='<math><mtext/>'>Corporate context.</p>` + contactLink],
    ['complete integration spelling in a raw script string', `<script>const example = '<math><mtext/>';</script>` + contactLink],
    ['complete integration spelling in a comment', '<!-- <math><mtext/> -->' + contactLink],
    ['unquoted attribute slash remains value data', '<math><mtext data-note=literal/>' + contactLink + '</mtext></math>'],
    ['SVG title self-close preserves a later paired integration', '<svg><title/></svg><math><mtext data-note="/>">' + contactLink + '</mtext></math>'],
    ['inert unclosed candidate alone cannot suppress a direct contact', `<script>const example = '<mtext data="';</script>` + contactLink],
  ]) test('C36 positive ' + route + ' retains ' + label, async () => {
    const result = await observe(run, body)
    assert.deepEqual(result.requests, [HOME, CONTACT])
    assert.ok(result.audit.declarationQualification.every(row => row.qualified === true && row.reasons.length === 0))
    assert.equal(result.audit.declarations.filter(row => row.documentUrl === HOME && row.url === CONTACT && row.followed === true).length, 1)
    if (label === 'ordinary decimal query separator') assert.ok(result.audit.declarations.some(row => row.url === 'https://aalekh.co/careers?feed=rss&format=xml' && row.followed === false))
  })
  test('C36 regression ' + route + ' independently screens an unsupported prefixed contact document', async () => {
    const result = await observe(run, contactLink,
      `<!-- <mtext data=" --><math><mtext/><a href="https://example.invalid/jobs">Jobs</a></math>`)
    assert.deepEqual(result.requests, [HOME, CONTACT])
    assert.deepEqual(result.audit.declarationQualification.map(row => [row.documentUrl, row.qualified]), [[HOME, true], [CONTACT, false]])
    assert.ok(result.audit.declarations.every(row => row.documentUrl === HOME))
    assert.deepEqual(result.audit.observations, [])
    assert.ok(result.audit.issues.some(row => row.kind === 'unqualified-declaration-context' && row.documentUrl === CONTACT && row.reason === reason))
  })
}
