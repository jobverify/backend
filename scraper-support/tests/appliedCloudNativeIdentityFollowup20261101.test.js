import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parse } from 'acorn'
import * as applied from '../../scraper/appliedcloudcomputing/script.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const text = readFileSync(new URL('./wave7baScript.test.js', import.meta.url), 'utf8')
const ast = parse(text, { sourceType: 'module', ecmaVersion: 'latest' })
const literal = n => n.type === 'Literal' ? n.value : n.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked
  : n.type === 'ArrayExpression' ? n.elements.map(literal) : n.type === 'ObjectExpression' ? Object.fromEntries(n.properties.map(p => [p.key.name ?? p.key.value, literal(p.value)])) : assert.fail('Unsupported static fixture')
const value = name => literal(ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations).find(n => n.id.name === name).init)
const legacyBoard = value('appliedCloudBoardHtml')
const capture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/appliedcloudcomputing/native-captures/ownership-20261101.json.gz', import.meta.url))))
const packet = label => capture.packets.find(p => p.label === label)
const nativeListing = JSON.parse(packet('listing').bodyUTF8), nativeDetail = JSON.parse(packet('detail').bodyUTF8)
const provider = getScraperCatalog().find(p => p.source === applied.SOURCE)
const clock = packet('listing').completedAt
const listingURL = applied.PROVIDER_METADATA.config.discovery.listingApiUrl + '?limit=100&country=in&offset=0'
const model = () => ({
  board: legacyBoard,
  // Synthetic envelope only; the complete four-row packet remains unchanged.
  listing: { ...structuredClone(nativeListing), totalFound: 1, content: [structuredClone(nativeListing.content.find(row => row.id === nativeDetail.id))] },
  detail: structuredClone(nativeDetail),
})
const transport = data => {
  const calls = [], snapshots = []
  return { calls, fetchText: async url => { calls.push(url); assert.equal(url, applied.BOARD_URL); return data.board }, fetchJson: async url => {
    calls.push(url); assert.ok(url === listingURL || url === nativeListing.content[0].ref)
    const result = structuredClone(url === listingURL ? data.listing : data.detail)
    snapshots.push([result, structuredClone(result)]); return result
  }, unchanged() { for (const [body, snapshot] of snapshots) assert.deepEqual(body, snapshot) } }
}
const invoke = (route, input) => (route === 'factory' ? applied.createAppliedCloudComputingScraper() : createCatalogScraper(provider)).run(input)
const href = 'href="https://www.appliedcloudcomputing.com/"'
const anchor = /<a href="https:\/\/www\.appliedcloudcomputing\.com\/">Applied Cloud Computing<\/a>/
const negatives = [
  ['owned-first duplicate href', d => { d.board = d.board.replace(href, href + ' href="https://controlled-foreign.example/"') }],
  ['foreign-first duplicate href', d => { d.board = d.board.replace(href, 'href="https://controlled-foreign.example/" ' + href) }],
  ['identical repeated raw href', d => { d.board = d.board.replace(href, href + ' ' + href) }],
  ['duplicate href with unquoted less-than noise', d => { d.board = d.board.replace(href, href + ' href="https://controlled-foreign.example/" data-noise=broken<a ' + href) }],
  ['publication UUID conflict', d => { d.detail.uuid = nativeListing.content[1].uuid }],
  ['job-ad UUID conflict', d => { d.detail.jobAdId = nativeListing.content[1].jobAdId }],
  ['default-ad conflict', d => { d.detail.defaultJobAd = !d.listing.content[0].defaultJobAd }],
  ['referral account conflict', d => { d.detail.referralUrl = d.detail.referralUrl.replace('/company/AppliedCloudComputing/', '/company/ControlledForeignAccount/') }],
  ['referral UUID conflict', d => { d.detail.referralUrl = d.detail.referralUrl.replace(d.detail.uuid, nativeListing.content[1].uuid) }],
  ['referral query namespace conflict', d => { d.detail.referralUrl = d.detail.referralUrl.replace('?dcr_ci=AppliedCloudComputing', '?dcr_ci=ControlledForeignAccount') }],
  ['detail date conflict', d => { d.detail.releasedDate = '2026-10-31T07:11:51.063Z' }],
  ['inactive detail', d => { d.detail.active = false }],
  ['private detail', d => { d.detail.visibility = 'PRIVATE' }],
  ['inactive listing', d => { d.listing.content[0].active = false }],
  ['private listing', d => { d.listing.content[0].visibility = 'PRIVATE' }],
  ['foreign provided detail ref', d => { d.detail.ref = d.listing.content[0].ref.replace('/AppliedCloudComputing/', '/ControlledForeignAccount/') }],
  ['foreign provided listing posting URL', d => { d.listing.content[0].postingUrl = d.detail.postingUrl.replace('/AppliedCloudComputing/', '/ControlledForeignAccount/') }],
  ['foreign provided listing apply URL', d => { d.listing.content[0].applyUrl = d.detail.applyUrl.replace('/AppliedCloudComputing/', '/ControlledForeignAccount/') }],
  ['empty supplied detail company', d => { d.detail.company = {} }],
  ['null supplied detail company', d => { d.detail.company = null }],
  ['conflicting supplied internal jobId', d => { d.listing.content[0].jobId = nativeListing.content[1].uuid }],
  ['active descendant interception', d => { d.board = d.board.replace(anchor, '<a href="https://www.appliedcloudcomputing.com/"><strong onclick="event.preventDefault()">Applied Cloud Computing</strong></a>') }],
  ['foreign-only visible handoff', d => { d.board = d.board.replace(href, 'href="https://controlled-foreign.example/"') }],
]
for (const route of ['factory', 'registry']) {
  for (const [name, mutate] of negatives) test('Applied native follow-up ' + route + ' rejects ' + name, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
    const data = model(); mutate(data); const snapshot = structuredClone(data), input = transport(data)
    await assert.rejects(invoke(route, input), error => error.code === 'APPLIED_CLOUD_OWNERSHIP_MISMATCH' && error.incompleteScope === true && error.abortRetries === true)
    if (/href|handoff|interception/.test(name)) assert.deepEqual(input.calls, [applied.BOARD_URL])
    assert.deepEqual(data, snapshot); input.unchanged()
  })
  for (const [index, descendant] of [
    '<template>Unrelated inert child</template>',
    '<template><a href="https://www.appliedcloudcomputing.com/" onclick="event.preventDefault()">Inert text</a></template>',
    '<script>const ignored = "<a href=\'https://controlled-foreign.example/\'>inactive</a>";</script>',
  ].entries()) test('Applied native follow-up ' + route + ' ignores definitely excluded label child: ' + index, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
    const data = model(); data.board = data.board.replace(anchor, '<a href="https://www.appliedcloudcomputing.com/">Applied Cloud Computing' + descendant + '</a>')
    const input = transport(data), jobs = await invoke(route, input)
    assert.equal(jobs.length, 1); assert.equal(jobs[0].postingDate, nativeDetail.releasedDate)
    assert.equal(jobs[0].jobDescription, nativeDetail.jobAd.sections.jobDescription.text)
    assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory'); input.unchanged()
  })
}

