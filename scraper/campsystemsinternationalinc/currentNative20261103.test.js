import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCampSystemsInternationalIncScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readCampBoard, readCampHandoff, readCampRedirect, readCampListing, readCampDetail } from './currentNative.js'
import { parseBoundedProgram, parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'

const base = new URL('./test-data/current-native-20261103/', import.meta.url)
const read = async name => gunzipSync(await fs.readFile(new URL(name, base))).toString('utf8')
const CAREERS = 'https://www.campsystems.com/careers'
const HANDOFF = 'https://cta-redirect.hubspot.com/cta/redirect/5733783/94640c9a-0be6-492a-b662-941c8fc6e4bf'
const BOARD = 'https://recruiting.ultipro.com/CAM1010CSII/JobBoard/54a25c3a-e399-42b0-a553-16ed056e0517/'
const API = BOARD + 'JobBoardView/LoadSearchResults'
function rewriteDetail(html, change) {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const source = match[1]
    if (!source.includes('new US.Opportunity.CandidateOpportunityDetail(')) continue
    const all = []
    function walk(node) {
      if (!node || typeof node !== 'object') return
      all.push(node)
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value)
    }
    walk(parseBoundedProgram(source))
    const node = all.find(node => node.type === 'VariableDeclarator' && node.id.name === 'opportunity').init.arguments[0]
    const model = parseRemoteLiteral(source.slice(node.start, node.end))
    change(model)
    return html.replace(source, source.slice(0, node.start) + JSON.stringify(model) + source.slice(node.end))
  }
  assert.fail('Expected current captured native opportunity literal')
}
const makeIndia = row => {
  const place = row.Locations[0]
  place.LocalizedName = 'Hyderabad, India'; place.LocalizedDescription = 'Hyderabad'
  place.LocalizedLocationId = '*Hyderabad, India'
  place.Address = { Line1: 'Synthetic test campus', Line2: null, City: 'Hyderabad', PostalCode: '500001',
    State: { Code: 'TG', Name: 'Telangana' }, Country: { Code: 'IND', Name: 'India' } }
}
async function fixture(options = {}) {
  const careers = await read('careers.html.gz'), handoff = await read('handoff.html.gz')
  const board = (await read('board.html.gz')).replace('pageSize: 50', 'pageSize: ' + (options.pageSize || 50))
  const listing = JSON.parse(await read('listing.json.gz'))
  const details = new Map(await Promise.all(listing.opportunities.map(async row => [row.Id, await read('role-' + row.Id + '.html.gz')])))
  const calls = [], records = [], audits = []
  let listingReads = 0
  const detailReads = new Map()
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body && JSON.parse(init.body) })
    let body
    if (url === CAREERS) body = careers
    else if (url === HANDOFF) body = handoff
    else if (url === BOARD + '?q=&o=postedDateDesc') body = board
    else if (url === API) {
      assert.equal(init.method, 'POST')
      assert.equal(init.headers['X-RequestVerificationToken'], 'ANONYMOUS_CSRF_REDACTED')
      assert.match(init.headers.Cookie, /ANONYMOUS_SESSION/)
      const query = JSON.parse(init.body).opportunitySearch
      assert.equal(query.QueryString, '')
      assert.deepEqual(query.Filters, [])
      const value = structuredClone(listing)
      options.changeListing?.(value, ++listingReads)
      value.opportunities = value.opportunities.slice(query.Skip, query.Skip + query.Top)
      body = JSON.stringify(value)
    } else if (url.startsWith(BOARD + 'OpportunityDetail?opportunityId=')) {
      const id = new URL(url).searchParams.get('opportunityId')
      assert.ok(details.has(id), 'Only native-declared public detail IDs may be read')
      body = details.get(id)
      detailReads.set(id, (detailReads.get(id) || 0) + 1)
      if (options.changeDetail) body = rewriteDetail(body, model => options.changeDetail(model, detailReads.get(id)))
    } else assert.fail('Unexpected public request: ' + url)
    if (options.changeBody) body = options.changeBody({ url, init, body, calls }) ?? body
    const changed = options.changeResponse?.({ url, init, body, calls })
    if (changed) return changed
    return { status: 200, url, text: async () => body, headers: { getSetCookie: () => ['__RequestVerificationToken=ANONYMOUS_SESSION; Path=/; Secure; HttpOnly'] } }
  }
  const run = extra => createCampSystemsInternationalIncScraper().run({ fetchImpl,
    fetchText: async () => careers, onRecords: rows => records.push(...rows), onAudit: data => audits.push(data), ...extra })
  return { run, calls, records, audits, listing, details, careers, handoff, board }
}

