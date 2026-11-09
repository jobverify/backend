import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createAmtexSystemsScraper, CAREERS_URL, extractRealCareerLinks, hasOfficialCareersSignal } from '../../scraper/amtexsystems/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'

// The originals are exact decoded saved entities, not India recovery fixtures.
// Every mutation below is a SYNTHETIC control; it makes no current vacancy claim.
const originalCareers = readFileSync(new URL('./fixtures/amtex-20261107-c40/careers.original.html', import.meta.url), 'utf8')
const originalDetail = readFileSync(new URL('./fixtures/amtex-20261107-c40/business-analyst.original.html', import.meta.url), 'utf8')
const DETAIL_URL = 'https://www.amtexsystems.com/career-list/business-analyst'
const FIXED_TIME = '2026-11-07T15:29:39.857Z'
const networkFetch = globalThis.fetch
globalThis.fetch = async () => { throw new Error('Amtex tests forbid public network access') }
after(() => { globalThis.fetch = networkFetch })

const activeCriteria = '<h3>Responsibilities</h3><p>Build BI dashboards, validate financial risk metrics, and maintain ETL pipelines for production reporting.</p><h3>Qualifications</h3><ul><li>Required: Bachelor’s degree in Computer Science and 4 years of SQL experience.</li><li>Preferred: Power BI, PL/SQL, and production support experience.</li></ul>'
const expectedCriteria = 'Responsibilities Build BI dashboards, validate financial risk metrics, and maintain ETL pipelines for production reporting. Qualifications Required: Bachelor’s degree in Computer Science and 4 years of SQL experience. Preferred: Power BI, PL/SQL, and production support experience.'
const compact = value => String(value).replace(/\s+/g, ' ').trim()
const withLocation = location => originalDetail.replace('Join our team in New York, NY', 'Join our team in ' + location)
const withCriteria = (html, criteria) => html.replace('<div class="jobs1">', '<div class="jobs1">' + criteria)
const syntheticIndia = criteria => withCriteria(withLocation('Bengaluru, India'), criteria)
const source = () => createAmtexSystemsScraper({ now: () => FIXED_TIME })
const replay = async (detail = originalDetail, extra = {}) => {
  const requested = []
  const pages = new Map([[CAREERS_URL, originalCareers], [DETAIL_URL, detail]])
  const jobs = await source().run({
    fetchText: async (url, options) => {
      requested.push({ url, options })
      assert.ok(pages.has(url), 'Only the two saved documentary URLs may be read')
      return pages.get(url)
    },
    ...extra,
  })
  return { jobs, requested }
}

test('Amtex Systems exact current originals retain form context without inventing vacancy criteria or country', async () => {
  assert.equal(createHash('sha256').update(originalCareers).digest('hex'), '460062b1ec9c87feb2ff64a4b4357f2e582d50ee45db545e26ad4f9c66ac3ce5')
  assert.equal(createHash('sha256').update(originalDetail).digest('hex'), '787b01dc09742cd535e537dc783a7cdf6f41538fce358e84ba7f026d3c72381d')
  let audit, returnedRecords
  const { jobs, requested } = await replay(originalDetail, {
    onAudit: value => { audit = value }, onRecords: value => { returnedRecords = value },
  })
  assert.deepEqual(jobs, [])
  assert.deepEqual(requested.map(row => row.url), [CAREERS_URL, DETAIL_URL])
  assert.deepEqual(returnedRecords, [])
  assert.equal(audit.observations.length, 1)
  const context = audit.observations[0]
  assert.equal(context.kind, 'application-form-role-context')
  assert.equal(context.id, null)
  assert.equal(context.title, 'Business Intelligence Analyst/Developer')
  assert.equal(context.location, 'New York, NY')
  assert.equal(context.country, null)
  assert.equal(context.legalEmployer, null)
  assert.equal(context.sourceDescription, null)
  assert.ok(context.unresolved.includes('native-full-criteria-unavailable'))
  assert.ok(context.unresolved.includes('native-country-unresolved'))
  assert.equal(audit.companyGlobalTotal, null)
  assert.equal(audit.companyIndiaTotal, null)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.deepEqual(readSourceObservationEvidence(jobs, 'amtexsystems'), {
    source: 'amtexsystems', recordKind: 'hiring-signals', observedRecordCount: 1,
    observedVacancyCount: 0, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
  })
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Amtex Systems synthetic India location alone cannot turn the original form into an invented JD', async () => {
  const { jobs } = await replay(withLocation('Bengaluru, India'))
  assert.deepEqual(jobs, [])
})

test('Amtex Systems synthetic active India criteria retain every supplied requirement without form or inert text', async () => {
  const html = syntheticIndia(activeCriteria + '<!-- Secret comment criterion --><script>"Script-only criterion"</script><p hidden>Hidden-only criterion</p><form><label>Position Applying For</label><select><option>Dropdown-only criterion</option></select></form>')
  const { jobs } = await replay(html)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Business Intelligence Analyst/Developer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(compact(jobs[0].jobDescription), expectedCriteria)
  assert.equal(jobs[0].sourceDescription, jobs[0].jobDescription)
  assert.doesNotMatch(jobs[0].jobDescription, /Official Amtex Systems detail-page|Secret comment|Script-only|Hidden-only|Dropdown-only|Position Applying For/)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs[0].nativeLegalEmployer, null)
  assert.equal(jobs[0].postingDate, null)
})

