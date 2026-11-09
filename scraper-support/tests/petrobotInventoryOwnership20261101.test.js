import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { parse } from 'acorn'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { INVENTORY_EVIDENCE, readInventoryEvidence, isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { filterIndiaJobs } from '../utils/indiaLocationFilter.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'
import * as petro from '../../scraper/petrobot/script.js'

// Literal input only: do not execute the original tests or upstream JavaScript.
const declarations = text => parse(text, { sourceType: 'module', ecmaVersion: 'latest' }).body
  .flatMap(node => node.type === 'ExportNamedDeclaration' ? [node.declaration] : [node]).filter(Boolean)
  .filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
const fixtureText = readFileSync(new URL('./petrobotScript.test.js', import.meta.url), 'utf8')
const fixtureDeclarations = new Map(declarations(fixtureText).map(node => [node.id.name, node]))
const sourceDeclarations = new Map(declarations(readFileSync(new URL('../../scraper/petrobot/script.js', import.meta.url), 'utf8')).map(node => [node.id.name, node]))
const read = (node, table) => node.type === 'Literal' ? node.value
  : node.type === 'ArrayExpression' ? node.elements.map(value => read(value, table))
  : node.type === 'ObjectExpression' ? Object.fromEntries(node.properties.map(prop => [prop.key.name ?? prop.key.value, read(prop.value, table)]))
  : node.type === 'TemplateLiteral' && !node.expressions.length ? node.quasis[0].value.cooked
  : node.type === 'Identifier' ? read(table.get(node.name).init, table)
  : (() => { throw Error('Unsupported original static fixture: ' + node.type) })()
const original = {
  html: read(fixtureDeclarations.get('officialCareersHtml').init, fixtureDeclarations),
  listing: read(fixtureDeclarations.get('smartRecruitersListingsPayload').init, fixtureDeclarations),
  detail: read(fixtureDeclarations.get('smartRecruitersDetailPayload').init, fixtureDeclarations),
}
const upstreamProvider = read(sourceDeclarations.get('createApiProvider').init.body, sourceDeclarations)
const provider = getScraperCatalog().find(value => value.source === 'petrobot')
const CLOCK = '2026-07-18T00:00:00.000Z' // Controlled historical test clock, not native freshness.
const listingUrl = petro.SMARTRECRUITERS_LISTING_API_URL + '?limit=100&country=in&offset=0'
const detailUrl = petro.SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE.replace('{{jobId}}', original.detail.id)
const anchor = original.html.match(/<a href="https:\/\/careers\.smartrecruiters\.com\/PetroBotTechnologiesPvtLtd">[\s\S]*?<\/a>/)[0]
const clone = value => structuredClone(value)
const transport = ({ html = original.html, listing = original.listing, detail = original.detail, unavailable = false } = {}) => {
  const requests = [], snapshots = []
  const snapshot = value => { const result = clone(value); snapshots.push([result, clone(result)]); return result }
  return {
    requests,
    fetchText: async url => { requests.push(url); assert.equal(url, petro.CAREERS_URL); return html },
    fetchJson: async url => {
      requests.push(url)
      if (url === listingUrl) return snapshot(listing)
      assert.equal(url, detailUrl)
      if (unavailable) throw Error('Controlled optional PetroBot detail unavailable')
      return snapshot(detail)
    },
    assertUnchanged() { for (const [value, copy] of snapshots) assert.deepEqual(value, copy) },
  }
}
const runs = async (options = {}, maxJobs = null) => {
  const referenceInput = transport(options), directInput = transport(options), registeredInput = transport(options)
  const upstream = await runApiPortalScraper({ provider: upstreamProvider, fetchJson: referenceInput.fetchJson })
  const direct = await petro.createPetroBotScraper({ maxJobs }).run(directInput)
  const registered = await createCatalogScraper(provider).run({ ...registeredInput, maxJobs })
  referenceInput.assertUnchanged(); directInput.assertUnchanged(); registeredInput.assertUnchanged()
  assert.deepEqual(directInput.requests, [petro.CAREERS_URL, ...referenceInput.requests])
  assert.deepEqual(registeredInput.requests, directInput.requests)
  return { upstream, direct, registered }
}
const sameRows = (upstream, output) => {
  const expected = upstream.map(job => ({ ...job, department: typeof job.department === 'string' ? job.department : null }))
  assert.equal(output.length, expected.length)
  for (let index = 0; index < expected.length; index++) for (const key of Reflect.ownKeys(expected[index])) {
    assert.deepEqual(output[index][key], expected[index][key], 'unchanged original field ' + String(key))
  }
  for (const job of output) {
    assert.notEqual(job.sourceScopeComplete, true)
    assert.notEqual(job.sourceCompanyCoverageComplete, true)
    assert.ok(job.sourceGlobalJobCount == null && job.sourceIndiaJobCount == null)
  }
}

for (const mode of ['complete', 'partial', 'empty']) {
  test('PetroBot source-owned controlled ' + mode + ' cohort preserves real engine carrier through factory and registry', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
    const snapshot = clone(original)
    assert.equal(provider.source, 'petrobot'); assert.equal(provider.companyName, 'PetroBot')
    assert.equal(provider.adapter, 'script'); assert.match(provider.modulePath, /petrobot[\\/]script\.js$/)
    const options = mode === 'partial' ? { unavailable: true } : mode === 'empty' ? { listing: { totalFound: 0, content: [] } } : {}
    const { upstream, direct, registered } = await runs(options)
    const evidence = readInventoryEvidence(upstream)
    assert.equal(evidence.status, mode === 'partial' ? 'discovery-only' : mode === 'empty' ? 'verified-empty' : 'complete-inventory')
    assert.equal(evidence.reportedTotal, mode === 'empty' ? 0 : original.listing.totalFound)
    assert.equal(evidence.verifiedAt, CLOCK)
    sameRows(upstream, direct); sameRows(upstream, registered)
    assert.deepEqual({ direct: readInventoryEvidence(direct), registered: readInventoryEvidence(registered) }, { direct: evidence, registered: evidence })
    assert.deepEqual(Object.getOwnPropertyDescriptor(direct, INVENTORY_EVIDENCE), Object.getOwnPropertyDescriptor(upstream, INVENTORY_EVIDENCE))
    assert.deepEqual(original, snapshot)
  })
}

