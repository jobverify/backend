import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { setImmediate } from 'node:timers/promises'
import * as source from './script.js'
import { hashWorkdayProof, workdayInventoryIdentity, WORKDAY_COUNTRY_INVENTORY_PROOF as PROOF } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { createCatalogScraper, decorateJobsWithProviderMetadata, getScraperCatalog, loadProviderExtensions } from '../../scraper-support/providers/index.js'
import { acquireWorkdaySourceAdmission } from '../../scraper-support/shared/workdaySourceAdmission.js'
import { traceRetryPressure, getRetryPressure } from '../../scraper-support/utils/retryPressure.js'
import { runScraperWithTimeout } from '../../scraper-support/runner.js'

const directory = path.dirname(fileURLToPath(import.meta.url))
const actual = JSON.parse(gunzipSync(fs.readFileSync(path.join(directory, 'fixtures/native-cohort-five-packets.fixture.json.gz'))))
const actualPayload = JSON.parse(actual.nativePackets.find(packet => packet.name === 'foreign-detail-sample').bodyText)
const API = 'https://greendotcorp.wd1.myworkdayjobs.com/wday/cxs/greendotcorp/gdc'
const CANONICAL = 'https://greendotcorp.wd1.myworkdayjobs.com/GDC'
const OFFICIAL = 'https://www.greendot.com/working-here'
const BOARD = 'https://greendotcorp.wd1.myworkdayjobs.com/en-us/gdc'
const NOW = '2026-10-31T18:15:35.268Z'
const clone = value => structuredClone(value)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const country = code => code === 'IN' ? { descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e', alpha2Code: 'IN' } : { descriptor: 'United States of America', id: 'bc33aa3152ec42d4995f4791a106ed09', alpha2Code: 'US' }
// Deliberately hypothetical same-schema controls; never native capture evidence.
const control = (index, code = 'IN') => {
  const payload = clone(actualPayload), id = `TEST${index}`, title = `Hypothetical test role ${index}`
  const location = code === 'IN' ? 'Pune, Maharashtra, India' : 'United States, USA'
  const externalPath = `/job/${code === 'IN' ? 'Pune-India' : 'United-States-USA'}/Hypothetical-role_${id}`
  Object.assign(payload.jobPostingInfo, { id: String(index).repeat(32), title, jobReqId: id, jobPostingId: externalPath.split('/').at(-1), country: country(code), location,
    externalUrl: CANONICAL + externalPath, jobDescription: '<p>Build and maintain the team payment service, investigate incidents and review production changes.</p>',
    jobRequisitionLocation: { descriptor: location, country: country(code) } })
  return { row: { title, externalPath, locationsText: location }, payload, scope: code === 'IN' ? 'india' : 'foreign' }
}
const response = (url, text, type = 'application/json', status = 200) => {
  const value = new Response(text, { status, headers: { 'content-type': type } })
  return { url, status, ok: status === 200, headers: value.headers, body: value.body }
}
const harness = ({ controls = [control(1)], actualRows, payloads, engineError, officialHTML, boardHTML, hook, closingChange, inheritedEmpty = false, timeoutMs = 20000, scheduler } = {}) => {
  assert.equal(typeof source.createGreendotCollector, 'function', 'The sentinel lacks the reviewed source-local native collector')
  const rows = actualRows || controls.map(item => item.row)
  const map = payloads || new Map(controls.map(item => [item.row.externalPath, item.payload]))
  const locations = new Map(controls.map(item => [item.row.externalPath, item.scope]))
  const ids = rows.map(workdayInventoryIdentity).sort(), digest = hashWorkdayProof(JSON.stringify(ids))
  const engineProof = { scope: 'complete-board-country-proof', boardReceipt: { board: 'https://greendotcorp.wd1.myworkdayjobs.com/gdc', syntheticUnitProof: true },
    initial: { count: rows.length, reportedTotal: rows.length, sha256: digest }, closing: { count: rows.length, reportedTotal: rows.length, sha256: digest },
    listingRoles: rows.map(row => ({ ...clone(row), url: 'https://greendotcorp.wd1.myworkdayjobs.com/gdc' + row.externalPath })),
    roles: rows.map(row => ({ url: 'https://greendotcorp.wd1.myworkdayjobs.com/gdc' + row.externalPath, locations: [row.locationsText], countryScopes: [].concat(locations.get(row.externalPath) || 'foreign') })) }
  const calls = [], engineCalls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    const overridden = await hook?.(url, init, calls)
    if (overridden) return overridden
    if (url === OFFICIAL) return response(url, officialHTML ?? `<a href="${BOARD}">Job search</a>`, 'text/html')
    if (url === BOARD) return response(url, boardHTML ?? `<link rel="canonical" href="${CANONICAL}"><script>window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};</script>`, 'text/html')
    if (url === API + '/jobs') {
      const body = JSON.parse(init.body), all = closingChange ? closingChange(clone(rows)) : rows
      return response(url, JSON.stringify({ total: body.offset ? 0 : all.length, jobPostings: all.slice(body.offset, body.offset + body.limit), facets: [], userAuthenticated: false }))
    }
    const externalPath = url.slice(API.length)
    if (map.has(externalPath)) return response(url, JSON.stringify(map.get(externalPath)))
    throw new Error('Controlled unread native detail: ' + externalPath)
  }
  const runEngine = async options => { engineCalls.push(options); if (engineError) throw engineError; const jobs = []; Object.defineProperty(jobs, PROOF, { value: engineProof });
    if (inheritedEmpty) { Object.defineProperty(jobs, Symbol.for('jobverify.workday.authoritative-empty'), { value: true }); Object.assign(engineProof, { engineIndiaFacetCount: 0, engineVerifiedAt: NOW }) }
    return jobs }
  const dependencies = { fetchImpl, runEngine, requestScheduler: scheduler || { acquire: async () => () => {} }, now: () => NOW, requestTimeoutMs: timeoutMs }
  const collector = source.createGreendotCollector(dependencies)
  return { collector, dependencies, calls, engineCalls, engineProof, rows, map }
}