test('Amtex Systems synthetic activation of original commented criteria preserves the whole text as unqualified context', async () => {
  // Only this test activates the original OBIEE comment. It is not current evidence.
  const activated = originalDetail.replace(/<!--(\s*<div class="boldFont1">OBIEE\/BI Analyst,[\s\S]*?)-->/, '$1')
  assert.notEqual(activated, originalDetail)
  let audit
  const { jobs } = await replay(activated, { onAudit: value => { audit = value } })
  assert.deepEqual(jobs, [])
  assert.equal(audit.observations[0].country, null)
  assert.equal(compact(audit.observations[0].sourceDescription), 'OBIEE/BI Analyst, New York, NY: Limited domestic travel to various unanticipated client locations nationwide, telecommute and/or occasional relocation to analyze data; apply statistical and predictive modeling; develop machine learning models; calculate financial risk metrics; design BI dashboards; build ETL workflows; perform PL/SQL development; support cloud migrations; automate reporting; manage batch jobs; support AWS infrastructure; use Agile tools. Administer, maintain BI environments, including OBIEE and Power BI servers, performing system monitoring, health checks, and load balancing. Manage user access and security. Salary: $172,994/yr. Reply to: Amtex Systems, Inc., 7 World Trade Center, 46th Fl, Suite 4625, 250 Greenwich Street, New York, NY 10007')
})

for (const [label, criteria] of [
  ['HTML comment', '<!--' + activeCriteria + '-->'],
  ['template', '<template>' + activeCriteria + '</template>'],
  ['script', '<script type="text/plain">' + activeCriteria + '</script>'],
  ['object fallback', '<object>' + activeCriteria + '</object>'],
  ['inline hidden subtree', '<section hidden>' + activeCriteria + '</section>'],
  ['local CSS hidden subtree', '<style>.synthetic-inactive{display:none}</style><section class="synthetic-inactive">' + activeCriteria + '</section>'],
  ['application form and dropdown', '<form><div>' + activeCriteria + '</div><select><option>Software Engineer</option></select></form>'],
]) test('Amtex Systems excludes synthetic criteria supplied only by ' + label, async () => {
  const { jobs } = await replay(syntheticIndia(criteria))
  assert.deepEqual(jobs, [])
})

for (const [label, prefix] of [
  ['comment', '<!--<h2 class="amtex-form-title">Apply for Fake India Role</h2><p class="amtex-form-subtitle">Join our team in Bengaluru, India</p>-->'],
  ['template', '<template><h2 class="amtex-form-title">Apply for Fake India Role</h2><p class="amtex-form-subtitle">Join our team in Bengaluru, India</p></template>'],
  ['script', '<script type="text/plain"><h2 class="amtex-form-title">Apply for Fake India Role</h2><p class="amtex-form-subtitle">Join our team in Bengaluru, India</p></script>'],
  ['hidden subtree', '<section hidden><h2 class="amtex-form-title">Apply for Fake India Role</h2><p class="amtex-form-subtitle">Join our team in Bengaluru, India</p></section>'],
]) test('Amtex Systems ignores synthetic ' + label + ' identity before the genuine New York form', async () => {
  const { jobs } = await replay(prefix + withCriteria(originalDetail, activeCriteria))
  assert.deepEqual(jobs, [])
})

for (const [location, reason] of [
  ['Hyderabad, United States', 'a city substring cannot override an explicit foreign country'],
  ['Bengaluru, India / United States', 'conflicting explicit countries remain unresolved'],
  ['Bengaluru', 'a city alone supplies no explicit native country'],
]) test('Amtex Systems ' + reason, async () => {
  const { jobs } = await replay(withCriteria(withLocation(location), activeCriteria))
  assert.deepEqual(jobs, [])
})

test('Amtex Systems does not promote a synthetic corporate Organization address into vacancy geography', async () => {
  const html = withCriteria(withLocation('Location to be confirmed'), activeCriteria) + '<script type="application/ld+json">{"@type":"Organization","address":{"addressCountry":"India"}}</script>'
  const { jobs } = await replay(html)
  assert.deepEqual(jobs, [])
})

test('Amtex Systems only follows active native career cards and excludes external or form options', () => {
  const html = '<!--<a class="tiles3A randomise" href="/career-list/commented"></a>--><template><a class="tiles3A randomise" href="/career-list/template"></a></template><a class="tiles3A randomise" href="https://example.test/career-list/foreign"></a><a href="/career-list/business-analyst" class="randomise tiles3A">Business Intelligence</a><select><option value="/career-list/option">Software Engineer</option></select><a class="tiles3A randomise" href="#"></a>'
  assert.deepEqual(extractRealCareerLinks(html), [DETAIL_URL])
})

