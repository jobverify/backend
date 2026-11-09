import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createBaswareScraper } from './native.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
import { readInventoryEvidence, isCompleteScraperAttempt, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../../scraper-support/utils/scraperOutcome.js'
import { parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { readBaswareRawScripts } from './scriptExecution.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/public-inventory-20261101.json.gz', import.meta.url))))
const primaryURL = 'https://careers.basware.com/'
const widgetURL = 'https://cdn.jobylon.com/jobs/company-groups/195/embed/v2/?target=jobylon-jobs-widget&page_size=5'
const loaderURL = 'https://cdn.jobylon.com/embedder.js'
const controllerURL = 'https://static-eu.jobylon.com/js/embed-v2.min.d139cbc386fa.js'
const detailURL = 'https://emp.jobylon.com/jobs/377460-basware-senior-cloud-developer/'
const evidenceKey = Symbol.for('jobverify.native-html-evidence')
const originalBody = url => Buffer.from(capture.retainedResponses.find(response => response.url === url).rawBodyBase64, 'base64').toString('utf8')
const editRows = (html, edit) => html.replace(/JBL\.embed_v2\['jobs'\] = (\[[\s\S]*?\]);/, (_all, text) => {
  const rows = parseRemoteLiteral(text)
  return "JBL.embed_v2['jobs'] = " + JSON.stringify(edit(rows) || rows) + ';'
})
const replay = (overrides = {}, transformResponse = response => response) => {
  const requests = [], ordinals = new Map()
  return { requests, transport: async (url, options) => {
    requests.push(url)
    const ordinal = ordinals.get(url) || 0
    ordinals.set(url, ordinal + 1)
    const originals = capture.retainedResponses.filter(response => response.url === url)
    assert.ok(originals.length, 'Unexpected native URL: ' + url)
    const original = originals[Math.min(ordinal, originals.length - 1)]
    const body = Buffer.from(original.rawBodyBase64, 'base64').toString('utf8')
    const override = overrides[url]
    const value = typeof override === 'function' ? await override(body, ordinal, options) : override ?? body
    if (value instanceof Error) throw value
    return transformResponse({ url, status: original.status,
      headers: original.headers || (original.status === 302 ? { location: original.location }
        : { 'content-type': url.endsWith('.js') ? 'text/javascript' : 'text/html' }),
      body: Buffer.from(value), bodyComplete: true, requestedAt: original.requestedAt, completedAt: original.completedAt })
  } }
}

const assertPartial = jobs => {
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(jobs[evidenceKey].cleanupAllowed, false)
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence: readInventoryEvidence(jobs), detailHealth: extractionDetailHealth(jobs) }), { replaceExisting: false })
}

test('registered Basware current public inventory completes all 25 rows and 17 original-date India details with coherent lifecycle evidence', async () => {
  const provider = getScraperCatalog().find(item => item.source === 'basware')
  const input = replay()
  const jobs = await createCatalogScraper(provider).run(input)
  assert.equal(jobs.length, 17)
  const inventory = readInventoryEvidence(jobs), native = jobs[0].nativeCollectionEvidence
  assert.equal(inventory.status, 'complete-inventory')
  assert.equal(inventory.listingComplete, true)
  assert.equal(inventory.firstParty, true)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, 17)
  assert.equal(inventory.pagesFetched, 1)
  assert.equal(inventory.verifiedAt, '2026-11-01T00:51:29.549Z')
  assert.equal(native.observedListingCount, 25)
  assert.equal(native.observedIndiaListingCount, 17)
  assert.equal(native.nonIndiaListingCount, 8)
  assert.equal(native.sourceScopeComplete, true)
  assert.equal(native.cleanupAllowed, true)
  assert.equal(native.wholeCompanyScope, null)
  assert.equal(native.legalEmployer, null)
  assert.deepEqual(native.failures, [])
  assert.equal(input.requests.filter(url => url === widgetURL).length, 2)
  assert.equal(input.requests.filter(url => url === loaderURL).length, 1)
  assert.equal(input.requests.filter(url => url === controllerURL).length, 1)
  const role = jobs.find(job => job.jobId === '377460')
  assert.equal(role.postingDate, '2026-08-21T07:18:19+00:00')
  assert.equal(role.nativePublicationDate, '2026-08-21T07:18:19+00:00')
  assert.equal(role.legalEmployer, null)
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.sourceListingComplete && job.sourceScopeComplete && job.lifecycleCleanupAllowed))
  assert.ok(jobs.every(job => job.nativeFacts.sourceScopeComplete && job.nativeCollectionEvidence.sourceScopeComplete && job.nativeCollectionEvidence.cleanupAllowed))
  const detailHealth = extractionDetailHealth(jobs)
  assert.equal(detailHealth.complete, true)
  assert.ok(detailHealth.nativeCollections.every(collection => collection.complete && collection.nativeListingCountryCounts.reconciled))
  const attempt = { success: true, inventoryEvidence: inventory, detailHealth, completedAt: '2026-11-01T00:52:00.000Z' }
  assert.equal(isCompleteScraperAttempt(attempt, { now: '2026-11-01T00:52:00.000Z' }), true)
  assert.deepEqual(inventoryCleanupOptions(attempt), {})
  assert.equal(isFreshCompleteInventoryEvidence(inventory, { now: '2026-11-05T00:23:00.000Z' }), false)
})