test('actual captured US schema preserves thirty observations and twenty-nine unread DTOs without a certified India zero', async () => {
  const h = harness({ actualRows: actual.literalOpeningRows, payloads: new Map([[actual.literalOpeningRows.find(row => row.externalPath.endsWith('_R4180')).externalPath, actualPayload]]) })
  const jobs = await h.collector.run()
  assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'greendot').observedVacancyCount, 30)
  assert.equal(jobs[PROOF].rawNativeObservations.filter(row => row.qualification === 'unread').length, 29)
  assert.equal(jobs[PROOF].rawNativeObservations.find(row => row.qualification === 'foreign').nativePayload.hiringOrganization.name, 'Green Dot Corporation')
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(jobs[PROOF].engineCountryProof, h.engineProof, 'Keep the original proof as an intermediate nested input, never invent a receipt')
})

test('hypothetical healthy India plus missing native JD preserves both independently bound vacancies and raw bytes', async () => {
  const a = control(1), b = control(2); b.payload.jobPostingInfo.jobDescription = ''
  const h = harness({ controls: [a, b] }), jobs = await h.collector.run()
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[1].sourceDetailComplete, false)
  assert.equal(jobs[1].sourceDetailFailureKind, 'missing-content')
  assert.equal(jobs[1].sourceDescription, '')
  assert.equal(jobs[1].jobDescription, null)
  assert.equal(jobs[0].sourceDescription, a.payload.jobPostingInfo.jobDescription)
  assert.equal(jobs[0].company, 'Green Dot')
  assert.equal(jobs[0].nativeEmployer, 'Green Dot Corporation')
  assert.equal(jobs[0].link, a.payload.jobPostingInfo.externalUrl)
  assert.equal(jobs[0].sourceScopeComplete, false)
})

test('hypothetical healthy India survives an unread foreign closing role without declaring that role foreign', async () => {
  const a = control(1), b = control(2, 'US'), h = harness({ controls: [a, b], payloads: new Map([[a.row.externalPath, a.payload]]) })
  const jobs = await h.collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[PROOF].rawNativeObservations[1].qualification, 'unread')
  assert.equal(jobs[PROOF].rawNativeObservations[1].nativeCountry, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

for (const [name, mutate] of [
  ['API-like canonical case', p => { p.jobPostingInfo.jobPostingSiteId = 'gdc'; p.jobPostingInfo.externalUrl = p.jobPostingInfo.externalUrl.replace('/GDC/', '/gdc/') }],
  ['mixed-case site', p => { p.jobPostingInfo.jobPostingSiteId = 'GdC' }],
  ['wrong tenant', p => { p.jobPostingInfo.externalUrl = p.jobPostingInfo.externalUrl.replace('greendotcorp.', 'other.') }],
  ['wrong native posting ID', p => { p.jobPostingInfo.jobPostingId += '-changed' }],
  ['wrong title', p => { p.jobPostingInfo.title += ' changed' }],
  ['wrong native requisition', p => { p.jobPostingInfo.jobReqId = 'OTHER1' }],
  ['other employer', p => { p.hiringOrganization.name = 'Other Company' }],
  ['similar employer', p => { p.hiringOrganization.name = 'Green Dot Corporation Services' }],
  ['missing employer', p => { delete p.hiringOrganization }],
  ['contradictory typed countries', p => { p.jobPostingInfo.jobRequisitionLocation.country = country('US') }],
  ['contradictory native country identifier', p => { p.jobPostingInfo.country.id = country('US').id }],
  ['unknown native country', p => { p.jobPostingInfo.country = { descriptor: 'Unknown' } }],
  ['future native start date', p => { p.jobPostingInfo.startDate = '2027-01-01' }],
  ['invalid native calendar date', p => { p.jobPostingInfo.startDate = '2026-02-30' }],
  ['closed native role', p => { p.jobPostingInfo.canApply = false }],
  ['contradictory supplied application URL', p => { p.jobPostingInfo.applyUrl = 'https://other.example/apply' }],
]) test(`exact raw ${name} conflict remains unqualified while another hypothetical India positive survives`, async () => {
  const a = control(1), b = control(2); mutate(b.payload)
  const jobs = await harness({ controls: [a, b] }).collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[PROOF].rawNativeObservations[1].qualification, 'unqualified')
  assert.ok(jobs[PROOF].rawNativeObservations[1].nativePayload)
})

for (const value of ['', 'TBD', '<p>TBD</p>', '<div hidden>Build payment services.</div>', '<style>.secret{display:none}</style><div class="secret">Build payment services.</div>']) test(`hypothetical native unsupported JD ${JSON.stringify(value)} retains an identity-bound partial India role`, async () => {
  const a = control(1); a.payload.jobPostingInfo.jobDescription = value
  const jobs = await harness({ controls: [a] }).collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDescription, value)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].publicExperienceChecked, false)
})

test('visible substantive normalized JD excludes hidden criteria while full native JD remains exact', async () => {
  const a = control(1); a.payload.jobPostingInfo.jobDescription += '<style>.secret{display:none}</style><div class="secret">HIDDEN_MARKER</div>'
  const jobs = await harness({ controls: [a] }).collector.run()
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.ok(!jobs[0].jobDescription.includes('HIDDEN_MARKER'))
  assert.equal(jobs[0].sourceDescription, a.payload.jobPostingInfo.jobDescription)
})

test('engine failure before a complete candidate proof propagates without enabling partial country mode', async () => {
  const error = Object.freeze(new Error('Engine failed before safe candidates'))
  const h = harness({ engineError: error })
  await assert.rejects(h.collector.run(), value => value === error)
  assert.equal(h.calls.filter(call => call.url.startsWith(API)).length, 0)
})

test('fixed lower API engine config cannot be replaced by caller identity options', async () => {
  const h = harness()
  await h.collector.run({ source: 'other', company: 'Other', baseUrl: CANONICAL, scraperDir: 'other', boardIdentityVerified: false })
  assert.equal(h.engineCalls[0].source, 'greendot')
  assert.equal(h.engineCalls[0].company, 'Green Dot')
  assert.equal(h.engineCalls[0].baseUrl, 'https://greendotcorp.wd1.myworkdayjobs.com/gdc')
  assert.equal(h.engineCalls[0].detailEnrichmentBudgetMs, 0)
})

test('a closing listing identity mutation rejects the source even when one detail was otherwise qualified', async () => {
  await assert.rejects(harness({ closingChange: rows => rows.map(row => ({ ...row, title: row.title + ' stale' })) }).collector.run(), /closing/i)
})

