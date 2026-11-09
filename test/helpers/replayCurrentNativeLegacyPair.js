import assert from 'node:assert/strict'
import {readFileSync, statSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const supportedSources = new Set(['ai21labs', 'airfranceklm'])
// The registered legacy rows retain this label despite their native modules.
export const expectedRegistrationParsers = Object.freeze({
  ai21labs: 'runtime-verified-recruitment', airfranceklm: 'runtime-verified-recruitment',
})
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const AI21_HOME = 'https://www.ai21.com/careers/'
const AIR_HOME = 'https://recrutement.airfrance.com/accueil.aspx?lcid=2057'
const AIR_LIST = 'https://recrutement.airfrance.com/job/list-of-all-jobs.aspx?all=1&mode=list'
const AIR_ORIGIN = 'https://recrutement.airfrance.com'
const ai21Roles = [
  {id: 'CC.372', title: 'Deep Learning Engineer', url: AI21_HOME + 'deep-learning-engineer/CC.372/',
    requirementsSHA256: 'ac5c468f1fc7b2cd26063ec0ee09a6ce66366d72701f185d5c5baf8fd5737e02'},
  {id: '95.47D', title: 'Technical Project Manager \u2013 Post training', url: AI21_HOME + 'technical-project-manager-post-training/95.47D/',
    requirementsSHA256: 'fd561bbf7c4ab34fc0c9c8d447f969f034b26fb0da55fcbdac1189cce5336a38'},
  {id: '95.47C', title: 'Senior Marketing Designer', url: AI21_HOME + 'senior-marketing-designer/95.47C/',
    requirementsSHA256: 'abb4ac8a3a856b152e636a55aa80b6367884666accb83c122e44b277a608a52c'},
]
const airAttempts = [AIR_HOME, AIR_LIST,
  AIR_ORIGIN + '/offre-de-emploi/emploi--synthetic-flight-instructor-sfi-f-h_25503.aspx',
  AIR_ORIGIN + '/offre-de-emploi/emploi-business-architect-finance-achats-f-h_25698.aspx',
  AIR_ORIGIN + '/offre-de-emploi/emploi-business-architect-data-f-h_25699.aspx',
  AIR_ORIGIN + '/offre-de-emploi/emploi-vie-atlanta-sales-performance-analyst-f-h_25764.aspx',
  AIR_ORIGIN + '/offre-de-emploi/emploi-mecanicienne-mecanicien-cabine-toulouse-f-h_23769.aspx',
]
const attemptsFor = source => source === 'ai21labs' ? [AI21_HOME, ...ai21Roles.map(row => row.url)] : airAttempts
const observationClock = () => '2026-11-07T09:00:00.000Z'

function assertProvider(provider) {
  assert.ok(supportedSources.has(provider.source), 'Unsupported current native legacy source')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.parser, expectedRegistrationParsers[provider.source])
  assert.equal(provider.companyCareerPage, provider.source === 'ai21labs' ? AI21_HOME : AIR_HOME)
  for (const key of ['sourceScopeComplete', 'lifecycleCleanupAllowed']) assert.equal(provider[key], false)
  for (const key of ['verifiedPublicJobCount', 'verifiedIndiaJobCount']) assert.equal(provider[key], null)
}

function originalPackets(source) {
  const path = new URL('../test-data/currentNativeLegacyPair20261107.json.gz', import.meta.url)
  assert.ok(statSync(path).size <= 512 * 1024, 'Compressed native fixture exceeds its bound')
  const encoded = readFileSync(path)
  assert.equal(sha(encoded), '682391e06f44b2da5832566d6edda53e3d5283dfcf6b5e29a8d8d964fc153775')
  const decoded = gunzipSync(encoded, {maxOutputLength: 2 * 1024 * 1024})
  assert.equal(decoded.length, 879850)
  const fixture = JSON.parse(decoded.toString('utf8'))
  assert.equal(fixture.kind, 'saved-first-party-original-native-unit-inputs')
  const rows = fixture.sources[source]
  assert.equal(rows.length, source === 'ai21labs' ? 4 : 5)
  const packets = new Map()
  for (const row of rows) {
    const bytes = Buffer.from(row.bodyBase64, 'base64')
    assert.equal(bytes.length, row.bytes)
    assert.equal(sha(bytes), row.sha256)
    assert.equal(row.method, 'GET'); assert.equal(row.status, 200)
    assert.equal(row.finalUrl, row.requestedUrl); assert.equal(row.bodyUnavailable, false)
    assert.match(row.contentType, /^text\/html\b/i)
    assert.ok(Date.parse(row.sourceRequestedAt) <= Date.parse(row.sourceCompletedAt))
    assert.equal(packets.has(row.requestedUrl), false)
    packets.set(row.requestedUrl, {row, bytes})
  }
  return packets
}