for (const [label, change] of [
  ['another ATS link', html => html.replace('</body>', '<a href="https://job-boards.greenhouse.io/basware">Open roles</a></body>')],
  ['another recruiting account iframe', html => html.replace('</body>', '<iframe src="https://emp.jobylon.com/companies/999-basware/"></iframe></body>')],
  ['another recruiting script', html => html.replace('</body>', '<script src="https://jobs.lever.co/basware/embed.js"></script></body>')],
  ['another same-site inventory', html => html.replace('</body>', '<a href="/open-roles/">View all vacancies</a></body>')],
  ['an unfamiliar recruiting provider', html => html.replace('</body>', '<a href="https://hire.example/basware">Careers</a></body>')],
  ['an unfamiliar jobs subdomain without link text', html => html.replace('</body>', '<a href="https://jobs.example/basware"></a></body>')],
  ['active filters in the configured widget', html => html.replace('var jbl_page_size = 5;', 'var jbl_page_size = 5; var jbl_filters = {department_ids:[1940]};')],
  ['another active widget', html => html.replace('var jbl_page_size = 5;', 'var jbl_page_size = 5; var jbl_widgets = [{id:999,type:"company",version:"v2",target:"other"}];')],
  ['a separate active filter override', html => html.replace('</body>', '<script>window.jbl_filters = {country:"India"};</script></body>')],
]) {
  test(`Basware retains verified roles but leaves inventory partial for ${label}`, async () => {
    const changed = change(originalBody(primaryURL))
    assert.notEqual(changed, originalBody(primaryURL))
    const jobs = await createBaswareScraper().run(replay({ [primaryURL]: changed }))
    assert.equal(jobs.length, 17)
    assertPartial(jobs)
    assert.ok(jobs[evidenceKey].failures.some(failure => failure.stage === 'public-inventory-proof'))
  })
}