for (const [name, html] of [
  ['disabled handoff', `<a aria-disabled="true" href="${BOARD}">Job search</a>`],
  ['hidden ancestor', `<div style="opacity:0"><a href="${BOARD}">Job search</a></div>`],
  ['author CSS-hidden handoff', `<style>a{display:none!important}</style><a href="${BOARD}">Job search</a>`],
]) test(`${name} fails before native board or engine execution`, async () => {
  const h = harness({ officialHTML: html })
  await assert.rejects(h.collector.run(), /handoff/i)
  assert.equal(h.engineCalls.length, 0)
  assert.equal(h.calls.length, 1)
})

for (const [name, script] of [
  ['wrong API site', 'window.workday=window.workday||{tenant:"greendotcorp",siteId:"GDC",locale:"en-US",isExternal:true,appName:"cxs"};'],
  ['unreachable binding', 'if(false){window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};}'],
  ['duplicate identity key', 'window.workday=window.workday||{tenant:"other",tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};'],
  ['later overwrite', 'window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};window.workday.siteId="other";'],
  ['computed literal overwrite', 'window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};window.workday["siteId"]="other";'],
  ['delete identity', 'window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};delete window.workday;'],
  ['global identity replacement', 'window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};workday={};'],
  ['preceding terminating statement', 'throw new Error("unreachable");window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};'],
  ['preceding nonterminating statement', 'while(true){}window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};'],
  ['hoisted shadowing binding', 'window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};let window;'],
]) test(`native bootstrap ${name} is not identity authority`, async () => {
  const h = harness({ boardHTML: `<link rel="canonical" href="${CANONICAL}"><script>${script}</script>` })
  await assert.rejects(h.collector.run(), /bootstrap|identity/i)
  assert.equal(h.engineCalls.length, 0)
})

test('default source transport keeps exact manual URLs/method/body and does not change global fetch', async () => {
  const before = globalThis.fetch, h = harness()
  await h.collector.run()
  assert.equal(globalThis.fetch, before)
  assert.equal(h.calls[0].url, OFFICIAL)
  assert.ok(h.calls.every(call => call.init.redirect === 'manual'))
  assert.deepEqual(JSON.parse(h.calls.find(call => call.url === API + '/jobs').init.body), { appliedFacets: {}, limit: 20, offset: 0, searchText: '' })
})

test('caller abort waits for a noncooperative peer to settle, keeps exact reason and retains admission until finally-release', async t => {
  const a = control(1), b = control(2), started = deferred(), settle = deferred(), controller = new AbortController(), reason = Object.freeze(new Error('Controlled caller deadline'))
  let active = 0
  const h = harness({ controls: [a, b], hook: async (url, init) => {
    if (!url.startsWith(API + '/job/')) return
    active++
    if (active === 2) started.resolve()
    await settle.promise
    throw new Error('Replacement fetch failure after caller abort')
  } })
  const stagedDirectory = path.resolve(directory, '../greendot.workday')
  const scraper = { provider: { atsPlatform: 'workday', sourceDirectory: stagedDirectory } }
  const lease = await acquireWorkdaySourceAdmission(scraper)
  t.after(() => lease?.release())
  assert.ok(lease)
  const operation = h.collector.run({ signal: AbortSignal.any([lease.signal, controller.signal]) }).finally(() => lease.release())
  const rejected = assert.rejects(operation, value => value === reason)
  await started.promise
  controller.abort(reason)
  let finished = false; operation.then(() => { finished = true }, () => { finished = true })
  let admitted = false
  const queued = acquireWorkdaySourceAdmission(scraper).then(next => { admitted = true; return next })
  await setImmediate()
  assert.equal(finished, false)
  assert.equal(admitted, false)
  settle.resolve()
  await rejected
  const next = await queued; next.release()
  assert.equal(admitted, true)
})

test('own body deadline preserves the exact abort cause instead of a replacement stream error', async () => {
  let nativeReason
  const h = harness({ timeoutMs: 10, hook: async (url, init) => {
    if (!url.startsWith(API + '/job/')) return
    return { url, status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({ read: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => { nativeReason = init.signal.reason; reject(new Error('replacement stream error')) }, { once: true })), cancel: async () => {} }) } }
  } })
  await assert.rejects(h.collector.run(), error => error === nativeReason && error.name === 'GreendotNativeRequestTimeoutError')
})

test('typed observation and raw unknown roles survive real provider decoration with null authoritative totals', async () => {
  const h = harness({ actualRows: actual.literalOpeningRows, payloads: new Map() }), jobs = await h.collector.run()
  const provider = getScraperCatalog().find(row => row.source === 'greendot')
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.equal(decorated[PROOF].rawNativeObservations.length, 30)
  assert.equal(readSourceObservationEvidence(decorated, 'greendot').observedVacancyCount, 30)
  assert.equal(readInventoryEvidence(decorated).reportedTotal, null)
})

const stagedProvider = () => {
  const filename = path.resolve(directory, '../../scraper-support/providers/providerExtensions/zzzzzzzzzzzzzz-greendot-native-workday-20261101.json')
  const overrides = JSON.parse(fs.readFileSync(filename))
  return getScraperCatalog({ providerExtensions: [...loadProviderExtensions(), ...overrides] }).find(provider => provider.source === 'greendot')
}

test('real createCatalogScraper uses the intended Workday bridge and preserves empty-array raw unknown observations without inherited empty authority', async () => {
  const h = harness({ actualRows: actual.literalOpeningRows, payloads: new Map(), inheritedEmpty: true }), provider = stagedProvider()
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath.replaceAll('\\', '/'), /\/scraper\/greendot\.workday\/script\.js$/)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  const jobs = await createCatalogScraper(provider).run(h.dependencies)
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].scope, 'greendot-source-local-native-observations')
  assert.equal(jobs[PROOF].sourceScopeComplete, false)
  assert.equal(jobs[PROOF].rawNativeObservations.length, 30)
  assert.equal(jobs[Symbol.for('jobverify.workday.authoritative-empty')], undefined)
  assert.equal(readSourceObservationEvidence(jobs, 'greendot').observedVacancyCount, 30)
  assert.deepEqual([readInventoryEvidence(jobs).status, readInventoryEvidence(jobs).reportedTotal, readInventoryEvidence(jobs).indiaFacetCount, readInventoryEvidence(jobs).verifiedAt], ['coverage-gap', null, null, null])
})

