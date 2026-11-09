import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAeonScraper, CAREERS_URL, JOIN_US_URL, HOMEPAGE_URL } from './script.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

const ATS_URL = 'https://careers-aeoncredit.peoplestrong.com/portal/home'
const fixture = name => gunzipSync(readFileSync(new URL('./test-data/' + name, import.meta.url))).toString('utf8')
function harness(status = 403, body = fixture('declared-ats-403-20261103.html.gz')) {
  const requests = [], browserRequests = []
  const fetchPage = async url => {
    requests.push(url)
    if (url === HOMEPAGE_URL) return { status: 200, url, html: '<html><title>Personal Loan, Two wheeler loan and More | Aeon Credit</title><body>Aeon Credit - Personal Loan, Two wheeler loan and more Hot Offers <a href="/careers">Careers</a><footer>AEON CREDIT SERVICE INDIA PVT. LTD.</footer></body></html>' }
    if (url === CAREERS_URL) return { status: 200, url, html: fixture('careers-hub-20261103.html.gz') }
    if (url === JOIN_US_URL) return { status: 200, url, html: fixture('join-us-20261103.html.gz') }
    if (url === ATS_URL) return { status, url, html: body }
    throw Error('unreviewed public request: ' + url)
  }
  return { requests, browserRequests, run: () => createAeonScraper().run({ fetchPage,
    fetchBrowserPage: async url => { browserRequests.push(url); throw Error('denied host must not be reprobed') } }) }
}

test('actual captured ATS403 is a blocked source failure with unknown inventory, rather than a successful empty list', async () => {
  const h = harness()
  await assert.rejects(h.run(), error => {
    assert.equal(error.name, 'AeonAccessDeniedError')
    assert.equal(error.status, 403)
    assert.equal(error.surface, ATS_URL)
    assert.equal(error.nativeJobTotal, null)
    assert.equal(error.nativeIndiaTotal, null)
    assert.equal(error.abortRetries, true)
    assert.notEqual(error.abortPipeline, true)
    assert.notEqual(error.persistenceBlocked, true)
    assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied' })
    return true
  })
  assert.deepEqual(h.requests, [HOMEPAGE_URL, CAREERS_URL, JOIN_US_URL, ATS_URL])
  assert.equal(h.browserRequests.length, 0)
})

test('denied statuses stay unavailable even when the publisher changes its error-page wording', async () => {
  for (const status of [401, 403, 429]) {
    const h = harness(status, '<html><h1>Unavailable</h1></html>')
    await assert.rejects(h.run(), error => error.status === status && error.failureKind === 'blocked_or_access_denied')
    assert.equal(h.requests.filter(url => url === ATS_URL).length, 1)
    assert.equal(h.browserRequests.length, 0)
  }
})

test('captured hidden corporate role content has no active reveal trigger and cannot authorize current vacancies', () => {
  const doc = document(fixture('join-us-20261103.html.gz'))
  const nodes = [], parents = new Map()
  function walk(node, parent) { if (typeof node === 'string') return; nodes.push(node); if (parent) parents.set(node, parent); node.children.forEach(child => walk(child, node)) }
  walk(doc.root)
  const controls = doc.nodes(node => (node.attrs.class || '').split(/\s+/).includes('btnshowhide1'))
  const cards = nodes.filter(node => Object.hasOwn(node.attrs, 'data-jdid'))
  assert.equal(controls.length, 0)
  assert.equal(cards.length, 8)
  for (const action of cards) {
    let inHiddenGroup = false
    for (let p = parents.get(action); p; p = parents.get(p)) if ((p.attrs.class || '').split(/\s+/).includes('hidecareer')) inHiddenGroup = true
    assert.equal(inHiddenGroup, true)
  }
  // The accompanying ordinary-browser receipt independently establishes all
  // eight cards as hidden. Script declarations alone cannot activate them.
})