function expectedNativeModels(source) {
  const path = new URL('../test-data/currentNativeLegacyPair20261107.expected.json.gz', import.meta.url)
  assert.ok(statSync(path).size <= 128 * 1024, 'Compressed native oracle exceeds its bound')
  const encoded = readFileSync(path)
  assert.equal(sha(encoded), 'fc747c3318e509f7503b5cf522b3230d90e9a683136ededabccf86f4042c20f0')
  const decoded = gunzipSync(encoded, {maxOutputLength: 512 * 1024})
  assert.equal(decoded.length, 130200)
  const oracle = JSON.parse(decoded.toString('utf8'))
  assert.equal(oracle.kind, 'independent-python-htmlparser-full-original-native-oracle')
  assert.equal(oracle.generation.productionModulesImported, false)
  return oracle.sources[source]
}

function assertRequest(input, init, expectedURL) {
  assert.equal(String(input), expectedURL, 'Native reader issued an unexpected request')
  assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit')
  assert.equal(init.body, undefined)
  const headers = new Headers(init.headers)
  assert.equal(headers.get('accept'), 'text/html')
  assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false)
  init.signal.throwIfAborted()
}

function capturedResponse(row, bytes) {
  const response = new Response(bytes, {status: row.status, headers: row.headers})
  Object.defineProperties(response, {
    url: {value: row.finalUrl},
    sourceCapture: {value: Object.freeze({requestedURL: row.requestedUrl, finalURL: row.finalUrl,
      status: row.status, bodyUnavailable: false, bodySHA256: sha(bytes), bodyBytes: bytes.length,
      sourceRequestedAt: row.sourceRequestedAt, sourceCompletedAt: row.sourceCompletedAt})},
  })
  return response
}

function offlineTransport(t, source) {
  const packets = originalPackets(source), calls = [], expected = attemptsFor(source)
  const fetchImpl = async (input, init) => {
    assertRequest(input, init, expected[calls.length])
    const url = String(input), packet = packets.get(url)
    calls.push({url, status: packet?.row.status ?? null, bodySHA256: packet?.row.sha256 ?? null})
    if (!packet) throw Object.assign(Error('Saved original offline entity not retained'), {code: 'OFFLINE_INPUT_NOT_PROVIDED'})
    return capturedResponse(packet.row, packet.bytes)
  }
  return {packets, calls, fetchImpl}
}

function assertIncomplete(jobs, source, count, status) {
  assert.equal(jobs.length, 0, 'Country/employer-unqualified native rows must remain observations')
  assert.deepEqual(readSourceObservationEvidence(jobs, source), {
    source, recordKind: 'vacancy-rows', observedRecordCount: count, observedVacancyCount: count,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
  })
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, status); assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null); assert.equal(inventory.indiaFacetCount, null)
  assert.notEqual(inventory.status, 'verified-empty')
}

function assertReceipt(receipt, packet, source) {
  assert.equal(receipt.status, packet.row.status)
  assert.equal(receipt.sourceRequestedAt, packet.row.sourceRequestedAt)
  assert.equal(receipt.sourceCompletedAt, packet.row.sourceCompletedAt)
  assert.equal(receipt.contentType ?? receipt.headers['content-type'], packet.row.contentType)
  if (source === 'ai21labs') {
    assert.equal(receipt.finalURL, packet.row.finalUrl)
    assert.equal(receipt.bodySHA256, packet.row.sha256); assert.equal(receipt.bodyBytes, packet.bytes.length)
    assert.equal(receipt.byteProvenance, 'original-response-stream')
  } else {
    assert.equal(receipt.finalUrl, packet.row.finalUrl)
    assert.equal(receipt.sha256, packet.row.sha256); assert.equal(receipt.bytes, packet.bytes.length)
    assert.equal(receipt.bodyBase64, packet.row.bodyBase64)
    assert.equal(receipt.bodyComplete, true); assert.equal(receipt.transportQualified, true)
  }
}