test('real registered provider decoration preserves hypothetical healthy India plus unread foreign partial scope and raw native JD', async () => {
  const a = control(1), b = control(2, 'US'), h = harness({ controls: [a, b], payloads: new Map([[a.row.externalPath, a.payload]]) })
  const jobs = await createCatalogScraper(stagedProvider()).run(h.dependencies)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDescription, a.payload.jobPostingInfo.jobDescription)
  assert.equal(jobs[0].nativeEmployer, 'Green Dot Corporation')
  assert.equal(jobs[PROOF].rawNativeObservations[1].qualification, 'unread')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('actual captured official/bootstrap HTML establishes the split identities without executing native JS', async () => {
  const h = harness({ controls: [{ row: actual.literalOpeningRows.find(row => row.externalPath.endsWith('_R4180')), payload: actualPayload, scope: 'foreign' }],
    officialHTML: fs.readFileSync(path.join(directory, 'fixtures/official-careers-20261031.html'), 'utf8'), boardHTML: fs.readFileSync(path.join(directory, 'fixtures/workday-bootstrap-20261031.html'), 'utf8') })
  const jobs = await h.collector.run()
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'foreign')
  assert.equal(jobs[PROOF].rawNativeObservations[0].nativePayload.jobPostingInfo.jobPostingSiteId, 'GDC')
  assert.equal(jobs[PROOF].rawNativeObservations[0].nativePayload.jobPostingInfo.jobDescription, actualPayload.jobPostingInfo.jobDescription)
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null)
})

test('contradictory additional typed native country cannot be hidden behind a valid India primary', async () => {
  const a = control(1); a.payload.jobPostingInfo.additionalLocations = [{ descriptor: 'Controlled second workplace', country: { ...country('IN'), alpha2Code: 'US' } }]
  const jobs = await harness({ controls: [a] }).collector.run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unqualified')
})

test('a supplied missing primary typed country cannot inherit India from the listing or another role', async () => {
  const a = control(1), b = control(2); delete b.payload.jobPostingInfo.country
  const jobs = await harness({ controls: [a, b] }).collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[PROOF].rawNativeObservations[1].qualification, 'unqualified')
})

for (const status of [401, 403, 429]) test(`native denial ${status} stops the source without retry, fallback or foreign certification`, async () => {
  let requests = 0
  const h = harness({ hook: async url => { if (url.startsWith(API + '/job/')) { requests++; return response(url, '{"denied":true}', 'application/json', status) } } })
  let failure
  await assert.rejects(h.collector.run(), error => { failure = error; return error.status === status })
  assert.equal(requests, 1)
  assert.equal(failure.greendotPartialEvidence.nativeObservations[0].qualification, 'unread')
  assert.equal(failure.greendotPartialEvidence.companyIndiaTotal, null)
  assert.equal(h.calls.some(call => call.url === API + '/jobs'), false)
})

for (const [name, transform] of [
  ['duplicate contradictory native identity key', text => text.replace('"jobPostingSiteId":"GDC"', '"jobPostingSiteId":"Other","jobPostingSiteId":"GDC"')],
  ['explicit native failure envelope', text => text.replace('{', '{"success":false,')],
]) test(`${name} cannot hide behind otherwise valid native role fields`, async () => {
  const a = control(1), b = control(2)
  const h = harness({ controls: [a, b], hook: async url => { if (url === API + b.row.externalPath) return response(url, transform(JSON.stringify(b.payload))) } })
  const jobs = await h.collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[PROOF].rawNativeObservations[1].qualification, 'unread')
  assert.ok(jobs[PROOF].rawNativeObservations[1].receipt.rawText)
})

test('caller abort after a noncooperative header fetch waits for returned body cancellation to settle', { timeout: 2000 }, async t => {
  const entered = deferred(), headers = deferred(), cancelEntered = deferred(), cancelSettled = deferred(), controller = new AbortController(), reason = Object.freeze(new Error('Abort before delayed headers'))
  t.after(() => { headers.resolve(); cancelSettled.resolve() })
  const h = harness({ hook: async url => {
    if (!url.startsWith(API + '/job/')) return
    entered.resolve(); await headers.promise
    return { url, status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({ read: async () => { throw new Error('body must not be read after abort') }, cancel: async () => { cancelEntered.resolve(); await cancelSettled.promise } }) } }
  } })
  const operation = h.collector.run({ signal: controller.signal })
  const rejected = assert.rejects(operation, error => error === reason)
  await entered.promise
  controller.abort(reason); headers.resolve()
  let finished = false; operation.catch(() => { finished = true })
  await setImmediate()
  assert.equal(finished, false, 'A returned unconsumed body must settle before source release')
  await cancelEntered.promise
  cancelSettled.resolve()
  await rejected
})

for (const [field, value] of [['applyUrl', 'https://other.example/apply'], ['postingUrl', CANONICAL + '/job/Other/Other_TEST9']]) test(`contradictory supplied closing listing ${field} cannot be overwritten by a genuine detail URL`, async () => {
  await assert.rejects(harness({ closingChange: rows => rows.map(row => ({ ...row, [field]: value })) }).collector.run(), /listing.*URL/i)
})

test('supplied top-level native application URL is checked independently of jobPostingInfo.externalUrl', async () => {
  const a = control(1), b = control(2); b.payload.applicationUrl = 'https://other.example/apply'
  const jobs = await harness({ controls: [a, b] }).collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[PROOF].rawNativeObservations[1].qualification, 'unqualified')
})

test('concordant supplied closing listing URLs preserve the exact canonical URL', async () => {
  const jobs = await harness({ closingChange: rows => rows.map(row => ({ ...row, applyUrl: CANONICAL + row.externalPath, postingUrl: CANONICAL + row.externalPath })) }).collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].link, CANONICAL + control(1).row.externalPath)
})

test('an oversized per-role body is cancelled and settled before preserving another safe India positive', { timeout: 2000 }, async t => {
  const a = control(1), b = control(2, 'US'), readStarted = deferred(), cancelled = deferred(), settle = deferred()
  t.after(() => settle.resolve())
  const h = harness({ controls: [a, b], hook: async url => {
    if (url !== API + b.row.externalPath) return
    return { url, status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({
      read: async () => { readStarted.resolve(); return { done: false, value: new Uint8Array(2 * 1024 * 1024 + 1) } },
      cancel: async () => { cancelled.resolve(); await settle.promise },
    }) } }
  } })
  const operation = h.collector.run()
  await readStarted.promise
  let finished = false; operation.then(() => { finished = true }, () => { finished = true })
  await setImmediate()
  assert.equal(finished, false, 'An oversize response must release its actual reader before source settlement')
  await cancelled.promise
  settle.resolve()
  const jobs = await operation
  assert.equal(jobs.length, 1)
  assert.equal(jobs[PROOF].rawNativeObservations[1].qualification, 'unread')
})