for (const [name, options, maxJobs] of [
  ['zero cap hides original one role', {}, 0],
  ['explicit one cap with original single-role boundary', {}, 1],
  ['partial-detail zero cap', { unavailable: true }, 0],
  ['controlled-empty zero cap', { listing: { totalFound: 0, content: [] } }, 0],
]) {
  test('PetroBot ' + name + ' retains upstream counts but withholds empty/completion authority', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
    const { upstream, direct, registered } = await runs(options, maxJobs)
    const originalEvidence = readInventoryEvidence(upstream)
    for (const jobs of [direct, registered]) {
      assert.equal(jobs.length, maxJobs === 0 ? 0 : upstream.length)
      const evidence = readInventoryEvidence(jobs)
      assert.ok(evidence)
      assert.equal(evidence.status, 'discovery-only')
      assert.equal(evidence.listingComplete, false)
      for (const key of ['surface', 'firstParty', 'pagesFetched', 'reportedTotal', 'indiaFacetCount', 'verifiedAt']) assert.deepEqual(evidence[key], originalEvidence[key], key)
      assert.match(evidence.reason, /petrobot-explicit-bounded-run/)
      if (options.unavailable) assert.match(evidence.reason, /optional-role-details-unavailable/)
      assert.equal(isVerifiedEmptyEvidence(evidence), false)
      assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: CLOCK }), false)
      for (const job of jobs) {
        assert.equal(job.jobId, original.detail.id)
        assert.equal(job.postingDate, original.detail.releasedDate)
        assert.equal(job.sourceListingComplete, false)
      }
    }
  })
}