test('Applied native follow-up retains ASCII raw-end grammar and full unknown tag spelling', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  for (const space of ['\u00a0', '\u000b', '\u2003']) {
    const data = model()
    data.board = data.board.replace('<body>', '<body><script>const ignored="</script' + space + '><a href=\'https://www.appliedcloudcomputing.com/\'>Raw ghost</a>";</script>')
    const jobs = await invoke('registry', transport(data)); assert.equal(jobs.length, 1)
  }
  const unknown = model()
  unknown.board = unknown.board.replace('<body>', '<body><a\u00a0 href="https://www.appliedcloudcomputing.com/">Unknown tag only</a\u00a0>')
  assert.equal((await invoke('registry', transport(unknown))).length, 1)
})

test('Applied native follow-up permits absent legacy optional fields and distinct internal jobId without date renewal', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  const data = model()
  assert.notEqual(data.detail.jobId, data.detail.id); assert.notEqual(data.detail.jobId, data.detail.uuid)
  for (const key of ['uuid', 'jobAdId', 'defaultJobAd']) { delete data.listing.content[0][key]; delete data.detail[key] }
  delete data.detail.company; delete data.detail.referralUrl
  delete data.detail.active; delete data.detail.visibility; delete data.listing.content[0].visibility
  const input = transport(data), snapshot = structuredClone(data), jobs = await invoke('registry', input)
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobId, nativeDetail.id)
  assert.equal(jobs[0].postingDate, nativeDetail.releasedDate)
  assert.equal(jobs[0].sourceUrl, nativeDetail.postingUrl); assert.equal(jobs[0].applyUrl, nativeDetail.applyUrl)
  assert.deepEqual(data, snapshot); input.unchanged()
})

test('Applied native follow-up preserves literal current native namespaces and sample facts', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  const data = model(); data.board = packet('official').bodyUTF8
  const input = transport(data), jobs = await invoke('registry', input)
  assert.equal(jobs.length, 1); assert.equal(jobs[0].title, ' Cloud Network Security Engineer ')
  assert.equal(jobs[0].requisitionId, 'REF94E'); assert.equal(jobs[0].postingDate, '2026-08-13T07:11:51.063Z')
  assert.equal(jobs[0].applyUrl, nativeDetail.postingUrl + '?oga=true')
  assert.equal(jobs[0].jobDescription, nativeDetail.jobAd.sections.jobDescription.text)
  assert.ok(jobs[0].sourceGlobalJobCount == null && jobs[0].sourceIndiaJobCount == null && jobs[0].sourceScopeComplete !== true)
  assert.equal(nativeListing.content.length, 4); assert.equal(nativeListing.totalFound, 4)
  input.unchanged()
})