test('Amtex Systems refuses a careers shell whose trusted signals are only commented out', async () => {
  const inert = '<!--<h2 class="amtex-form-title">Join Our Team</h2><label>Position Applying For</label><a class="tiles3A randomise" href="/career-list/business-analyst"></a>-->'
  assert.equal(hasOfficialCareersSignal(inert), false)
  await assert.rejects(source().run({ fetchText: async () => inert }), /Amtex Systems verified careers page no longer matches the trusted first-party shell/)
})

for (const at of ['careers', 'detail']) test('Amtex Systems preserves the exact injected ' + at + ' read failure', async () => {
  const reason = Object.freeze({ failure: at })
  await assert.rejects(source().run({ fetchText: async url => {
    if (at === 'careers' || url === DETAIL_URL) throw reason
    return originalCareers
  } }), error => error === reason)
})

test('Amtex Systems supplied pre-abort prevents reads and preserves an opaque reason', async () => {
  const controller = new AbortController()
  const reason = Object.freeze({ canceled: 'before-read' })
  controller.abort(reason)
  let reads = 0
  await assert.rejects(source().run({ signal: controller.signal, fetchText: async url => {
    reads++
    return url === CAREERS_URL ? originalCareers : originalDetail
  } }), error => error === reason)
  assert.equal(reads, 0)
})

test('Amtex Systems forwards cancellation to the read and stops before the next saved page', async () => {
  const controller = new AbortController()
  const reason = Object.freeze({ canceled: 'during-read' })
  let reads = 0, forwarded
  await assert.rejects(source().run({ signal: controller.signal, fetchText: async (url, options) => {
    reads++
    forwarded = options?.signal
    controller.abort(reason)
    return originalCareers
  } }), error => error === reason)
  assert.equal(forwarded, controller.signal)
  assert.equal(reads, 1)
})

test('Amtex Systems qualifies exact injected page responses without using the legacy text path', async () => {
  let audit
  const jobs = await source().run({ fetchPage: async (url, options) => ({ status: 200, url, contentType: 'text/html', html: url === CAREERS_URL ? originalCareers : originalDetail }),
    fetchText: async () => { throw new Error('Page transport must not also read text') }, onAudit: value => { audit = value } })
  assert.deepEqual(jobs, [])
  assert.equal(audit.pagesFetched, 2)
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
})

test('Amtex Systems preserves caller cancellation when a record callback also rejects', async () => {
  const controller = new AbortController()
  const reason = Object.freeze({ canceled: 'during-record-callback' })
  const secondary = Object.freeze({ callbackFailure: true })
  await assert.rejects(replay(originalDetail, { signal: controller.signal, onRecords: async () => {
    controller.abort(reason)
    throw secondary
  } }), error => error === reason)
})

test('Amtex Systems refuses an injected HTTP failure instead of publishing the apparent HTML', async () => {
  await assert.rejects(source().run({ fetchPage: async url => ({ status: 403, url, contentType: 'text/html', html: originalCareers }) }), /Amtex Systems HTTP 403/)
})

test('Amtex Systems refuses a changed detail response identity', async () => {
  await assert.rejects(source().run({ fetchPage: async url => ({ status: 200, url: url === CAREERS_URL ? url : CAREERS_URL, contentType: 'text/html', html: url === CAREERS_URL ? originalCareers : syntheticIndia(activeCriteria) }) }), /Amtex Systems public response changed the requested page/)
})


// Synthetic MIME controls exercise the actual source read path. The HTML body
// is a controlled active India variant, never a new original vacancy capture.
for (const contentType of [
  'application/json; profile=text/html',
  'text/plain; note=application/xhtml+xml',
  'text/html+json',
  'application/xhtml+xml-extra',
]) test('Amtex Systems MIME token rejects misleading type ' + contentType, async () => {
  await assert.rejects(source().run({ fetchPage: async url => ({
    status: 200, url,
    contentType: url === CAREERS_URL ? 'text/html' : contentType,
    html: url === CAREERS_URL ? originalCareers : syntheticIndia(activeCriteria),
  }) }), /Amtex Systems public response is not HTML/)
})

for (const contentType of [
  ' text/html ; charset=UTF-8',
  'Application/Xhtml+Xml; charset=utf-8',
  'TeXt/HtMl',
]) test('Amtex Systems MIME token accepts declared HTML type ' + contentType, async () => {
  const jobs = await source().run({ fetchPage: async url => ({
    status: 200, url, contentType,
    html: url === CAREERS_URL ? originalCareers : syntheticIndia(activeCriteria),
  }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(compact(jobs[0].sourceDescription), expectedCriteria)
})

for (const [label, contentType] of [['missing', undefined], ['null', null], ['empty', '']]) {
  test('Amtex Systems MIME token preserves the optional ' + label + ' type contract', async () => {
    const jobs = await source().run({ fetchPage: async url => ({
      status: 200, url, contentType,
      html: url === CAREERS_URL ? originalCareers : syntheticIndia(activeCriteria),
    }) })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].country, 'India')
    assert.equal(compact(jobs[0].sourceDescription), expectedCriteria)
  })
}