// Each mutation changes the observed, otherwise valid script itself. The engine
// marker must stay unreachable; none of this native JavaScript is executed.
const actualBootstrap = fs.readFileSync(path.join(directory, 'fixtures/workday-bootstrap-20261031.html'), 'utf8')
for (const [name, suffix] of [
  ['Object.defineProperty global replacement', ';Object.defineProperty(window,"workday",{value:{tenant:"other",siteId:"wrong"}});'],
  ['globalThis Workday replacement', ';globalThis.workday={tenant:"other",siteId:"wrong"};'],
  ['literal Workday alias write', ';var rootAlias=window.workday;rootAlias.siteId="wrong";'],
  ['Reflect.set global replacement', ';Reflect.set(window,"workday",{tenant:"other",siteId:"wrong"});'],
  ['global object alias write', ';var rootAlias=window;rootAlias.workday={tenant:"other"};'],
  ['dynamic global property write', ';var key="workday";window[key]={tenant:"other"};'],
  ['dynamic identity property write', ';var key="siteId";window.workday[key]="wrong";'],
  ['computed Reflect mutation', ';Reflect["set"](window.workday,"siteId","wrong");'],
  ['Workday object escape into a parameter', ';function overwrite(cfg){cfg.siteId="wrong"}overwrite(window.workday);'],
  ['shadowed globalThis', ';let globalThis;'],
  ['shadowed reflective builtin', ';let Object;'],
  ['immediate owner nontermination', ';while(true){}'],
  ['immediate owner terminating exception', ';throw new Error("No native client activation");'],
]) test(`review bootstrap ${name} rejects before the native engine`, async () => {
  const marker = Object.freeze(new Error('Controlled engine boundary'))
  const h = harness({ engineError: marker, boardHTML: actualBootstrap.replace('</script>', () => suffix + '</script>') })
  await assert.rejects(h.collector.run(), error => error !== marker && /bootstrap|identity/i.test(error.message))
  assert.equal(h.engineCalls.length, 0)
})

test('review actual finite unshadowed bootstrap still reaches the engine with literal fields intact', async () => {
  const marker = Object.freeze(new Error('Controlled engine boundary'))
  const h = harness({ engineError: marker, boardHTML: actualBootstrap })
  await assert.rejects(h.collector.run(), error => error === marker)
  assert.equal(h.engineCalls.length, 1)
})