const mustReject = async (options, maxReads) => {
  for (const execute of [input => petro.createPetroBotScraper().run(input), input => createCatalogScraper(provider).run(input)]) {
    const input = transport(options)
    await assert.rejects(execute(input), error => error.incompleteScope === true || /official careers|handoff/.test(error.message))
    assert.equal(input.requests.length, maxReads)
    input.assertUnchanged()
  }
}

for (const [name, mutate] of [
  ['foreign company identifier', value => { value.content[0].company.identifier = 'ControlledOtherCompany' }],
  ['missing company identifier', value => { delete value.content[0].company.identifier }],
  ['foreign native API ref', value => { value.content[0].ref = value.content[0].ref.replace('/PetroBotTechnologiesPvtLtd/', '/ControlledOtherCompany/') }],
  ['wrong native API role ID', value => { value.content[0].ref = value.content[0].ref.replace(original.detail.id, '744000132029835') }],
  ['supplied foreign postingURL', value => { value.content[0].postingUrl = original.detail.postingUrl.replace('/PetroBotTechnologiesPvtLtd/', '/ControlledOtherCompany/') }],
  ['supplied foreign applyURL', value => { value.content[0].applyUrl = 'https://foreign.example/jobs/' + original.detail.id }],
]) {
  test('PetroBot rejects native listing ' + name + ' before a detail read', async () => {
    const listing = clone(original.listing); mutate(listing)
    await mustReject({ listing }, 2)
  })
}

for (const [name, mutate] of [
  ['ID', value => { value.id = '744000132029835' }],
  ['requisition', value => { value.refNumber = 'CONTROLLED-OTHER' }],
  ['title', value => { value.name = 'Controlled unrelated role' }],
  ['company identifier', value => { value.company = { identifier: 'ControlledOtherCompany' } }],
  ['posting account', value => { value.postingUrl = value.postingUrl.replace('/PetroBotTechnologiesPvtLtd/', '/ControlledOtherCompany/') }],
  ['application account', value => { value.applyUrl = value.applyUrl.replace('/PetroBotTechnologiesPvtLtd/', '/ControlledOtherCompany/') }],
  ['posting role ID', value => { value.postingUrl = value.postingUrl.replace(original.detail.id, '744000132029835') }],
  ['application role ID', value => { value.applyUrl = value.applyUrl.replace(original.detail.id, '744000132029835') }],
  ['HTTP application', value => { value.applyUrl = value.applyUrl.replace('https:', 'http:') }],
  ['missing application', value => { delete value.applyUrl }],
  ['workplace', value => { value.location.fullLocation = 'Controlled different workplace' }],
  ['explicit country', value => { value.location.country = 'us' }],
  ['publication date', value => { value.releasedDate = '2026-06-14T08:40:22.381Z' }],
]) {
  test('PetroBot rejects conflicting native detail ' + name + ' without another read', async () => {
    const detail = clone(original.detail); mutate(detail)
    await mustReject({ detail }, 3)
  })
}

for (const [name, replacement, prefix = ''] of [
  ['template', '<template>' + anchor + '</template>'],
  ['comment', '<!--' + anchor + '-->'],
  ['script string', '<script>const inertData=' + JSON.stringify(anchor) + '</script>'],
  ['hidden', '<div hidden>' + anchor + '</div>'],
  ['inert', '<div inert>' + anchor + '</div>'],
  ['ARIA hidden', '<div aria-hidden="true">' + anchor + '</div>'],
  ['inline opacity zero', '<div style="opacity:0">' + anchor + '</div>'],
  ['author CSS hiding', '<div class="controlled-hide">' + anchor + '</div>', '<style>.controlled-hide{display:none}</style>'],
  ['malformed attribute name', anchor.replace('href=', '=href=')],
  ['duplicate conflicting href', anchor.replace('href=', 'href="https://careers.smartrecruiters.com/ControlledOtherCompany" href=')],
  ['own handler', anchor.replace('<a ', '<a onclick="event.preventDefault()" ')],
  ['ancestor handler', '<div onclick="event.preventDefault()">' + anchor + '</div>'],
  ['descendant handler', anchor.replace('View all positions on SmartRecruiters', '<span onclick="event.preventDefault()">View all positions on SmartRecruiters</span>')],
]) {
  test('PetroBot ' + name + ' cannot establish an active first-party account handoff', async () => {
    const html = prefix + original.html.replace(anchor, replacement + '<p>View all positions on SmartRecruiters</p>')
    await mustReject({ html }, 1)
  })
}