test('CAMP enumerates the real declared public native inventory instead of qualifying an empty marketing page', async () => {
  const f = await fixture(), jobs = await f.run()
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.firstParty, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 18)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(f.records.length, 18)
  assert.ok(f.records.every(row => row.sourceDetailComplete && row.jobDescription.length > 1000))
  assert.deepEqual([...new Set(f.records.flatMap(row => row.sourceNativeCountries))].sort(), ['Canada', 'United Kingdom', 'United States'])
  assert.equal(f.calls.filter(row => row.url.includes('OpportunityDetail?')).length, 36)
  assert.equal(f.calls.at(-1).url, API)
  assert.equal(f.audits.length, 1)
})

test('CAMP walks all native pages with an unfiltered query and closes membership after the final detail', async () => {
  const f = await fixture({ pageSize: 2 }), jobs = await f.run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.equal(f.records.length, 18)
  const listingCalls = f.calls.filter(row => row.url === API)
  assert.equal(listingCalls.length, 27)
  assert.deepEqual(listingCalls.slice(0, 9).map(row => row.body.opportunitySearch.Skip), [0, 2, 4, 6, 8, 10, 12, 14, 16])
  assert.equal(f.calls.at(-1).body.opportunitySearch.Skip, 16)
})

test('CAMP reconciles the current native initial total field with all 22 captured public roles', async () => {
  const payload = JSON.parse(gunzipSync(await fs.readFile(new URL('./test-data/current-native-20261106/listing.json.gz', import.meta.url))))
  const listing = readCampListing(payload, { skip: 0, pageSize: 50 })
  assert.equal(listing.totalCount, 22)
  assert.equal(listing.initialTotalOpportunitiesCount, 22)
  assert.equal(listing.opportunities.length, 22)
})

test('CAMP closes its inventory across pages when the native initial total is published', async () => {
  const f = await fixture({ pageSize: 2, changeListing: value => { value.initialTotalOpportunitiesCount = value.totalCount } })
  const jobs = await f.run()
  assert.equal(f.records.length, 18)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 18)
})

test('CAMP rejects a contradictory native initial total instead of ignoring the new count', async () => {
  const f = await fixture({ changeListing: value => { value.initialTotalOpportunitiesCount = value.totalCount + 1 } })
  await assert.rejects(f.run(), /native total and pagination do not reconcile/)
})