test('review typed additional India office preserves its opportunity while primary US bytes remain exact', async () => {
  const a = control(1, 'US'); a.scope = ['foreign', 'india']
  a.payload.jobPostingInfo.additionalLocations = [{ descriptor: 'Pune, Maharashtra, India', country: country('IN') }]
  const jobs = await harness({ controls: [a] }).collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Pune, Maharashtra, India')
  assert.deepEqual(jobs[0].locations, ['Pune, Maharashtra, India'])
  assert.deepEqual(jobs[0].nativeRawJobPostingInfo, a.payload.jobPostingInfo)
  assert.equal(jobs[PROOF].rawNativeObservations[0].nativeCountry.alpha2Code, 'US')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

for (const primary of ['US', 'IN']) test(`review primary ${primary} plus unknown additional office retains qualified offices and unqualified geography`, async () => {
  const a = control(1, primary)
  a.payload.jobPostingInfo.additionalLocations = [{ descriptor: 'Unqualified native additional worksite' }]
  const jobs = await harness({ controls: [a] }).collector.run()
  assert.equal(jobs.length, primary === 'IN' ? 1 : 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unqualified-geography')
  assert.deepEqual(jobs[PROOF].rawNativeObservations[0].unqualifiedNativeLocations, a.payload.jobPostingInfo.additionalLocations)
  assert.equal(jobs[0]?.location ?? null, primary === 'IN' ? a.payload.jobPostingInfo.location : null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('review an India-looking additional descriptor without typed country is never promoted to India', async () => {
  const a = control(1, 'US'); a.payload.jobPostingInfo.additionalLocations = [{ descriptor: 'Pune, Maharashtra, India' }]
  const jobs = await harness({ controls: [a] }).collector.run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unqualified-geography')
})

test('review unknown additional typed country does not erase a known India primary office', async () => {
  const a = control(1); a.payload.jobPostingInfo.additionalLocations = [{ descriptor: 'Unresolved native office', country: { descriptor: 'Unknown' } }]
  const jobs = await harness({ controls: [a] }).collector.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Pune, Maharashtra, India')
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unqualified-geography')
  assert.deepEqual(jobs[PROOF].rawNativeObservations[0].unqualifiedNativeLocations, a.payload.jobPostingInfo.additionalLocations)
})

test('review a newly changed additional India scope absent from the earlier native proof stays unqualified', async () => {
  const a = control(1, 'US'); a.payload.jobPostingInfo.additionalLocations = [{ descriptor: 'Pune, Maharashtra, India', country: country('IN') }]
  const jobs = await harness({ controls: [a] }).collector.run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unqualified')
})

for (const status of [403, 429]) test(`review HTTP ${status} stops queued work and closing while retaining native HTTP metadata and pressure`, async () => {
  const a = control(1), b = control(2), c = control(3), d = control(4), e = control(5)
  const rateLimits = [], detailStarted = [], acquisition = []
  let denialSeen = false
  const scheduler = { acquire: async (url, { signal } = {}) => {
    acquisition.push(url)
    if (url.startsWith(API + '/job/') && !url.endsWith(a.row.externalPath)) {
      while (!denialSeen && !signal.aborted) await setImmediate()
      signal.throwIfAborted()
    }
    return () => {}
  }, recordRateLimit: (url, ms) => rateLimits.push({ url, ms }) }
  const h = harness({ controls: [a, b, c, d, e], scheduler, hook: async url => {
    if (!url.startsWith(API + '/job/')) return
    detailStarted.push(url); denialSeen = true
    const r = response(url, '{"denied":true}', 'application/json', status)
    r.headers.set('retry-after', '5')
    return r
  } })
  const operation = traceRetryPressure(() => h.collector.run())
  let failure
  await assert.rejects(operation, error => { failure = error; return error.status === status })
  assert.deepEqual(detailStarted, [API + a.row.externalPath])
  assert.equal(h.calls.filter(call => call.url === API + '/jobs').length, 0)
  assert.equal(failure.retryAfter, '5')
  assert.equal(failure.abortRetries, true)
  assert.equal(failure.nativeCapture.rawText, '{"denied":true}')
  assert.equal(failure.greendotPartialEvidence.sourceScopeComplete, false)
  assert.equal(failure.greendotPartialEvidence.nativeObservations[0].qualification, 'unread')
  assert.equal(getRetryPressure(operation).httpStatusCounts[status], 1)
  assert.deepEqual(rateLimits, status === 429 ? [{ url: API + a.row.externalPath, ms: 5000 }] : [])
  if (status === 429) assert.equal(failure.retryDelayMs, 5000)
})

test('review denial cancels peers but waits for already-inflight body settlement and preserves healthy data as diagnostics', { timeout: 2000 }, async t => {
  const a = control(1), b = control(2), c = control(3), d = control(4), e = control(5), f = control(6)
  const healthyDone = deferred(), peerEntered = deferred(), denialReturned = deferred(), peerSettles = deferred()
  t.after(() => { healthyDone.resolve(); peerSettles.resolve() })
  let peerSignal, failure, finished = false, startedAtDenial
  const h = harness({ controls: [a, b, c, d, e, f], hook: async (url, init, calls) => {
    if (url === API + a.row.externalPath) { healthyDone.resolve(); return }
    if (url === API + b.row.externalPath) { await healthyDone.promise; await peerEntered.promise; await setImmediate(); startedAtDenial = calls.filter(call => call.url.startsWith(API + '/job/')).length; denialReturned.resolve(); return response(url, '{"denied":true}', 'application/json', 403) }
    if ([c, d, e].some(item => url === API + item.row.externalPath)) {
      peerSignal = init.signal; peerEntered.resolve()
      return { url, status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({
        read: async () => { await peerSettles.promise; throw new Error('Replacement peer body error after denial') }, cancel: async () => {},
      }) } }
    }
  } })
  const operation = h.collector.run()
  operation.then(() => { finished = true }, () => { finished = true })
  const outcome = operation.then(jobs => ({ jobs }), error => ({ error }))
  try {
    await denialReturned.promise; await setImmediate()
    assert.equal(peerSignal.aborted, true)
    assert.equal(finished, false)
  } finally { peerSettles.resolve(); failure = (await outcome).error }
  assert.equal(failure?.status, 403)
  assert.equal(failure.greendotPartialEvidence.qualifiedJobs.some(job => job.jobId === 'TEST1'), true)
  assert.equal(h.calls.some(call => call.url === API + '/jobs'), false)
  assert.equal(h.calls.filter(call => call.url.startsWith(API + '/job/')).length, startedAtDenial)
  assert.ok(startedAtDenial <= 5, 'One completed healthy read plus at most four concurrent native workers')
  assert.equal(h.calls.some(call => call.url === API + f.row.externalPath), false)
})

test('review cancelled peers cannot abort the originating denial body before its own bounded settlement', { timeout: 2000 }, async t => {
  const a = control(1), b = control(2), bodyEntered = deferred(), peerCancelled = deferred(), settleBody = deferred()
  t.after(() => settleBody.resolve())
  let originSignal, delivered = false
  const h = harness({ controls: [a, b], hook: async (url, init) => {
    if (url === API + a.row.externalPath) {
      originSignal = init.signal
      return { url, status: 403, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({
        read: async () => { if (delivered) return { done: true }; delivered = true; bodyEntered.resolve(); await settleBody.promise; return { done: false, value: new TextEncoder().encode('{"denied":true}') } }, cancel: async () => {},
      }) } }
    }
    if (url === API + b.row.externalPath) {
      await new Promise((resolve, reject) => init.signal.aborted ? reject(init.signal.reason) : init.signal.addEventListener('abort', () => { peerCancelled.resolve(); reject(new Error('Peer transport rejected after source denial')) }, { once: true }))
    }
  } })
  const operation = h.collector.run(), outcome = operation.then(jobs => ({ jobs }), error => ({ error }))
  let result
  try {
    await bodyEntered.promise; await peerCancelled.promise; await setImmediate()
    assert.equal(originSignal.aborted, false)
  } finally { settleBody.resolve(); result = await outcome }
  assert.equal(result.error.status, 403)
  assert.equal(result.error.nativeCapture.rawText, '{"denied":true}')
})

test('review caller cancellation during denial body settlement preserves the exact immutable caller cause', async () => {
  const controller = new AbortController(), reason = Object.freeze(new Error('Exact caller reason during HTTP denial'))
  let bodySignal
  const h = harness({ hook: async (url, init) => {
    if (!url.startsWith(API + '/job/')) return
    bodySignal = init.signal
    return { url, status: 403, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({
      read: async () => { controller.abort(reason); throw new Error('Replacement denied body error') }, cancel: async () => {},
    }) } }
  } })
  const operation = traceRetryPressure(() => h.collector.run({ signal: controller.signal }))
  await assert.rejects(operation, error => error === reason)
  assert.equal(bodySignal.aborted, true)
  assert.equal(getRetryPressure(operation).httpStatusCounts[403], 1)
  assert.equal(Object.hasOwn(reason, 'greendotPartialEvidence'), false)
})

test('review the original request deadline outranks HTTP pressure while a denial body is settling', async () => {
  let deadline
  const h = harness({ timeoutMs: 10, hook: async (url, init) => {
    if (!url.startsWith(API + '/job/')) return
    return { url, status: 429, headers: new Headers({ 'content-type': 'application/json', 'retry-after': '5' }), body: { getReader: () => ({
      read: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => { deadline = init.signal.reason; reject(new Error('Replacement denied body failure')) }, { once: true })), cancel: async () => {},
    }) } }
  } })
  const operation = traceRetryPressure(() => h.collector.run())
  await assert.rejects(operation, error => error === deadline && error.name === 'GreendotNativeRequestTimeoutError')
  assert.equal(getRetryPressure(operation).httpStatusCounts[429], 1)
  assert.equal(h.calls.some(call => call.url === API + '/jobs'), false)
})

test('review a denied final listing keeps existing India data only in explicit incomplete error diagnostics', async () => {
  const h = harness({ hook: async url => { if (url === API + '/jobs') return response(url, '{"denied":true}', 'application/json', 403) } })
  let failure
  await assert.rejects(h.collector.run(), error => { failure = error; return error.status === 403 })
  assert.equal(failure.greendotPartialEvidence.finalListingReconciled, false)
  assert.equal(failure.greendotPartialEvidence.qualifiedJobs[0].jobId, 'TEST1')
  assert.equal(h.calls.filter(call => call.url === API + '/jobs').length, 1)
})

test('review a frozen caller cause with HTTP-like fields is preserved during final listing cancellation', async () => {
  const controller = new AbortController(), reason = Object.freeze(Object.assign(new Error('Caller-owned HTTP-like cancellation'), { status: 403 }))
  const h = harness({ hook: async url => {
    if (url !== API + '/jobs') return
    return { url, status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({
      read: async () => { controller.abort(reason); throw new Error('Replacement closing-body failure') }, cancel: async () => {},
    }) } }
  } })
  await assert.rejects(h.collector.run({ signal: controller.signal }), error => error === reason)
  assert.equal(Object.hasOwn(reason, 'greendotPartialEvidence'), false)
})