test('PetroBot visibly nested label and unrelated/inert handlers retain the original account handoff', async () => {
  const replacement = anchor.replace('View all positions on SmartRecruiters', '<span>View all positions on <strong>SmartRecruiters</strong></span>')
  const html = original.html.replace(anchor, replacement + '<div onclick="unrelated()">Unrelated sibling</div><template><div onclick="inert()">Inert sibling</div></template>')
  const input = transport({ html })
  const jobs = await petro.createPetroBotScraper().run(input)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, original.detail.id)
  assert.equal(jobs[0].jobDescription, original.detail.jobAd.sections.jobDescription.text)
  assert.equal(jobs[0].applyUrl, original.detail.applyUrl)
  input.assertUnchanged()
})

test('PetroBot matching optional raw company/ref and listing public URLs retain exact original role fields', async () => {
  const listing = clone(original.listing), detail = clone(original.detail)
  listing.content[0].postingUrl = detail.postingUrl
  listing.content[0].applyUrl = detail.applyUrl
  detail.company = clone(listing.content[0].company)
  detail.ref = listing.content[0].ref
  const input = transport({ listing, detail }), jobs = await petro.createPetroBotScraper().run(input)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, original.detail.id)
  assert.equal(jobs[0].applyUrl, original.detail.applyUrl)
  assert.equal(jobs[0].postingDate, original.detail.releasedDate)
  assert.equal(jobs[0].jobDescription, original.detail.jobAd.sections.jobDescription.text)
  input.assertUnchanged()
})

test('PetroBot duplicate native role ID cannot become two observed requisitions or a complete source', async () => {
  const listing = clone(original.listing)
  listing.content.push(clone(listing.content[0])); listing.totalFound = 2
  await mustReject({ listing }, 2)
})

for (const [name, change] of [
  ['duplicate application query', value => { value.applyUrl += '&oga=false' }],
  ['unknown application role selector', value => { value.applyUrl += '&jobId=744000132029835' }],
  ['application credentials', value => { value.applyUrl = value.applyUrl.replace('https://', 'https://user@') }],
]) {
  test('PetroBot unsupported ' + name + ' remains unqualified rather than stripped or guessed', async () => {
    const detail = clone(original.detail); change(detail)
    await mustReject({ detail }, 3)
  })
}

test('PetroBot inert label descendants do not override a visible native anchor', async () => {
  const html = original.html.replace(anchor, anchor.replace('</a>', '<span hidden onclick="event.preventDefault()">Hidden unrelated requirement</span><template><span onclick="event.preventDefault()">Inert text</span></template></a>'))
  const input = transport({ html }), jobs = await petro.createPetroBotScraper().run(input)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, original.detail.applyUrl)
  input.assertUnchanged()
})

// New capture, separate from and never spliced into the original fixtures.
const native = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/petrobot/native-captures/2026-11-01-declared-api.json.gz', import.meta.url))))
const nativeListing = JSON.parse(native.listingBody), nativeDetail = JSON.parse(native.detailBody)
const nativeRow = nativeListing.content.find(row => row.id === nativeDetail.id)
const sha = value => createHash('sha256').update(value).digest('hex')