test('CAMP closing field changes cannot certify a complete collection', async () => {
  const f = await fixture({ changeListing: (value, read) => { if (read === 3) value.opportunities[0].JobCategoryName = 'Changed native department' } })
  const jobs = await f.run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('CAMP denial stays a local source failure with unknown native totals', async () => {
  const f = await fixture({ changeResponse: ({ url }) => url === API ? { status: 403, url, text: async () => 'Forbidden' } : null })
  await assert.rejects(f.run(), error => error.failureKind === 'blocked_or_access_denied' && error.abortRetries === true
    && error.abortPipeline !== true && error.persistenceBlocked !== true && error.nativeJobTotal == null)
  assert.equal(f.calls.filter(row => row.url === API).length, 1)
})

test('CAMP a transport that ignores abort cannot keep a source running', async () => {
  const f = await fixture({ changeResponse: ({ url }) => url === API ? new Promise(() => {}) : null })
  await assert.rejects(f.run({ timeoutMs: 25 }), error => error.name === 'TimeoutError')
})

test('CAMP an async observer that ignores abort remains bounded', async () => {
  const f = await fixture(), controller = new AbortController(), reason = new Error('caller stopped CAMP')
  await assert.rejects(f.run({ signal: controller.signal, onAudit: async () => { controller.abort(reason); return new Promise(() => {}) } }), error => error === reason)
})

test('CAMP keeps full source descriptions, original dates and native requisitions for an explicitly typed India control', async () => {
  const f = await fixture({ changeListing: value => makeIndia(value.opportunities[0]),
    changeDetail: model => { if (model.Id === 'cb59e146-6e61-40ef-b291-2d1a50bc8c7d') makeIndia(model) } })
  const jobs = await f.run(), [job] = jobs
  assert.equal(jobs.length, 1)
  assert.equal(job.country, 'India')
  assert.equal(job.postingDate, '2026-11-02T21:42:12.78Z')
  assert.equal(job.sourceNativeDetailRecord.PostedDate, '2026-11-02T21:42:12.786Z')
  assert.equal(job.requisitionId, 'VICEP002880')
  assert.equal(job.jobDescription, [job.sourceNativeDetailRecord.Description, job.sourceNativeDetailRecord.EqualOpportunityEmployerDescription].join('\n'))
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('CAMP country names and native country codes must agree', async () => {
  const f = await fixture({ changeListing: value => { value.opportunities[0].Locations[0].Address.Country.Name = 'India' },
    changeDetail: model => { if (model.Id === 'cb59e146-6e61-40ef-b291-2d1a50bc8c7d') model.Locations[0].Address.Country.Name = 'India' } })
  const jobs = await f.run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(f.records[0].sourceCountryScopeUnresolved, true)
})

test('CAMP a city without an explicit native country remains unknown', async () => {
  const change = row => { row.Locations[0].LocalizedName = 'Hyderabad'; row.Locations[0].Address.Country = null }
  const f = await fixture({ changeListing: value => change(value.opportunities[0]),
    changeDetail: model => { if (model.Id === 'cb59e146-6e61-40ef-b291-2d1a50bc8c7d') change(model) } })
  const jobs = await f.run()
  assert.equal(jobs.length, 0)
  assert.equal(f.records[0].country, null)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
})

test('CAMP additional native qualifications are held rather than replaced by the brief summary', async () => {
  const f = await fixture({ changeDetail: model => { if (model.Id === 'cb59e146-6e61-40ef-b291-2d1a50bc8c7d') model.SkillCriteria = [{ SkillName: 'Additional qualification' }] } })
  const jobs = await f.run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(f.records.filter(row => row.sourceDetailComplete).length, 17)
  assert.equal(f.records[0].jobDescription, null)
})

test('CAMP a changed full description cannot pass through stable listing membership', async () => {
  const f = await fixture({ changeDetail: (model, read) => { if (read === 2 && model.Id === 'cb59e146-6e61-40ef-b291-2d1a50bc8c7d') model.Description += '<p>Changed responsibilities.</p>' } })
  const jobs = await f.run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(f.records[0].sourceCurrentPostingStable, false)
})

test('CAMP duplicate native IDs and error-shaped zero envelopes are rejected', async () => {
  const f = await fixture(), duplicate = structuredClone(f.listing)
  duplicate.opportunities[1] = structuredClone(duplicate.opportunities[0])
  assert.throws(() => readCampListing(duplicate, { skip: 0, pageSize: 50 }), /duplicate|identity/)
  assert.throws(() => readCampListing({ opportunities: [], locations: [], totalCount: 0, error: 'unavailable' }, { skip: 0, pageSize: 50 }), /pagination/)
  assert.throws(() => readCampListing({ opportunities: [], locations: [], totalCount: 18 }, { skip: 0, pageSize: 50 }), /pagination/)
})

test('CAMP private/internal/filtered models and inactive copies cannot establish a public inventory', async () => {
  const f = await fixture()
  assert.throws(() => readCampBoard(f.board.replace('isInternal: false', 'isInternal: true')), /internal|filtered/)
  assert.throws(() => readCampBoard(f.board.replace('"FilterCategory":null', '"FilterCategory":"Department"')), /filtered/)
  assert.throws(() => readCampBoard('<template>' + f.board + '</template>'), /missing/)
  assert.throws(() => readCampBoard('<!--' + f.board.replace(/-->/g, '') + '-->'), /missing/)
  assert.throws(() => readCampBoard(f.board + f.board), /ambiguous/)
  assert.throws(() => readCampBoard(f.board.replace('pageSize: 50', 'pageSize: (() => { throw Error("must not execute") })()')), /literal/)
})

test('CAMP handoff must identify the same public unfiltered employer board', async () => {
  const f = await fixture()
  assert.equal(readCampHandoff(f.careers), HANDOFF)
  assert.equal(readCampRedirect(f.handoff), BOARD + '?q=&o=postedDateDesc')
  assert.throws(() => readCampRedirect(f.handoff.replaceAll('q=&o=', 'q=India&o=')), /filtered/)
  assert.throws(() => readCampRedirect(f.handoff.replaceAll('CAM1010CSII', 'OTHEREMPLOYER')), /board|handoff/)
})

test('CAMP an incomplete detail keeps the other full records without certifying completeness', async () => {
  let rejected = 0
  const f = await fixture({ changeResponse: ({ url }) => url.endsWith('opportunityId=cb59e146-6e61-40ef-b291-2d1a50bc8c7d')
    ? (++rejected, { status: 404, url, text: async () => '' }) : null })
  const jobs = await f.run()
  assert.equal(rejected, 2)
  assert.equal(f.records.filter(row => row.sourceDetailComplete).length, 17)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('CAMP a denial stops issuing new detail reads after concurrent requests settle', async () => {
  const f = await fixture({ changeResponse: ({ url }) => url.includes('OpportunityDetail?') ? { status: 403, url, text: async () => 'Forbidden' } : null })
  await assert.rejects(f.run(), error => error.failureKind === 'blocked_or_access_denied')
  const count = f.calls.length
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(f.calls.length, count)
  assert.ok(f.calls.filter(row => row.url.includes('OpportunityDetail?')).length <= 4)
})

test('CAMP explicit response redirects and missing anonymous-session fields remain incomplete', async () => {
  for (const response of [{ status: 302, url: API, text: async () => '' }, { status: 200, url: BOARD + 'Account/Login', text: async () => '' }]) {
    const f = await fixture({ changeResponse: ({ url }) => url === API ? response : null })
    await assert.rejects(f.run(), /unavailable/)
  }
})

test('CAMP all declared listing fields participate in final reconciliation', async () => {
  const f = await fixture({ changeListing: (value, read) => { if (read === 3) value.opportunities[0].Featured = !value.opportunities[0].Featured } })
  const jobs = await f.run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('CAMP unreviewed native employer or qualification fields cannot qualify a record', async () => {
  const f = await fixture(), row = structuredClone(f.listing.opportunities[0]), value = structuredClone(f.listing)
  value.opportunities[0].HiringOrganization = 'Another employer'
  assert.throws(() => readCampListing(value, { skip: 0, pageSize: 50 }), /fields|contract/)
  const html = rewriteDetail(f.details.get(row.Id), model => { model.AdditionalRequiredQualifications = ['Unreviewed qualification'] })
  assert.throws(() => readCampDetail(html, row), /fields|qualifications/)
})

test('CAMP an unbound replacement renderer cannot qualify captured description data', async () => {
  const f = await fixture(), row = f.listing.opportunities[0], html = f.details.get(row.Id)
  assert.throws(() => readCampDetail(html.replace('var renderer = new US.Opportunity.OpportunityRenderViewModel', 'var discarded = new US.Opportunity.OpportunityRenderViewModel'), row), /renderer/)
  assert.throws(() => readCampDetail(html.replace('var applicantSourceId = null;', 'opportunity.Description = "Different rendered role"; var applicantSourceId = null;'), row), /reassigned|model/)
})

test('CAMP caller cancellation also bounds a legacy HTML-only transport', async () => {
  const controller = new AbortController(), reason = new Error('stop legacy CAMP reader')
  const attempt = createCampSystemsInternationalIncScraper().run({ signal: controller.signal, fetchText: async (_url, options) => {
    assert.equal(options?.signal, controller.signal)
    controller.abort(reason)
    return new Promise(() => {})
  } })
  await assert.rejects(attempt, error => error === reason)
})

test('CAMP shadowed constructor namespaces cannot bind native listing models', async () => {
  const f = await fixture()
  for (const declaration of ['function US() {}', 'US = {};', 'US.Opportunity = {};', 'function ko() {}']) {
    assert.throws(() => readCampBoard(f.board.replace('var opportunityModel =', declaration + ' var opportunityModel =')), /shadow|namespace|reassigned/)
  }
})

test('CAMP an applyBindings call inside an unreachable branch cannot qualify the model', async () => {
  const f = await fixture(), call = 'ko.applyBindings(opportunityModel, $("#OpportunitiesContainer")[0]);'
  assert.ok(f.board.includes(call))
  assert.throws(() => readCampBoard(f.board.replace(call, 'if (false) { ' + call + ' }')), /binding|unconditional/)
})

test('CAMP native posting dates require real calendar dates and valid UTC clock fields', async () => {
  const f = await fixture()
  for (const date of ['2026-02-31T00:00:00Z', '2025-02-29T00:00:00Z', '2026-04-31T12:00:00Z', '2026-01-01T24:00:00Z']) {
    const value = structuredClone(f.listing); value.opportunities[0].PostedDate = date
    assert.throws(() => readCampListing(value, { skip: 0, pageSize: 50 }), /date|identity/)
  }
  const leap = structuredClone(f.listing); leap.opportunities[0].PostedDate = '2024-02-29T12:34:56.1234567Z'
  assert.equal(readCampListing(leap, { skip: 0, pageSize: 50 }).opportunities[0].PostedDate, '2024-02-29T12:34:56.1234567Z')
})

test('CAMP zero maxJobs follows the existing unbounded source convention and positive limits keep inventory partial', async () => {
  const ids = new Set(['cb59e146-6e61-40ef-b291-2d1a50bc8c7d', '269dedbc-0495-4cff-8bed-b9fd904f155c'])
  const options = { changeListing: value => value.opportunities.filter(row => ids.has(row.Id)).forEach(makeIndia),
    changeDetail: model => { if (ids.has(model.Id)) makeIndia(model) } }
  const unbounded = await fixture(options), all = await unbounded.run({ maxJobs: 0 })
  assert.equal(all.length, 2); assert.equal(readInventoryEvidence(all).listingComplete, true)
  const capped = await fixture(options), some = await capped.run({ maxJobs: 1 })
  assert.equal(some.length, 1); assert.equal(readInventoryEvidence(some).listingComplete, false)
  assert.equal(capped.records.length, 18)
})
