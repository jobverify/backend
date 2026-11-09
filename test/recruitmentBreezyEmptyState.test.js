import assert from 'node:assert/strict'
import test, {after, mock} from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from '../scraper-support/utils/nativeHtmlAttributes.js'

import { readBreezyEmptyState } from '../scraper-support/utils/recruitmentBreezyEmptyState.js'

const blockedFetch=mock.method(globalThis,'fetch',()=>assert.fail('Pure reader tests forbid network requests'))
after(()=>blockedFetch.mock.restore())

const saved=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/anydo-breezy-empty-board-20261108.json.gz',import.meta.url))))
const board=saved.documents.find(row=>row.requestedURL==='https://any-do.breezy.hr/')
assert.ok(board,'Genuine bound board response must be retained')
const fixture=Buffer.from(board.body.data,'base64')
assert.equal(fixture.length, 10154)
assert.equal(createHash('sha256').update(fixture).digest('hex'),
  'c6f67231d005833b874140c603e83016f882c69c1bd0f6fb8aae34304fb10152')
const original = fixture.toString('utf8')
const boardURL = 'https://any-do.breezy.hr/'
const context = {
  companyName: 'Any.do',
  officialHomepageUrl: 'https://www.any.do/',
  bindingEvidence: {
    verified: true,
    checkedAt: '2026-11-08T00:08:51.007Z', // Controlled test observation time.
    officialURL: 'https://www.any.do/',
    matchedLinks: ['https://any-do.breezy.hr/'],
    bindingMethod: 'runtime-current-careers-link',
  },
}
const cloneContext = () => structuredClone(context)
const read = (html = original, pageURL = boardURL, binding = context) =>
  readBreezyEmptyState(readNativeDocument(normalizeNativeAttributeBoundaries(html)), pageURL, binding)
const replace = (needle, value, html = original) => {
  assert.ok(html.includes(needle), `Control must alter the genuine fixture: ${needle}`)
  return html.replace(needle, value)
}
const heading = '<h2 class="polygot">%LABEL_NO_POSITIONS%</h2>'
const emptyContainer = '<div class="no-positions-container">'
const afterEmpty = '</h2></div></div>'
const injectBody = value => replace('</body>', value + '</body>')

test('retains the literal bound Breezy empty-state signal with unknown totals and partial scope', () => {
  // Removing the new leaf observation would make this real-fixture regression fail.
  const before = structuredClone(context)
  const observation = read()
  assert.ok(observation, 'The current bound board marker must become native evidence')
  assert.equal(observation.kind, 'breezy')
  assert.equal(observation.surface, 'https://any-do.breezy.hr/')
  assert.equal(observation.boardEmptyStateObserved, true)
  assert.equal(observation.reportedTotal, null)
  assert.equal(observation.observedRoleLinks, 0)
  assert.equal(observation.sourceScopeComplete, false)
  assert.equal(observation.lifecycleCleanupAllowed, false)
  assert.deepEqual(observation.evidence, {
    type: 'native-empty-state-token',
    marker: '%LABEL_NO_POSITIONS%',
    selector: '.positions-container > .no-positions-container > h2.polygot',
    translationResolved: false,
    publisher: 'Any.do',
    canonicalURL: 'https://any-do.breezy.hr/',
    companyURL: 'https://www.any.do/',
    bindingEvidence: before.bindingEvidence,
  })
  assert.deepEqual(context, before, 'The pure reader must not mutate binding context')
  assert.equal(Object.hasOwn(observation, 'companyGlobalTotal'), false)
  assert.equal(Object.hasOwn(observation, 'companyIndiaTotal'), false)
})

for (const [name, change] of [
  ['unbound board', value => { delete value.bindingEvidence }],
  ['unverified handoff', value => { value.bindingEvidence.verified = false }],
  ['non-current binding method', value => { value.bindingEvidence.bindingMethod = 'registered-board-hint' }],
  ['foreign corporate handoff', value => { value.bindingEvidence.officialURL = 'https://foreign.example/' }],
  ['corporate hostname suffix spoof', value => { value.bindingEvidence.officialURL = 'https://www.any.do.evil.example/' }],
  ['missing matched link', value => { value.bindingEvidence.matchedLinks = [] }],
  ['different tenant matched link', value => { value.bindingEvidence.matchedLinks = ['https://different.breezy.hr/'] }],
  ['descendant-only matched link', value => { value.bindingEvidence.matchedLinks = ['https://any-do.breezy.hr/p/role'] }],
  ['wrong configured employer', value => { value.companyName = 'Different Employer' }],
  ['missing configured homepage', value => { delete value.officialHomepageUrl }],
]) test(`rejects ${name}`, () => {
  // Removing the corresponding binding/identity guard would incorrectly retain native evidence.
  const altered = cloneContext()
  change(altered)
  assert.equal(read(original, boardURL, altered), null)
})

for (const pageURL of [
  'https://employer.example/',
  'https://any-do.breezy.hr.evil.example/',
  'https://breezy.hr/',
  'https://www.breezy.hr/',
  'http://any-do.breezy.hr/',
  'https://user@any-do.breezy.hr/',
  'https://any-do.breezy.hr:8443/',
  'https://any-do.breezy.hr/?location=India',
  'https://any-do.breezy.hr/#positions',
  'https://any-do.breezy.hr/p/engineer',
  'https://any-do.breezy.hr/jobs',
]) test(`rejects an unsupported board URL: ${pageURL}`, () => {
  // All URL-dependent provenance is changed together, so canonical mismatch cannot hide a missing URL guard.
  const altered = cloneContext()
  altered.bindingEvidence.matchedLinks = [pageURL]
  const html = replace('rel="canonical" href="https://any-do.breezy.hr/"', `rel="canonical" href="${pageURL}"`)
  assert.equal(read(html, pageURL, altered), null)
})