test('Basware does not treat inert alternate ATS markup or employee stories as an active second inventory', async () => {
  const jobs = await createBaswareScraper().run(replay({ [primaryURL]: html => html.replace('</body>',
    '<!-- <a href="https://jobs.lever.co/other">Jobs</a> --><template><iframe src="https://jobs.lever.co/other"></iframe></template></body>') }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

for (const [label, change] of [
  ['unknown country', row => { row.departments = ['Atlantis - Gent'] }],
  ['missing country-office labels', row => { row.departments = [] }],
  ['absent country-office property', row => { delete row.departments }],
  ['missing physical location', row => { row.locations = [] }],
  ['absent physical location property', row => { delete row.locations }],
  ['unknown foreign office', row => { row.locations = ['Unreviewed office'] }],
  ['contradictory known country-office pair', row => { row.departments = ['India - Gent'] }],
  ['unmatched extra physical office', row => { row.locations.push('Chandigarh') }],
  ['contradictory additional country-office pair', row => { row.departments.push('India - Paris') }],
]) {
  test(`Basware retains India positives and disables public completeness for a foreign row with ${label}`, async () => {
    const jobs = await createBaswareScraper().run(replay({ [widgetURL]: html => editRows(html, rows => { change(rows.find(row => row.id === '392524')) }) }))
    assert.equal(jobs.length, 17)
    assertPartial(jobs)
    assert.ok(jobs[evidenceKey].unknownRawFailures.some(failure => failure.stage === 'public-inventory-geography'))
  })
}

test('Basware current complete source accepts the reviewed USA, Netherlands and native office aliases', async () => {
  const result = await createBaswareScraper().collect(replay())
  assert.equal(result.sourceScopeComplete, true)
  assert.equal(result.observedIndiaListingCount, 17)
  assert.equal(result.nonIndiaListingCount, 8)
  assert.equal(result.listingRecords.find(row => row.id === '377564').nativeRecord.workspace, 'Remote')
  assert.equal(result.jobs.length, 17)
})

test('Basware changed native controller stays partial while preserving all verified India roles', async () => {
  const jobs = await createBaswareScraper().run(replay({ [controllerURL]: body => body + '\nfetch("/unreviewed-next-page")' }))
  assert.equal(jobs.length, 17)
  assertPartial(jobs)
  assert.ok(jobs[evidenceKey].failures.some(failure => failure.stage === 'public-inventory-proof'))
})

for (const [label, attributes] of [
  ['JSON data type', 'type="application/json"'], ['nomodule', 'nomodule'],
  ['invalid module type with parameters', 'type="module; charset=utf-8"'],
  ['absent type and VBScript language', 'language="vbscript"'],
  ['raw ASCII whitespace type', 'type="   "'],
  ['raw ASCII whitespace language', 'language="   "'],
  ['literal NBSP-padded MIME', 'type="\u00a0text/javascript\u00a0"'],
  ['named NBSP entity-padded MIME', 'type="&nbsp;text/javascript&nbsp;"'],
  ['numeric NBSP entity-padded MIME', 'type="&#160;text/javascript&#xA0;"'],
]) {
  test(`Basware non-executable controller with ${label} retains positives but cannot prove complete delegation`, async () => {
    const changed = originalBody(widgetURL).replace('src="' + controllerURL + '"', attributes + ' src="' + controllerURL + '"')
    assert.notEqual(changed, originalBody(widgetURL))
    const jobs = await createBaswareScraper().run(replay({ [widgetURL]: changed }))
    assert.equal(jobs.length, 17)
    assertPartial(jobs)
  })
}

for (const [label, attributes] of [
  ['raw empty type', 'type=""'], ['raw empty language', 'language=""'],
  ['ASCII-padded classic MIME', 'type=" \ttext/javascript\n "'],
  ['ASCII entity-padded classic MIME', 'type="&#x20;text/javascript&#32;"'],
]) {
  test(`Basware executable controller with ${label} still proves reviewed current delegation`, async () => {
    const changed = originalBody(widgetURL).replace('src="' + controllerURL + '"', attributes + ' src="' + controllerURL + '"')
    const jobs = await createBaswareScraper().run(replay({ [widgetURL]: changed }))
    assert.equal(jobs.length, 17)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  })
}

for (const [label, target, markup] of [
  ['hidden widget slice mutation', widgetURL, '<div hidden><script>JBL.embed_v2.jobs = JBL.embed_v2.jobs.slice(0, 5);</script></div>'],
  ['hidden additional India candidate', widgetURL, '<div hidden><script>JBL.embed_v2.jobs.push({...JBL.embed_v2.jobs.find(row => row.departments.includes("India - Chandigarh")), id:"999999", title:"Additional India Role", url:"https://emp.jobylon.com/jobs/999999-basware-additional-india-role/"});</script></div>'],
  ['hidden careers filter override', primaryURL, '<div hidden><script>window.jbl_filters = {country:"India"};</script></div>'],
  ['inert careers group override', primaryURL, '<div inert><script>window.jbl_group_id = 999;</script></div>'],
  ['hidden script element override', primaryURL, '<script hidden>window.jbl_filters = {country:"India"};</script>'],
  ['CSS-hidden careers override', primaryURL, '<div style="display:none"><script>window.jbl_widgets = [{id:999,type:"company",version:"v2",target:"other"}];</script></div>'],
]) {
  test(`Basware executable ${label} retains proven roles and forbids public completeness`, async () => {
    const changed = originalBody(target).replace('</body>', markup + '</body>')
    const jobs = await createBaswareScraper().run(replay({ [target]: changed }))
    assert.equal(jobs.length, 17)
    assert.equal(jobs.some(job => job.jobId === '999999'), false)
    assertPartial(jobs)
    assert.ok(jobs[evidenceKey].failures.some(failure => failure.stage === 'public-inventory-proof'))
  })
}

for (const [label, markup] of [
  ['template', '<template><script>window.jbl_filters = {country:"India"};</script></template>'],
  ['noscript', '<noscript><script>window.jbl_group_id = 999;</script></noscript>'],
  ['comment', '<!-- <div hidden><script>window.jbl_filters = {country:"India"};</script></div> -->'],
  ['textarea raw text', '<textarea><script>window.jbl_filters = {country:"India"};</script></textarea>'],
]) {
  test(`Basware actually inert ${label} script text does not create a source override`, async () => {
    const jobs = await createBaswareScraper().run(replay({ [primaryURL]: html => html.replace('</body>', markup + '</body>') }))
    assert.equal(jobs.length, 17)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  })
}

test('Basware alternate comment closure cannot hide an executable primary filter override', async () => {
  const markup = '<!-- reviewed source comment --!><script>window.jbl_filters = {country:"India"};window.baswareProbeExecuted=true;</script><!-- -->'
  const jobs = await createBaswareScraper().run(replay({ [primaryURL]: html => html.replace('</body>', markup + '</body>') }))
  assert.equal(jobs.length, 17)
  assertPartial(jobs)
  assert.ok(jobs[evidenceKey].failures.some(failure => failure.stage === 'public-inventory-proof'))
})

test('Basware ordinary comment remains inert without rejecting the current public proof', async () => {
  const markup = '<!-- reviewed source comment <script>window.jbl_filters = {country:"India"};window.baswareProbeExecuted=true;</script> -->'
  const jobs = await createBaswareScraper().run(replay({ [primaryURL]: html => html.replace('</body>', markup + '</body>') }))
  assert.equal(jobs.length, 17)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Basware raw script reader rejects unknown comment contexts and preserves its explicit body and structural bounds', () => {
  assert.deepEqual(readBaswareRawScripts(' '.repeat(2 * 1024 * 1024)), [])
  assert.equal(readBaswareRawScripts('<script></script>'.repeat(512)).length, 512)
  assert.deepEqual(readBaswareRawScripts('<template>'.repeat(128) + '</template>'.repeat(128)), [])
  for (const [name, html] of [
    ['oversized body', ' '.repeat(2 * 1024 * 1024 + 1)],
    ['too many scripts', '<script></script>'.repeat(513)],
    ['too many attributes', '<script ' + Array.from({ length: 129 }, (_, index) => 'a' + index).join(' ') + '></script>'],
    ['template depth', '<template>'.repeat(129) + '</template>'.repeat(129)],
    ['unterminated script', '<script>window.jbl_filters={}'],
    ['unterminated template', '<template><script>window.jbl_filters={}</script>'],
    ['short comment closure', '<!--><script>window.jbl_filters={}</script><!-- -->'],
    ['alternate comment closure', '<!-- reviewed source comment --!><script>window.jbl_filters={}</script><!-- -->'],
  ]) assert.throws(() => readBaswareRawScripts(html), undefined, name)
})

test('Basware does not request an unreviewed controller route advertised by a changed widget', async () => {
  const input = replay({ [widgetURL]: html => html.replace('embed-v2.min.d139cbc386fa.js', 'embed-v2.min.unknown.js') })
  const jobs = await createBaswareScraper().run(input)
  assert.equal(jobs.length, 17)
  assertPartial(jobs)
  assert.equal(input.requests.some(url => url.includes('unknown.js')), false)
})

test('Basware optional controller denial is read once and retains roles without further requests', async () => {
  const input = replay({}, response => response.url === loaderURL ? { ...response, status: 403, headers: { 'content-type': 'text/html' }, body: Buffer.from('Forbidden') } : response)
  const jobs = await createBaswareScraper().run(input)
  assert.equal(jobs.length, 17)
  assertPartial(jobs)
  assert.equal(input.requests.filter(url => url === loaderURL).length, 1)
  assert.equal(input.requests.includes(controllerURL), false)
})

test('Basware detail failure cannot complete inventory or clean up unseen jobs', async () => {
  const jobs = await createBaswareScraper().run(replay({ [detailURL]: new Error('detail unavailable') }))
  assert.equal(jobs.length, 16)
  assertPartial(jobs)
  assert.equal(extractionDetailHealth(jobs).complete, false)
})

test('Basware changed closing inventory retains roles and forbids cleanup', async () => {
  const jobs = await createBaswareScraper().run(replay({ [widgetURL]: (html, ordinal) => ordinal ? editRows(html, rows => rows.slice(1)) : html }))
  assert.equal(jobs.length, 17)
  assertPartial(jobs)
  assert.equal(jobs[evidenceKey].closingInventoryMatches, false)
})

for (const [label, change] of [
  ['a changed closing controller', html => html.replace('embed-v2.min.d139cbc386fa.js', 'embed-v2.min.unknown.js')],
  ['an additional executable listing script', html => html.replace('</body>', '<script src="https://static-eu.jobylon.com/js/unreviewed-paging.js"></script></body>')],
  ['an additional inline inventory mutation', html => html.replace('</body>', '<script>JBL.embed_v2.jobs = JBL.embed_v2.jobs.slice(0,5);</script></body>')],
]) {
  test(`Basware ${label} cannot retain a complete inventory label`, async () => {
    const jobs = await createBaswareScraper().run(replay({ [widgetURL]: (html, ordinal) => ordinal ? change(html) : html }))
    assert.equal(jobs.length, 17)
    assertPartial(jobs)
  })
}

for (const [label, change] of [
  ['an explicit closed notice', html => html.replace('<h1 class="job-title">', '<p>This position has been filled</p><h1 class="job-title">')],
  ['disabled application links', html => html.replaceAll('href="/applications/jobs/377460/create/"', 'aria-disabled="true" href="/applications/jobs/377460/create/"')],
]) {
  test(`Basware excludes a selected detail with ${label} and preserves other positives`, async () => {
    const changed = change(originalBody(detailURL))
    assert.notEqual(changed, originalBody(detailURL))
    const jobs = await createBaswareScraper().run(replay({ [detailURL]: changed }))
    assert.equal(jobs.length, 16)
    assertPartial(jobs)
  })
}

test('Basware contradictory foreign address inside a selected multi-country detail cannot complete India coverage', async () => {
  const url = 'https://emp.jobylon.com/jobs/338875-basware-portfolio-architect/'
  const changed = originalBody(url).replace('700259, Romania', '700259, Atlantis')
  assert.notEqual(changed, originalBody(url))
  const jobs = await createBaswareScraper().run(replay({ [url]: changed }))
  assert.equal(jobs.length, 16)
  assertPartial(jobs)
})

test('Basware complete nonempty foreign-only public inventory is scoped zero, never verified-empty', async () => {
  const jobs = await createBaswareScraper().run(replay({ [widgetURL]: html => editRows(html, rows => rows.filter(row => !row.departments.some(label => label.startsWith('India - ')))) }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(jobs[evidenceKey].observedListingCount, 8)
  assert.equal(jobs[evidenceKey].verifiedZeroInventory, false)
})

test('Basware positively enumerated globally empty public inventory may be verified-empty', async () => {
  const jobs = await createBaswareScraper().run(replay({ [widgetURL]: html => editRows(html, () => []) }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(jobs[evidenceKey].verifiedZeroInventory, true)
})

test('Basware missing original response clock cannot be refreshed into current proof at replay time', async () => {
  const jobs = await createBaswareScraper().run(replay({}, response => ({ ...response, requestedAt: null, completedAt: null })))
  assert.equal(jobs.length, 17)
  assertPartial(jobs)
})

test('Basware caller cancellation during optional public proof propagates the original reason', async () => {
  const controller = new AbortController(), reason = new Error('caller cancelled Basware proof')
  const input = replay({ [loaderURL]: (_html, _ordinal, options) => { controller.abort(reason); options.signal.throwIfAborted() } })
  await assert.rejects(createBaswareScraper().run({ ...input, signal: controller.signal }), error => error === reason)
  assert.equal(input.requests.includes(controllerURL), false)
})