test('PetroBot new three-response capture preserves raw3/reported3, original clocks and one-detail-only scope', () => {
  for (const label of ['official', 'listing', 'detail']) {
    const body = native[label + 'Body'], receipt = native.observation.requests.find(value => value.label === label)
    assert.equal(Buffer.byteLength(body), receipt.bytes)
    assert.equal(sha(body), receipt.bodySHA256)
    assert.equal(receipt.status, 200)
  }
  assert.equal(nativeListing.content.length, 3)
  assert.equal(nativeListing.totalFound, 3)
  assert.equal(native.observation.sourceScopeComplete, false)
  assert.equal(native.observation.nativeDefaultRun, false)
  assert.equal(native.observation.requests[0].requestedAt, '2026-11-01T15:53:22.618Z')
  assert.equal(native.observation.requests[2].completedAt, '2026-11-01T15:53:24.653Z')
  assert.equal(nativeRow.id, '744000155730349')
  assert.equal(nativeRow.releasedDate, '2026-10-15T11:02:20.161Z')
  assert.equal(nativeDetail.releasedDate, nativeRow.releasedDate)
})

test('PetroBot new actual primary exposes the active declared account without executing website JavaScript', () => {
  assert.equal(petro.hasOfficialCareersSignal(native.officialBody), true)
  assert.equal(petro.extractVerifiedJobsBoardUrl(native.officialBody), petro.SMARTRECRUITERS_BOARD_URL)
})

const nativeInput = ({ capped = false, mutateDetail } = {}) => {
  const requests = [], payloads = []
  return {
    requests, maxJobs: capped ? 1 : null,
    fetchText: async url => { requests.push(url); assert.equal(url, petro.CAREERS_URL); return native.officialBody },
    fetchJson: async url => {
      requests.push(url)
      if (url === listingUrl) {
        // Explicitly SYNTHETIC count1 envelope around the exact sampled row.
        const value = { ...clone(nativeListing), content: [clone(nativeRow)], totalFound: 1 }
        payloads.push([value, clone(value)]); return value
      }
      assert.equal(url, nativeRow.ref)
      const value = clone(nativeDetail)
      if (mutateDetail) mutateDetail(value)
      payloads.push([value, clone(value)]); return value
    },
    assertUnchanged() { for (const [value, copy] of payloads) assert.deepEqual(value, copy) },
  }
}

test('PetroBot clearly synthetic one-role envelope around exact new native row/detail preserves authored shape and dates', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
  const snapshot = clone({ nativeListing, nativeDetail })
  for (const execute of [input => petro.createPetroBotScraper().run(input), input => createCatalogScraper(provider).run(input)]) {
    const input = nativeInput(), jobs = await execute(input)
    assert.equal(jobs.length, 1)
    const job = jobs[0]
    assert.equal(job.jobId, nativeRow.id)
    assert.equal(job.requisitionId, nativeRow.refNumber)
    assert.equal(job.title, nativeRow.name)
    assert.equal(job.location, nativeRow.location.fullLocation)
    assert.equal(job.country, 'India')
    assert.equal(job.jobDescription, nativeDetail.jobAd.sections.jobDescription.text)
    assert.equal(job.minimumQualification, nativeDetail.jobAd.sections.qualifications.text)
    assert.equal(job.preferredQualification, nativeDetail.jobAd.sections.additionalInformation.text)
    assert.equal(job.postingDate, nativeRow.releasedDate)
    assert.equal(job.sourceUrl, nativeDetail.postingUrl)
    assert.equal(job.applyUrl, nativeDetail.applyUrl)
    assert.ok(job.applyUrl.endsWith('?oga=true'))
    assert.notEqual(job.postingDate, native.observation.requests[2].completedAt)
    assert.ok(job.sourceGlobalJobCount == null && job.sourceIndiaJobCount == null)
    assert.notEqual(job.sourceScopeComplete, true)
    assert.deepEqual(input.requests, [petro.CAREERS_URL, listingUrl, nativeRow.ref])
    input.assertUnchanged()
  }
  assert.deepEqual({ nativeListing, nativeDetail }, snapshot)
})