// Historical unit inputs are not a current acquisition or a closing recheck.
// Missing Air France inputs receive no invented HTTP status.
export async function assertCurrentNativeExtraction(t, provider) {
  assertProvider(provider)
  const source = provider.source, io = offlineTransport(t, source), expected = expectedNativeModels(source), audits = []
  const jobs = await createCatalogScraper(provider).run({fetchImpl: io.fetchImpl, now: observationClock,
    maxRequests: source === 'ai21labs' ? 4 : 7, maxPages: 2, maxDetails: source === 'ai21labs' ? 3 : 5,
    onAudit: audit => audits.push(audit)})
  assert.equal(audits.length, 1)
  const audit = audits[0]
  assert.equal(audit.source, source)
  assert.deepEqual(io.calls.map(call => call.url), attemptsFor(source))
  for (const key of ['sourceScopeComplete', 'lifecycleCleanupAllowed']) assert.equal(audit[key], false)
  for (const key of ['companyGlobalTotal', 'companyIndiaTotal']) assert.equal(audit[key], null)
  assert.equal(audit.responses.length, io.calls.length)
  for (const receipt of audit.responses) {
    const url = source === 'ai21labs' ? receipt.requestedURL : receipt.requestUrl
    const packet = io.packets.get(url)
    if (packet) assertReceipt(receipt, packet, source)
    else {
      assert.equal(source, 'airfranceklm'); assert.equal(receipt.status, null)
      assert.equal(receipt.sha256, null); assert.equal(receipt.bodyBase64, null)
      assert.equal(receipt.transportQualified, false); assert.equal(receipt.error.code, 'OFFLINE_INPUT_NOT_PROVIDED')
    }
  }
  if (source === 'ai21labs') {
    assertIncomplete(jobs, source, 3, 'discovery-only')
    // Independently extracted full publisher sections and every returned native
    // role field must agree, including the genuinely empty TPM subsection.
    assert.deepEqual(audit.nativeObservations, expected.nativeObservations)
    assert.equal(audit.nativeObservations.length, 3)
    for (const [index, expected] of ai21Roles.entries()) {
      const row = audit.nativeObservations[index]
      for (const key of ['id', 'title', 'url']) assert.equal(row[key], expected[key])
      for (const key of ['country', 'legalEmployer', 'postingDate', 'closingDate']) assert.equal(row[key], null)
      assert.equal(row.location, 'Tel Aviv-Yafo'); assert.equal(row.employmentType, 'Full-time')
      assert.equal(row.nativeEmployerBrand, 'AI21 Labs'); assert.equal(row.sourceDetailComplete, true)
      assert.deepEqual(row.sections.map(section => section.heading), ['Description', 'Role and Responsibilities', 'Requirements', 'About Us'])
      assert.equal(sha(row.criteria.requirements), expected.requirementsSHA256)
      assert.equal(row.criteria.requirements, row.sections[2].text)
      assert.equal(row.applicationVisited, false)
    }
    assert.equal(audit.nativeObservations[1].sections[1].text, '')
    for (const key of ['sourceCompanyWideScopeComplete', 'indiaScopeComplete', 'nativeInventoryComplete', 'sourceFreshnessRenewed']) assert.equal(audit[key], false)
  } else {
    assertIncomplete(jobs, source, 50, 'coverage-gap')
    assert.deepEqual(jobs.nativeCollectionEvidence, audit)
    // These full expected arrays come from the saved original bodies through
    // Python HTMLParser, without importing a production scraper/HTML utility.
    assert.deepEqual(audit.records, expected.records)
    assert.deepEqual(audit.detailRecords, expected.detailRecords)
    assert.equal(audit.records.length, 50); assert.equal(audit.uninspectedIds.length, 47)
    assert.deepEqual(audit.detailRecords.map(row => [row.id, row.country, row.legalEmployer]),
      [['25698', 'France', null], ['25699', 'France', null], ['23769', 'France', null]])
    assert.equal(audit.records.filter(row => row.country === null).length, 47)
    const [finance, data, mechanical] = audit.detailRecords
    assert.equal(finance.title, 'Business Architect Finance & Achats F/H'); assert.equal(finance.reference, '2026-25698')
    assert.equal(finance.minimumQualification, 'Bac + 5 et plus'); assert.equal(finance.experienceRequired, 'Plus de 3 ans')
    assert.equal(finance.language, 'Anglais (4 - Confirm\u00e9 / C1)')
    assert.match(finance.mission, /D\u00e9velopper la communaut\u00e9 Architecture/)
    assert.equal(data.desiredStartDateRaw, '01/01/2027')
    assert.match(data.profile, /Une connaissance de SQL, des outils de DataViz, et de l\u2019environnement GCP est requise\./)
    assert.match(data.profile, /Si vous \u00eates convainc/)
    assert.equal(mechanical.minimumQualification, 'CAP / BEP'); assert.equal(mechanical.experienceRequired, null)
    assert.match(mechanical.profile, /CECRL B1/); assert.match(mechanical.profile, /Rejoignez-nous et contribuez \u00e0 l'excellence/)
    for (const row of audit.detailRecords) {
      assert.ok(row.context && row.mission && row.profile); assert.equal(row.fullCriteriaComplete, true)
      assert.ok(row.nativeEntityContext.includes('groupe Air France /KLM'))
      assert.equal(row.nativeEmployerScope, 'unqualified-parent-group-context')
      assert.equal(row.postingDate, null); assert.equal(row.closingDate, null); assert.equal(row.applicationVisited, false)
      assert.equal(row.sourceScopeComplete, false); assert.equal(row.lifecycleCleanupAllowed, false)
    }
    assert.equal(audit.responses.filter(row => row.status === null).length, 2)
    assert.equal(audit.exclusions.filter(row => row.reason === 'native-explicit-non-India-country').length, 3)
    assert.equal(audit.mixedPublisherReportedTotal, 105); assert.equal(audit.paginationDeclarations.length, 2)
    for (const key of ['nativeIndiaTotal', 'nativeReportedTotal', 'inventoryVerifiedAt']) assert.equal(audit[key], null)
    for (const key of ['listingComplete', 'corporateJavaScriptExecuted', 'subresourcesRequested', 'redirectsFollowed']) assert.equal(audit[key], false)
    assert.equal(readInventoryEvidence(jobs).verifiedAt, null)
  }
  return {jobs, audit, calls: io.calls}
}

export async function assertCurrentNativeDenial(t, provider) {
  assertProvider(provider)
  const source = provider.source, url = attemptsFor(source)[0], calls = []
  // This denial is a controlled test input, not a recorded publisher response.
  const bytes = Buffer.from('Forbidden'), row = {requestedUrl: url, finalUrl: url, status: 403,
    headers: {'content-type': 'text/html; charset=utf-8'},
    sourceRequestedAt: '2026-11-08T00:00:00.000Z', sourceCompletedAt: '2026-11-08T00:00:00.001Z'}
  await assert.rejects(createCatalogScraper(provider).run({now: observationClock, fetchImpl: async (input, init) => {
    assert.equal(calls.length, 0, 'Primary denial must stop all later reads')
    assertRequest(input, init, url); calls.push(String(input)); return capturedResponse(row, bytes)
  }}), error => {
    assert.equal(error.status, 403); assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.softFailure, true); assert.equal(error.abortRetries, true); assert.equal(error.lifecycleCleanupAllowed, false)
    const audit = source === 'ai21labs' ? error.nativeEvidence : error.sourceAudit
    assert.equal(audit.source, source); assert.equal(audit.responses.length, 1)
    assert.equal(audit.sourceScopeComplete, false); assert.equal(audit.lifecycleCleanupAllowed, false)
    assert.equal(audit.companyGlobalTotal, null); assert.equal(audit.companyIndiaTotal, null)
    const receipt = audit.responses[0]
    assert.equal(receipt.status, 403)
    assert.equal(source === 'ai21labs' ? receipt.requestedURL : receipt.requestUrl, url)
    assert.equal(source === 'ai21labs' ? receipt.finalURL : receipt.finalUrl, url)
    assert.equal(source === 'ai21labs' ? receipt.bodySHA256 : receipt.sha256, sha(bytes))
    assert.equal(source === 'ai21labs' ? receipt.bodyBytes : receipt.bytes, bytes.length)
    assert.equal(receipt.sourceRequestedAt, row.sourceRequestedAt); assert.equal(receipt.sourceCompletedAt, row.sourceCompletedAt)
    if (source === 'ai21labs') assert.equal(audit.nativeObservations.length, 0)
    else {
      assert.equal(Buffer.from(receipt.bodyBase64, 'base64').toString('utf8'), 'Forbidden')
      assert.equal(audit.records.length, 0); assert.equal(audit.detailRecords.length, 0)
      assert.equal(error.inventoryEvidence.status, 'coverage-gap'); assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    }
    return true
  })
  assert.deepEqual(calls, [url])
  return {calls}
}