test('review known final-listing HTTP status survives an ordinary failed denial-body read', async () => {
  const replacement = new Error('Native denial response body reset')
  const h = harness({ hook: async url => {
    if (url !== API + '/jobs') return
    return { url, status: 403, headers: new Headers({ 'content-type': 'application/json', 'retry-after': '5' }), body: { getReader: () => ({
      read: async () => { throw replacement }, cancel: async () => {},
    }) } }
  } })
  await assert.rejects(h.collector.run(), error => error.status === 403 && error.retryAfter === '5' && error.cause === replacement && error.nativeCapture.status === 403)
})

for (const [retryAfter, delay] of [['Sat, 31 Oct 2026 18:15:40 GMT', 4732], ['not-a-date', 5000]]) test(`review native 429 Retry-After ${JSON.stringify(retryAfter)} retains raw metadata and bounded shard cooldown`, async () => {
  const events = [], h = harness({ scheduler: { acquire: async () => () => {}, recordRateLimit: (url, ms) => events.push({ url, ms }) }, hook: async url => {
    if (!url.startsWith(API + '/job/')) return
    const result = response(url, '{"denied":true}', 'application/json', 429); result.headers.set('retry-after', retryAfter); return result
  } })
  await assert.rejects(h.collector.run(), error => error.status === 429 && error.retryAfter === retryAfter)
  assert.deepEqual(events, [{ url: API + control(1).row.externalPath, ms: delay }])
})

for (const code of ['IN', 'US']) test(`v7 direct-summary ${code} with no hydrated entry retains independently checked typed facts`, async () => {
  const a = control(1, code), h = harness({ controls: [a] }); h.engineProof.roles = []
  const before = clone(h.engineProof), jobs = await h.collector.run()
  assert.equal(jobs.length, code === 'IN' ? 1 : 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, code === 'IN' ? 'india' : 'foreign')
  assert.deepEqual(h.engineProof, before, 'An absent hydration receipt is never synthesized or filled')
  assert.equal(h.calls.filter(call => call.url === API + a.row.externalPath).length, 1)
})

for (const label of ['Unknown', '1 location', 'Worldwide', 'India / United States', 'India and United States', 'India, United States']) test(`v7 missing hydrated entry with unqualified listing label ${JSON.stringify(label)} cannot promote a fresh DTO`, async () => {
  const a = control(1); a.row.locationsText = label
  const h = harness({ controls: [a] }); h.engineProof.roles = []
  const jobs = await h.collector.run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unqualified')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

for (const closingCode of ['IN', 'US']) test(`v7 direct-summary scope rejects a contradictory fresh ${closingCode} closing country`, async () => {
  const a = control(1, closingCode === 'IN' ? 'US' : 'IN'), current = control(1, closingCode)
  // Keep the original title/posting URL/ID. Change only the typed workplace
  // fields so this negative reaches the country-drift guard independently.
  for (const field of ['country', 'jobRequisitionLocation', 'location']) a.payload.jobPostingInfo[field] = current.payload.jobPostingInfo[field]
  const h = harness({ controls: [a] }); h.engineProof.roles = []
  const jobs = await h.collector.run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unqualified')
  assert.match(jobs[PROOF].rawNativeObservations[0].reason, /closing country scope/)
})

for (const issuedScopes of [[], ['foreign']]) test(`v7 issued hydrated scopes ${JSON.stringify(issuedScopes)} stay authoritative over direct-summary India`, async () => {
  const h = harness(); h.engineProof.roles[0].countryScopes = issuedScopes
  const before = clone(h.engineProof), jobs = await h.collector.run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unqualified')
  assert.deepEqual(h.engineProof, before)
})

test('v7 direct India listing still requires a fresh matching DTO rather than a listing-only promotion', async () => {
  const h = harness({ payloads: new Map() }); h.engineProof.roles = []
  const jobs = await h.collector.run()
  assert.equal(jobs.length, 0)
  assert.equal(jobs[PROOF].rawNativeObservations[0].qualification, 'unread')
  assert.equal(jobs[PROOF].rawNativeObservations[0].nativeCountry, null)
})

// These are wholly hypothetical DTOs and listing pages generated from the
// captured schema. They never remap/relabel a captured packet or its clocks.
// Only fetch responses are doubled; registry, runner, admission, real engine,
// real scheduler, country proof, and frozen config keep their normal contracts.
const realControl = (index, code = 'US', summary = null) => {
  const value = control(index, code)
  value.payload.jobPostingInfo.id = index.toString(16).padStart(32, '0')
  value.payload.jobPostingInfo.additionalLocations = []
  if (summary != null) value.row.locationsText = summary
  return value
}
const realRegisteredDispatch = async ({ controls, unreadPath, finalListingChange } = {}) => {
  const previousFetch = globalThis.fetch, calls = [], rows = controls.map(item => item.row), payloads = new Map(controls.map(item => [item.row.externalPath, item.payload]))
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(new Error('Hypothetical real-engine integration60s ceiling')), 60000)
  const pages = Math.ceil(rows.length / 20), admissions = []
  let listingCalls = 0, unexpected = 0
  globalThis.fetch = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    calls.push({ url, method: init.method || 'GET', body: init.body ?? null })
    let text, html = false
    if (url === OFFICIAL) { html = true; text = `<html><body><a href="${BOARD}">Hypothetical job search</a></body></html>` }
    else if ([BOARD, 'https://greendotcorp.wd1.myworkdayjobs.com/gdc'].includes(url)) {
      html = true; text = `<link rel="canonical" href="${CANONICAL}"><script>window.workday=window.workday||{tenant:"greendotcorp",siteId:"gdc",locale:"en-US",isExternal:true,appName:"cxs"};</script>`
    } else if (url === API + '/jobs' && init.method === 'POST') {
      const query = JSON.parse(init.body), snapshot = Math.floor(listingCalls++ / pages)
      assert.equal(query.limit, 20); assert.equal(query.searchText, ''); assert.deepEqual(query.appliedFacets, {})
      const currentRows = snapshot === 2 && finalListingChange ? finalListingChange(clone(rows)) : rows
      text = JSON.stringify({ total: query.offset ? 0 : currentRows.length, jobPostings: currentRows.slice(query.offset, query.offset + 20), facets: [], userAuthenticated: false })
    } else if (url.startsWith(API + '/job/')) {
      const externalPath = url.slice(API.length)
      if (externalPath === unreadPath) throw Object.assign(new Error('Hypothetical unread excluded foreign DTO'), { code: 'HYPOTHETICAL_UNREAD_DTO', abortRetries: true })
      if (payloads.has(externalPath)) text = JSON.stringify(payloads.get(externalPath))
    }
    if (text == null) { unexpected++; return previousFetch(url, init) }
    const result = new Response(text, { status: 200, headers: { 'content-type': html ? 'text/html' : 'application/json' } })
    Object.defineProperty(result, 'url', { value: url }); return result
  }
  let jobs, error
  try { jobs = await runScraperWithTimeout(createCatalogScraper(stagedProvider()), 210000, {
    signal: controller.signal, nativeDetailRecovery: false, onAdmission: event => admissions.push(event),
  }) } catch (caught) { error = caught }
  finally { clearTimeout(timer); globalThis.fetch = previousFetch }
  assert.equal(unexpected, 0)
  return { jobs, error, calls, admissions }
}