for (const [name, mutateDetail] of [
  ['foreign supplied referral account', detail => { detail.referralUrl = detail.referralUrl.replace('/company/PetroBotTechnologiesPvtLtd/', '/company/ControlledOtherCompany/') }],
  ['contradictory supplied UUID', detail => { detail.uuid = nativeListing.content[1].uuid }],
  ['contradictory supplied jobAdId', detail => { detail.jobAdId = nativeListing.content[1].jobAdId }],
  ['explicitly inactive detail', detail => { detail.active = false }],
  ['explicitly private detail', detail => { detail.visibility = 'PRIVATE' }],
]) {
  test('PetroBot new captured-shape ' + name + ' cannot qualify the same account/publication', async () => {
    const input = nativeInput({ mutateDetail })
    await assert.rejects(petro.createPetroBotScraper().run(input), error => error.incompleteScope === true)
    assert.deepEqual(input.requests, [petro.CAREERS_URL, listingUrl, nativeRow.ref])
    input.assertUnchanged()
  })
}

test('PetroBot raw3 capture with two controlled unavailable details remains partial under explicit one bound', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
  const requests = [], originalSnapshot = clone(nativeListing)
  const jobs = await petro.createPetroBotScraper({ maxJobs: 1 }).run({
    fetchText: async url => { requests.push(url); assert.equal(url, petro.CAREERS_URL); return native.officialBody },
    fetchJson: async url => {
      requests.push(url)
      if (url === listingUrl) return clone(nativeListing) // Actual raw3/reported3, unchanged.
      assert.ok(nativeListing.content.some(record => record.ref === url))
      if (url === nativeRow.ref) return clone(nativeDetail)
      throw Error('Controlled unanswered detail: capture includes only one native detail')
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, nativeRow.id)
  assert.equal(jobs[0].jobDescription, nativeDetail.jobAd.sections.jobDescription.text)
  assert.equal(jobs[0].sourceListingComplete, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 3)
  assert.equal(evidence.indiaFacetCount, 3) // Retained upstream diagnostic, not company/returned total.
  assert.match(evidence.reason, /optional-role-details-unavailable/)
  assert.match(evidence.reason, /petrobot-explicit-bounded-run/)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.deepEqual(requests, [petro.CAREERS_URL, listingUrl, ...nativeListing.content.map(record => record.ref)])
  assert.deepEqual(nativeListing, originalSnapshot)
})

test('PetroBot matching foreign typed countries cannot silently qualify an unchanged native India location label', async () => {
  const listing = clone(original.listing), detail = clone(original.detail)
  listing.content[0].location.country = 'us'
  detail.location.country = 'us'
  await mustReject({ listing, detail }, 2)
})

const withNativeCountry = (country, fullLocation, remove = false) => {
  const listing = clone(original.listing), detail = clone(original.detail)
  for (const location of [listing.content[0].location, detail.location]) {
    location.fullLocation = fullLocation
    if (remove) delete location.country
    else location.country = country
  }
  return { listing, detail }
}
const bothSourceRows = async options => {
  const rows = []
  for (const execute of [input => petro.createPetroBotScraper().run(input), input => createCatalogScraper(provider).run(input)]) {
    const input = transport(options), jobs = await execute(input)
    input.assertUnchanged(); rows.push(jobs)
  }
  return rows
}

for (const fullLocation of ['Jaipur', 'Remote', 'Seattle, WA, United States']) {
  test('PetroBot explicit US stays foreign for native ' + fullLocation + ' without a city/provider India fallback', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
    const cohorts = await bothSourceRows(withNativeCountry('us', fullLocation))
    for (const jobs of cohorts) {
      assert.equal(jobs.length, 0)
      const evidence = readInventoryEvidence(jobs)
      assert.equal(evidence.status, 'complete-inventory') // Fully reconciled controlled one-record collection.
      assert.equal(evidence.reportedTotal, 1)
      assert.equal(evidence.indiaFacetCount, 0)
      assert.equal(isVerifiedEmptyEvidence(evidence), false) // Company/whole feed is not empty.
    }
  })
}