for (const [name, html] of [
  ['missing canonical', replace('<link rel="canonical" href="https://any-do.breezy.hr/">', '')],
  ['wrong canonical tenant', replace('rel="canonical" href="https://any-do.breezy.hr/"', 'rel="canonical" href="https://other.breezy.hr/"')],
  ['duplicate canonical', replace('<link rel="canonical"', '<link rel="canonical" href="https://any-do.breezy.hr/"><link rel="canonical"')],
  ['canonical outside the head', replace('<link rel="canonical" href="https://any-do.breezy.hr/">', '') .replace('</body>', '<link rel="canonical" href="https://any-do.breezy.hr/"></body>')],
  ['missing publisher', replace('<meta name="breezy-doc-title" content="Any.do">', '')],
  ['wrong publisher', replace('name="breezy-doc-title" content="Any.do"', 'name="breezy-doc-title" content="Different Employer"')],
  ['duplicate publisher', replace('<meta name="breezy-doc-title"', '<meta name="breezy-doc-title" content="Any.do"><meta name="breezy-doc-title"')],
  ['foreign company link', replace('<a href="https://www.any.do" class="bzyButtonColor">', '<a href="https://foreign.example/" class="bzyButtonColor">')],
  ['hidden company link', replace('<li class="link misc company">', '<li class="link misc company" hidden>')],
  ['missing Breezy body identity', replace('class="breezy-portal english breezy-portal-bold"', 'class="generic-portal"')],
  ['missing marker', replace(heading, '')],
  ['translated generic marker', replace('%LABEL_NO_POSITIONS%</h2>', 'No open positions</h2>')],
  ['generic marker outside the native container', replace('class="no-positions-container"', 'class="generic-message"')],
  ['duplicate active marker', replace(heading, heading + heading)],
  ['duplicate native empty container', replace(afterEmpty, '</h2></div><div class="no-positions-container">' + heading + '</div></div>')],
  ['duplicate listing container', injectBody('<div class="positions-container"></div>')],
  ['extra active listing content', replace(afterEmpty, '</h2></div><p>More positions below</p></div>')],
  ['generic shell', '<html><body><h2>No positions</h2></body></html>'],
]) test(`rejects ${name}`, () => {
  // A shell, identity error, ambiguity, or extra listing content must not masquerade as the supported empty contract.
  assert.equal(read(html), null)
})

for (const [name, attribute] of [
  ['hidden heading', 'hidden'],
  ['inert heading', 'inert'],
  ['aria-hidden heading', 'aria-hidden="true"'],
  ['display-none heading', 'style="display:none"'],
  ['visibility-hidden heading', 'style="visibility:hidden"'],
  ['content-visibility-hidden heading', 'style="content-visibility:hidden"'],
]) test(`rejects ${name}`, () => {
  // Preserve the exact native tree shape: rejection must depend on activity.
  assert.equal(read(replace(heading, `<h2 class="polygot" ${attribute}>%LABEL_NO_POSITIONS%</h2>`)), null)
})

for (const [name, opening, closing] of [
  ['template heading', '<template>', '</template>'],
  ['script template heading', '<script type="text/template">', '</script>'],
  ['comment-only heading', '<!--', '-->'],
]) test(`rejects ${name}`, () => {
  assert.equal(read(replace(heading, opening + heading + closing)), null)
})

for (const attribute of [
  'ng-if="true"', 'data-ng-if="empty"', 'ng:if="empty"', 'ng-show="empty"',
  'ng-hide="hasJobs"', 'ng-repeat="position in positions"', 'ng-switch="state"',
  'ng-class="state"', 'ng-style="state"', 'ng-bind="emptyLabel"',
  'v-if="empty"', 'v-else', 'v-show="empty"', 'class="ng-hide"',
]) test(`rejects a conditional native marker: ${attribute}`, () => {
  const html = attribute.startsWith('class=')
    ? replace(heading, `<h2 class="polygot ng-hide">%LABEL_NO_POSITIONS%</h2>`)
    : replace(emptyContainer, `<div class="no-positions-container" ${attribute}>`)
  assert.equal(read(html), null)
})

test('rejects conditional ancestors of the empty marker', () => {
  assert.equal(read(replace('ng-app="PortalApp"', 'ng-app="PortalApp" ng-if="ready"')), null)
})

for (const href of ['/p/engineer', 'https://any-do.breezy.hr/p/engineer', '/p%2Fengineer', '/P/ENGINEER', 'https://other.breezy.hr/p/engineer']) {
  test(`rejects a contradictory active role anchor: ${href}`, () => {
    assert.equal(read(injectBody(`<a href="${href}">Software Engineer</a>`)), null)
  })
}

test('rejects a contradictory active structured JobPosting', () => {
  assert.equal(read(injectBody('<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>')), null)
})

test('ignores inert role-anchor copies without treating them as observed roles', () => {
  const observation = read(injectBody('<template><a href="/p/engineer">Software Engineer</a></template>'))
  assert.ok(observation)
  assert.equal(observation.boardEmptyStateObserved, true)
  assert.equal(observation.observedRoleLinks, 0)
  assert.equal(observation.reportedTotal, null)
})