test('v7 real registered engine retains direct India with default20 offsets0/20 without inventing hydrated receipts', { timeout: 60000 }, async () => {
  const controls = [realControl(1, 'IN'), ...Array.from({ length: 20 }, (_, i) => realControl(i + 2))]
  const result = await realRegisteredDispatch({ controls })
  assert.equal(result.error, undefined)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].country, 'India')
  const proof = result.jobs[PROOF]
  assert.equal(proof.engineCountryProof.listingRoles.length, 21)
  assert.deepEqual(proof.engineCountryProof.roles, [])
  assert.deepEqual(proof.rawNativeObservations.map(row => row.qualification), ['india', ...Array(20).fill('foreign')])
  assert.deepEqual(result.calls.filter(call => call.url === API + '/jobs').map(call => JSON.parse(call.body).offset), [0, 20, 0, 20, 0, 20])
  assert.equal(result.calls.filter(call => call.url.startsWith(API + '/job/')).length, 21, 'Every closing DTO is read independently')
  assert.equal(readInventoryEvidence(result.jobs).indiaFacetCount, null)
})

test('v7 real engine issued grouped India/foreign scopes remain exact through independent closing reads', { timeout: 60000 }, async () => {
  const result = await realRegisteredDispatch({ controls: [realControl(101, 'IN', '1 location'), realControl(102, 'US', '1 location')] })
  assert.equal(result.error, undefined); assert.equal(result.jobs.length, 1)
  assert.deepEqual(result.jobs[PROOF].engineCountryProof.roles.map(row => row.countryScopes), [['india'], ['foreign']])
  assert.equal(result.calls.filter(call => call.url.startsWith(API + '/job/')).length, 4)
})

test('v7 real engine healthy plus empty-JD India retains a true partial native vacancy', { timeout: 60000 }, async () => {
  const a = realControl(201, 'IN', '1 location'), b = realControl(202, 'IN', '1 location'); b.payload.jobPostingInfo.jobDescription = ''
  const result = await realRegisteredDispatch({ controls: [a, b] })
  assert.equal(result.error, undefined); assert.equal(result.jobs.length, 2)
  assert.equal(result.jobs[0].sourceDetailComplete, true)
  assert.equal(result.jobs[1].sourceDetailComplete, false)
  assert.equal(result.jobs[1].sourceDescription, '')
  assert.equal(result.jobs[1].jobDescription, null)
})

test('v7 real engine healthy India survives unread excluded foreign with null authoritative totals', { timeout: 60000 }, async () => {
  const a = realControl(301, 'IN', '1 location'), b = realControl(302)
  const result = await realRegisteredDispatch({ controls: [a, b], unreadPath: b.row.externalPath })
  assert.equal(result.error, undefined); assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[PROOF].rawNativeObservations[1].qualification, 'unread')
  assert.equal(result.jobs[PROOF].rawNativeObservations[1].nativeCountry, null)
  assert.equal(readInventoryEvidence(result.jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(result.jobs).indiaFacetCount, null)
})

test('v7 real engine country text changing only in final independent listing still rejects reconciliation', { timeout: 60000 }, async () => {
  const result = await realRegisteredDispatch({ controls: [realControl(401, 'IN')], finalListingChange: rows => rows.map(row => ({ ...row, locationsText: 'United States of America' })) })
  assert.match(result.error?.message || '', /final closing native identity set changed/)
  assert.equal(result.jobs, undefined)
})

test('v7 unchanged real engine still rejects typed secondary-office objects before issuing safe candidates', { timeout: 60000 }, async () => {
  const a = realControl(501, 'US', '2 locations')
  a.payload.jobPostingInfo.additionalLocations = [{ descriptor: 'Pune, Maharashtra, India', country: country('IN') }]
  const result = await realRegisteredDispatch({ controls: [a] })
  assert.equal(result.jobs, undefined)
  assert.equal(result.error?.failureKind, 'incomplete_location_scope')
  assert.match(result.error?.cause?.message || '', /CXS job location payload is missing or ambiguous/)
})