for (const [name, country, fullLocation, remove] of [
  ['missing city-only country', undefined, 'Jaipur', true],
  ['null remote country', null, 'Remote', false],
  ['reserved unknown country', 'zz', 'Seattle, WA, United States', false],
  ['missing country with an India location label', undefined, 'Jaipur, RJ, India', true],
]) {
  test('PetroBot ' + name + ' retains an unqualified role and holds zero/cleanup authority through real normalization', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
    const options = withNativeCountry(country, fullLocation, remove)
    for (const jobs of await bothSourceRows(options)) {
      assert.equal(jobs.length, 1)
      const job = jobs[0]
      assert.equal(job.jobId, original.detail.id)
      assert.equal(job.jobDescription, original.detail.jobAd.sections.jobDescription.text)
      assert.equal(job.applyUrl, original.detail.applyUrl)
      assert.equal(job.postingDate, original.detail.releasedDate)
      assert.equal(job.nativeGeographyQualified, false)
      for (const key of ['country', 'state', 'location', 'city']) assert.equal(job[key], null, key)
      assert.deepEqual(job.rawNativeWorkplaceEvidence.listing, options.listing.content[0].location)
      assert.deepEqual(job.rawNativeWorkplaceEvidence.detail, options.detail.location)
      const normalized = normalizeScrapedJob(job, provider)
      for (const key of ['country', 'state', 'location', 'city']) assert.equal(normalized[key], null, 'normalized ' + key)
      assert.equal(filterIndiaJobs([normalized]).length, 0)
      assert.equal(buildJobDerivedFields(normalized).isPublicIndia, false)
      const evidence = readInventoryEvidence(jobs)
      assert.equal(evidence.status, 'discovery-only')
      assert.equal(evidence.listingComplete, false)
      assert.equal(evidence.reportedTotal, 1)
      assert.equal(evidence.indiaFacetCount, null)
      assert.match(evidence.reason, /petrobot-native-geography-unresolved/)
      assert.equal(isVerifiedEmptyEvidence(evidence), false)
      assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: CLOCK }), false)
    }
  })
}

for (const fullLocation of ['Jaipur', 'Remote']) {
  test('PetroBot role-owned IN explicitly scopes ' + fullLocation + ' without a company/city country inference', async () => {
    for (const jobs of await bothSourceRows(withNativeCountry('in', fullLocation))) {
      assert.equal(jobs.length, 1)
      assert.equal(jobs[0].country, 'India')
      assert.equal(jobs[0].location, fullLocation)
      assert.equal(jobs[0].postingDate, original.detail.releasedDate)
      assert.equal(jobs[0].applyUrl, original.detail.applyUrl)
      const normalized = normalizeScrapedJob(jobs[0], provider)
      assert.equal(normalized.country, 'India')
      assert.equal(filterIndiaJobs([normalized]).length, 1) // Location policy only, not current publication.
      assert.equal(buildJobDerivedFields(normalized).isPublicIndia, true)
    }
  })
}

test('PetroBot same bound detail country can resolve an absent listing country without a provider default', async () => {
  const listing = clone(original.listing); delete listing.content[0].location.country
  for (const jobs of await bothSourceRows({ listing })) {
    assert.equal(jobs.length, 1); assert.equal(jobs[0].country, 'India')
    assert.equal(jobs[0].jobId, original.detail.id)
    assert.equal(jobs[0].postingDate, original.detail.releasedDate)
  }
})

test('PetroBot foreign filtering with an unavailable detail retains partial source authority', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
  const options = { ...withNativeCountry('us', 'Remote'), unavailable: true }
  for (const jobs of await bothSourceRows(options)) {
    assert.equal(jobs.length, 0)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.status, 'discovery-only')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, 1)
    assert.equal(evidence.indiaFacetCount, 0)
    assert.equal(isVerifiedEmptyEvidence(evidence), false)
    assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: CLOCK }), false)
  }
})

test('PetroBot explicit zero bound cannot turn an unresolved country into an authoritative empty source', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(CLOCK) })
  const options = withNativeCountry(undefined, 'Jaipur', true), input = transport(options)
  const jobs = await petro.createPetroBotScraper({ maxJobs: 0 }).run(input)
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /petrobot-native-geography-unresolved/)
  assert.match(evidence.reason, /petrobot-explicit-bounded-run/)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: CLOCK }), false)
})
