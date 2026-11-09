import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createBiofourmisScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { rawScriptNodes } from './publicInventory.js'

const HOME = 'https://biofourmis.com/'
const GENERAL = 'https://biofourmis.com/about/job-openings'
const CLINICAL = 'https://biofourmis.com/about/clinical-job-openings'
const LOADER = 'https://c27rhq.csb.app/get-jobs.js'
const BOARD = 'https://job-boards.greenhouse.io/biofourmis'
const API = 'https://boards-api.greenhouse.io/v1/boards/biofourmis'
const NOW = '2026-11-01T02:00:00.000Z'
const captured = name => {
  const receipt = JSON.parse(readFileSync(new URL('./native-captures/' + name + '.json', import.meta.url)))
  const suffix = name.includes('current-') || name.includes('homepage-') ? '.html' : '.txt'
  const bytes = readFileSync(new URL('./native-captures/' + name + suffix, import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
  return { url: receipt.url || receipt.requestedUrl, status: receipt.status, headers: receipt.headers,
    requestedAt: receipt.requestedAt, completedAt: receipt.completedAt, bodyBase64: bytes.toString('base64') }
}
const jsonPage = (url, data) => ({ url, status: 200, headers: { 'content-type': 'application/json' },
  requestedAt: '2026-11-01T01:05:40.000Z', completedAt: '2026-11-01T01:05:41.000Z',
  bodyBase64: Buffer.from(JSON.stringify(data)).toString('base64') })
const currentReplay = () => {
  const pages = new Map([
    [HOME, captured('biofourmis-homepage-20261101')],
    [GENERAL, captured('biofourmis-current-20261101')],
    [CLINICAL, captured('biofourmis-clinical-20261101')],
    [LOADER, captured('biofourmis-careers-loader-20261101')],
    [BOARD, captured('biofourmis-native-board-20261101')],
    [API + '/jobs?content=true', captured('biofourmis-native-20261101')],
    [API + '/departments/', captured('biofourmis-departments-20261101')],
    // These two envelopes are transport fixtures, not claimed current captures.
    [API, jsonPage(API, { name: 'Biofourmis' })],
    [API + '/offices', jsonPage(API + '/offices', { offices: [] })],
  ])
  const calls = [], audits = []
  return { pages, calls, audits, options: { now: () => NOW,
    fetchPage: async url => { calls.push(url);assert.ok(pages.has(url), 'Unexpected public read: ' + url);return structuredClone(pages.get(url)) },
    onAudit: audit => audits.push(audit) } }
}

const textPage = (url, body) => ({ ...jsonPage(url, null),
  headers: { 'content-type': 'text/html' }, completedAt: '2026-11-01T01:10:00.000Z',
  bodyBase64: Buffer.from(body).toString('base64') })
const careersHTML = (url = GENERAL, tag = `<script defer src="${LOADER}"></script>`) =>
  `<html><head><title>${url === CLINICAL ? 'Clinical Job Openings' : 'Job Openings'}</title><link rel="canonical" href="${url}"></head><body><h1>Open Roles</h1><a href="${GENERAL}">Find general positions</a><a href="${CLINICAL}">Find clinical positions</a>${tag}</body></html>`
const futureReplay = () => {
  const r = currentReplay()
  r.pages.set(CLINICAL, textPage(CLINICAL, careersHTML(CLINICAL)))
  return r
}
const replaceBody = (r, url, update) => {
  const page = r.pages.get(url)
  page.bodyBase64 = Buffer.from(update(Buffer.from(page.bodyBase64, 'base64').toString())).toString('base64')
}

const vacancy = {
  id: 7010101004, internal_job_id: 1234, requisition_id: 'BF-101', title: 'Senior Platform Engineer', company_name: 'Biofourmis',
  location: { name: 'Bengaluru, Karnataka, India; Chennai, Tamil Nadu, India' },
  absolute_url: BOARD + '/jobs/7010101004', first_published: '2026-10-30T10:00:00Z', updated_at: '2026-10-31T11:00:00Z',
  content: '<h2>Responsibilities</h2><p>Build reliable clinical platform services and support care delivery teams with secure engineering systems.</p><h2>Qualifications</h2><p>Five years of distributed systems engineering and production ownership experience.</p>',
  departments: [{ id: 10, name: 'Engineering' }],
  offices: [{ id: 1, name: 'Bengaluru', location: 'Bengaluru, Karnataka, India', parent_id: null },
    { id: 2, name: 'Chennai', location: 'Chennai, Tamil Nadu, India', parent_id: null }],
  metadata: [{ name: 'Employment Type', value: 'Full-time' }], include_ai_disclaimer: true,
  ai_disclaimer: '<p>The employer may use AI for application review.</p>',
  pay_input_ranges: [{ title: 'Published compensation', min_cents: 100000, max_cents: 200000, currency_type: 'INR', blurb: '<p>Annual base salary.</p>' }],
  application_deadline: null,
}
const fullCriteria = 'Responsibilities Build reliable clinical platform services and support care delivery teams with secure engineering systems. Qualifications Five years of distributed systems engineering and production ownership experience. The employer may use AI for application review. Published pay information: Published compensation. INR 1000.00 to 2000.00. Annual base salary.'
const modelHTML = (model, body) => `<html><head><title>Jobs at Biofourmis</title></head><body>${body}<script>window.__remixContext = ${JSON.stringify(model)};</script></body></html>`
const rootModel = isJobPost => ({ internal: false, preview: false, urlToken: 'biofourmis', isJobPost,
  boardConfiguration: { job_board_id: 4006066007, job_board_public_url: BOARD } })
const boardHTML = records => modelHTML({ state: { errors: null, loaderData: { root: rootModel(false), 'routes/$url_token': {
  urlToken: 'biofourmis', board: { name: 'Biofourmis', public_url: BOARD, redirect_to: null },
  departmentIds: [], officeIds: [], customFieldFilters: {}, featuredPosts: { data: [] },
  jobPosts: { count: records.length, page: 1, total: records.length, total_pages: records.length ? 1 : 0,
    data: records.map(row => ({ ...row, location: row.location.name })) },
} } } }, '<h1>Current openings at Biofourmis</h1>')
const detailHTML = (record = vacancy) => modelHTML({ state: { errors: null, loaderData: {
  root: rootModel(true), 'routes/$url_token_.jobs_.$job_post_id': {
    urlToken: 'biofourmis', jobPostId: String(record.id), submitPath: `https://boards.greenhouse.io/biofourmis/jobs/${record.id}`,
    confirmationPath: `/biofourmis/jobs/${record.id}/confirmation`, jobPost: {
      post_type: 'job_post', hiring_plan_id: record.internal_job_id, company_name: 'Biofourmis', public_url: record.absolute_url,
      title: record.title, job_post_location: record.location.name, redirect_to: null,
      content: record.content, introduction: '', conclusion: '', published_at: record.first_published,
      application_deadline: null,
    },
  },
} } }, `<div class="job__header"><h1>${record.title}</h1><div class="job__location">${record.location.name}</div></div><div class="job__description body">${fullCriteria}</div><form id="application-form" action="${record.absolute_url}" method="post"><input name="first_name" required><button type="submit">Submit application</button></form>`)
const positiveReplay = () => {
  const r = futureReplay(), record = structuredClone(vacancy)
  r.pages.set(GENERAL, textPage(GENERAL, careersHTML()))
  r.pages.set(API + '/jobs?content=true', jsonPage(API + '/jobs?content=true', { jobs: [record], meta: { total: 1 } }))
  r.pages.set(API + '/offices', jsonPage(API + '/offices', { offices: record.offices.map(office => ({ ...office,
    departments: [{ id: 10, name: 'Engineering', jobs: [record] }] })) }))
  r.pages.set(API + '/departments/', jsonPage(API + '/departments/', { departments: [{ id: 10, name: 'Engineering', parent_id: null, child_ids: [], jobs: [record] }] }))
  r.pages.set(API + '/jobs/7010101004?pay_transparency=true', jsonPage(API + '/jobs/7010101004?pay_transparency=true', record))
  r.pages.set(BOARD, textPage(BOARD, boardHTML([record])))
  r.pages.set(record.absolute_url, textPage(record.absolute_url, detailHTML(record)))
  return r
}

test('current advertised clinical 404 keeps native account zero separate from public company scope', async () => {
  const r = currentReplay(), jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 0)
  const proof = jobs.sourceAudit.publicInventoryProof
  assert.equal(proof.complete, false)
  assert.equal(proof.currentEmployerBinding, true)
  assert.equal(proof.nativeInventoryComplete, true)
  assert.equal(proof.nativeReportedTotal, 0)
  assert.equal(proof.advertisedSurfacesComplete, false)
  assert.ok(proof.failures.some(failure => failure.code === 'ADVERTISED_CAREERS_UNAVAILABLE' && failure.url === CLINICAL && failure.status === 404))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null)
  assert.equal(jobs.sourceAudit.sourceScopeComplete, false)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
  assert.equal(jobs.sourceAudit.wholeCompanyScope, null)
  assert.equal(r.audits.length, 1)
  assert.deepEqual(r.audits[0].publicInventoryProof, proof)
  assert.equal(r.calls.filter(url => url === HOME).length, 2)
  assert.equal(r.calls.filter(url => url === CLINICAL).length, 2)
})

test('a future same-account globally empty public source can verify empty only after both advertised surfaces reconcile', async () => {
  const r = futureReplay(), jobs = await createBiofourmisScraper().run(r.options), evidence = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 0)
  assert.equal(jobs.sourceAudit.publicInventoryProof.complete, true)
  assert.equal(evidence.status, 'verified-empty')
  assert.equal(evidence.reportedTotal, 0)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.verifiedAt, '2026-11-01T01:10:00.000Z')
  assert.equal(jobs.sourceAudit.sourceScopeComplete, true)
  assert.equal(jobs.sourceAudit.wholeCompanyScope, null)
})

for (const [name, tag, complete] of [
  ['classic MIME with ASCII whitespace', `<script type=" \tTEXT/JAVASCRIPT\r\n" src="${LOADER}"></script>`, true],
  ['raw empty type ignores legacy language', `<script type="" language="vbscript" src="${LOADER}"></script>`, true],
  ['whitespace-only type is a data block', `<script type="   " src="${LOADER}"></script>`, false],
  ['MIME parameters are not stripped', `<script type="text/javascript; charset=utf-8" src="${LOADER}"></script>`, false],
  ['non-ASCII type whitespace is not trimmed', `<script type="\u00a0text/javascript\u00a0" src="${LOADER}"></script>`, false],
  ['unknown legacy language blocks binding', `<script language="vbscript" src="${LOADER}"></script>`, false],
  ['nomodule does not bind the current browser', `<script nomodule src="${LOADER}"></script>`, false],
  ['template script stays inert', `<template><script src="${LOADER}"></script></template>`, false],
  ['noscript script stays inert', `<noscript><script src="${LOADER}"></script></noscript>`, false],
  ['hidden ancestor does not stop execution', `<div hidden><script src="${LOADER}"></script></div>`, true],
  ['inert ancestor does not stop execution', `<div inert><script src="${LOADER}"></script></div>`, true],
  ['hidden script itself still executes', `<script style="display:none" src="${LOADER}"></script>`, true],
]) test('public binding uses raw browser script semantics: ' + name, async () => {
  const r = futureReplay();r.pages.set(GENERAL, textPage(GENERAL, careersHTML(GENERAL, tag)))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.sourceAudit.publicInventoryProof.complete, complete)
  assert.equal(readInventoryEvidence(jobs).listingComplete, complete)
})

test('inert alternate-account examples are not an additional recruiting surface', async () => {
  const r = futureReplay()
  replaceBody(r, GENERAL, body => body.replace('</body>', '<template><a href="https://jobs.lever.co/another">Jobs</a><script src="https://job-boards.greenhouse.io/another"></script></template><noscript><script src="https://jobs.lever.co/another"></script></noscript></body>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

for (const [name, mutate] of [
  ['another advertised ATS account', r => replaceBody(r, HOME, body => body.replace('</body>', '<a href="https://jobs.lever.co/another">Open roles</a></body>'))],
  ['another advertised corporate recruiting route', r => replaceBody(r, HOME, body => body.replace('</body>', '<a href="/careers-new">Careers</a></body>'))],
  ['a hidden script advertises another account', r => replaceBody(r, GENERAL, body => body.replace('</body>', '<div hidden><script>window.extraCareer="https://jobs.lever.co/another";</script></div></body>'))],
  ['a duplicate loader', r => replaceBody(r, GENERAL, body => body.replace('</body>', `<script src="${LOADER}"></script></body>`))],
  ['a modified loader', r => replaceBody(r, LOADER, body => body + '\nfetch("https://jobs.lever.co/another");')],
  ['missing homepage binding', r => r.pages.set(HOME, textPage(HOME, '<title>Another employer</title><a href="/about/job-openings">Jobs</a>'))],
  ['a native reported total mismatch', r => r.pages.set(API + '/jobs?content=true', jsonPage(API + '/jobs?content=true', { jobs: [], meta: { total: 2 } }))],
  ['an empty feed without a total', r => r.pages.set(API + '/jobs?content=true', jsonPage(API + '/jobs?content=true', { jobs: [] }))],
  ['an error envelope masquerading as zero', r => r.pages.set(API + '/jobs?content=true', jsonPage(API + '/jobs?content=true', { jobs: [], meta: { total: 0 }, errors: ['unavailable'] }))],
  ['an unaccounted department record', r => r.pages.set(API + '/departments/', jsonPage(API + '/departments/', { departments: [{ id: 1, parent_id: null, child_ids: [], jobs: [{ id: 123 }] }] }))],
  ['a filtered native hosted board', r => replaceBody(r, BOARD, body => body.replace('"departmentIds":[]', '"departmentIds":[1]'))],
  ['a stale response receipt', r => { for (const page of r.pages.values()) { page.requestedAt = '2026-10-28T00:00:00.000Z';page.completedAt = '2026-10-28T00:00:01.000Z' } }],
]) test('public inventory stays incomplete for ' + name, async () => {
  const r = futureReplay();mutate(r)
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.sourceAudit.publicInventoryProof.complete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
})

test('future positive protocol preserves complete original criteria and every India location with current application evidence', async () => {
  const r = positiveReplay(), jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0].sourceNativeRecord, vacancy)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.equal(jobs[0].postingDate, '2026-10-30T10:00:00Z')
  assert.equal(jobs[0].sourceNativeUpdatedAt, '2026-10-31T11:00:00Z')
  assert.deepEqual(jobs[0].locations, ['Bengaluru, Karnataka, India', 'Chennai, Tamil Nadu, India'])
  assert.equal(jobs[0].sourceNativeCountries.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourcePublicApplicationEvidence.state, 'public-form-available')
  assert.equal(jobs[0].sourcePublicApplicationEvidence.submitted, false)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(jobs[0].sourceScopeComplete, true)
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.equal(jobs[0].lifecycleCleanupAllowed, true)
  assert.equal(jobs.sourceAudit.observationHistory.length, 1)
  assert.deepEqual(jobs.sourceAudit.observationHistory[0].earlier.sourceNativeRecord, vacancy)
})

test('optional clinical failure never discards independently qualified native India positives or raw criteria', async () => {
  const r = positiveReplay();r.pages.set(CLINICAL, captured('biofourmis-clinical-20261101'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.deepEqual(jobs[0].sourceNativeRecord, vacancy)
  assert.deepEqual(jobs[0].sourceNativePayInputRanges, vacancy.pay_input_ranges)
  assert.equal(jobs[0].sourceNativeAIText, 'The employer may use AI for application review.')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

for (const [name, mutate] of [
  ['unavailable hosted detail', r => { r.pages.get(vacancy.absolute_url).status = 404 }],
  ['wrong native application route', r => replaceBody(r, vacancy.absolute_url, body => body.replace('"submitPath":"https://boards.greenhouse.io/biofourmis/jobs/7010101004"', '"submitPath":"https://boards.greenhouse.io/another/jobs/7010101004"'))],
  ['disabled application submit', r => replaceBody(r, vacancy.absolute_url, body => body.replace('<button type="submit">', '<button type="submit" disabled>'))],
  ['hidden description', r => replaceBody(r, vacancy.absolute_url, body => body.replace('class="job__description body"', 'class="job__description body" hidden'))],
  ['an explicit role closure', r => replaceBody(r, vacancy.absolute_url, body => body.replace('<div class="job__header">', '<div class="job__header"><p>This position is closed.</p>'))],
  ['unresolved all-row country', r => { const p = JSON.parse(Buffer.from(r.pages.get(API + '/jobs/7010101004?pay_transparency=true').bodyBase64,'base64'));p.location.name = 'Worldwide';r.pages.set(API + '/jobs/7010101004?pay_transparency=true', jsonPage(API + '/jobs/7010101004?pay_transparency=true', p));r.pages.set(API + '/jobs?content=true', jsonPage(API + '/jobs?content=true', { jobs:[p],meta:{total:1} }));r.pages.set(API + '/departments/', jsonPage(API + '/departments/', {departments:[{id:10,parent_id:null,child_ids:[],jobs:[p]}]})) }],
]) test('future incomplete ' + name + ' retains native models and forbids cleanup', async () => {
  const r = positiveReplay();mutate(r)
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.ok(jobs[0].sourceNativeRecord)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [namespace, tag] of [['svg', 'style'], ['svg', 'textarea'], ['math', 'style'], ['math', 'textarea']])
  test(`foreign ${namespace} ${tag} cannot conceal an executing recruiting script`, async () => {
    const r = futureReplay()
    replaceBody(r, GENERAL, body => body.replace('</body>', `<${namespace}><${tag}><script>window.extraCareer="https://jobs.lever.co/another";</script></${tag}></${namespace}></body>`))
    const jobs = await createBiofourmisScraper().run(r.options)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
  })

for (const tag of ['style', 'textarea']) test(`foreign ${tag} cannot conceal a native hosted model mutation`, async () => {
  const r = futureReplay()
  replaceBody(r, BOARD, body => body.replace('</body>', `<svg><${tag}><script>window.__remixContext.state.loaderData["routes/$url_token"].jobPosts.total=3;</script></${tag}></svg></body>`))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.sourceAudit.publicInventoryProof.nativeInventoryComplete, false)
})

for (const closing of ['</script data-review>', '</script/>', '</script />', '</ScRiPt data-review="value"/>'])
  test('an unreviewed loader closing tag cannot hide an advertised anchor: ' + closing, async () => {
    const r = futureReplay()
    r.pages.set(GENERAL, textPage(GENERAL, careersHTML(GENERAL, `<script src="${LOADER}">${closing}<a href="https://jobs.lever.co/another">Careers</a>`)))
    const jobs = await createBiofourmisScraper().run(r.options)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
  })

for (const tag of ['style', 'textarea', 'iframe', 'noembed', 'noframes', 'noscript'])
  test('unsupported HTML raw closing syntax is rejected consistently for ' + tag, async () => {
    const r = futureReplay()
    replaceBody(r, GENERAL, body => body.replace('</body>', `<${tag}></${tag} data-review><a href="https://jobs.lever.co/another">Careers</a></body>`))
    const jobs = await createBiofourmisScraper().run(r.options)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
  })

for (const [name, extra] of [
  ['ordinary HTML style stays raw text', '<style><script>window.extraCareer="https://jobs.lever.co/another";</script></style>'],
  ['ordinary HTML textarea stays raw text', '<textarea><script>window.extraCareer="https://jobs.lever.co/another";</script></textarea>'],
  ['true HTML template owns a foreign style subtree', '<template><svg><style><script>window.extraCareer="https://jobs.lever.co/another";</script></style></svg></template>'],
]) test('finite grammar preserves inert control: ' + name, async () => {
  const r = futureReplay();replaceBody(r, GENERAL, body => body.replace('</body>', extra + '</body>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('reviewed ASCII-space script close remains accepted by both proof readers', async () => {
  const r = futureReplay()
  r.pages.set(GENERAL, textPage(GENERAL, careersHTML(GENERAL, `<script src="${LOADER}"></SCRIPT \t\r\n>`)))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

for (const [name, mutate] of [
  ['foreign raw style on the public role', r => replaceBody(r, vacancy.absolute_url, body => body.replace('</body>', '<svg><style><script>document.defaultView.__remixContext.state.errors={};</script></style></svg></body>'))],
  ['attributed native initializer closing tag', r => replaceBody(r, vacancy.absolute_url, body => body.replace('</script>', '</script data-review>'))],
]) test('unreviewed ' + name + ' retains complete original native criteria', async () => {
  const r = positiveReplay();mutate(r)
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.deepEqual(jobs[0].sourceNativeRecord, vacancy)
  assert.deepEqual(jobs[0].sourceNativePayInputRanges, vacancy.pay_input_ranges)
  assert.equal(jobs[0].sourceNativeAIText, 'The employer may use AI for application review.')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a hidden earlier element with the form ID makes an explicit submitter owner unqualified', async () => {
  const r = positiveReplay();replaceBody(r, vacancy.absolute_url, body => body.replace('<form id="application-form"', '<div hidden id="application-form"></div><form id="application-form"').replace('<button type="submit">', '<button type="submit" form="application-form">'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('a hidden nested form cannot supply a misleading native submitter ancestry', async () => {
  const r = positiveReplay();replaceBody(r, vacancy.absolute_url, body => body.replace('<button type="submit">', '<form hidden id="unexpected-inner-form"></form><button type="submit">'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('maxJobs truncation cannot certify complete inventory', async () => {
  const r = positiveReplay(), jobs = await createBiofourmisScraper().run({ ...r.options, maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.sourceAudit.observations.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('changed closing inventory cannot certify zero', async () => {
  const r = futureReplay(), original = r.options.fetchPage
  let visits = 0
  r.options.fetchPage = async url => { const page = await original(url);if (url === API + '/jobs?content=true' && ++visits === 2) return jsonPage(url, { jobs: [],meta: {total: 1} });return page }
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('hidden executable binding can retain and qualify a native India role', async () => {
  const r = positiveReplay()
  r.pages.set(GENERAL, textPage(GENERAL, careersHTML(GENERAL, `<div hidden><script src="${LOADER}"></script></div>`)))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('unknown publication date remains null instead of using update or observation time', async () => {
  const r = positiveReplay()
  for (const url of [API + '/jobs?content=true', API + '/offices', API + '/departments/', API + '/jobs/7010101004?pay_transparency=true', BOARD, vacancy.absolute_url])
    replaceBody(r, url, body => body.replaceAll('"first_published":"2026-10-30T10:00:00Z"', '"first_published":null').replaceAll('"published_at":"2026-10-30T10:00:00Z"', '"published_at":null'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].sourcePostingDate, null)
  assert.equal(jobs[0].sourceNativeUpdatedAt, '2026-10-31T11:00:00Z')
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('globally nonempty zero India source is complete-inventory and never verified-empty', async () => {
  const r = positiveReplay()
  for (const [url] of r.pages) replaceBody(r, url, body => body
    .replaceAll('Bengaluru, Karnataka, India', 'Boston, Massachusetts, United States')
    .replaceAll('Chennai, Tamil Nadu, India', 'New York, New York, United States')
    .replaceAll('"name":"Bengaluru"', '"name":"Boston"').replaceAll('"name":"Chennai"', '"name":"New York"'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 0)
  assert.equal(jobs.sourceAudit.observations.length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

for (const [name, mutate] of [
  ['unreviewed top-level pagination', r => r.pages.set(API + '/jobs?content=true', jsonPage(API + '/jobs?content=true', {jobs:[],meta:{total:0},next_page:'2'}))],
  ['unreviewed nested pagination', r => r.pages.set(API + '/jobs?content=true', jsonPage(API + '/jobs?content=true', {jobs:[],meta:{total:0,next_page:'2'}}))],
  ['unreviewed department pagination', r => replaceBody(r, API + '/departments/', body => body.replace('"departments":', '"has_more":true,"departments":'))],
  ['a hidden model mutation', r => replaceBody(r, BOARD, body => body.replace('</body>', '<div hidden><script>window.__remixContext.state.errors=null;</script></div></body>'))],
]) test(name + ' cannot promote native zero', async () => {
  const r = futureReplay();mutate(r)
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
})

test('caller abort interrupts an injected in-flight public read and does not start more requests', async () => {
  const controller = new AbortController(), calls = []
  const running = createBiofourmisScraper().run({ signal: controller.signal, fetchPage: async url => {
    calls.push(url);return new Promise(() => {})
  } })
  setTimeout(() => controller.abort(Error('Biofourmis caller cancelled')), 10)
  await assert.rejects(running, /Biofourmis caller cancelled/)
  assert.deepEqual(calls, [GENERAL])
})

test('denied company host is never retried or bypassed', async () => {
  const r = currentReplay();r.pages.get(GENERAL).status = 403
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(r.calls.filter(url => new URL(url).hostname === 'biofourmis.com').length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.sourceAudit.publicScopeResponses.some(page => page.url === GENERAL && page.status === 403 && page.bodySHA256))
})

test('CodeSandbox trust interstitial stops the loader host after one GET without cookies or a closing retry', async () => {
  const r = currentReplay()
  r.pages.set(LOADER, { ...textPage(LOADER, '<html><title>CodeSandbox Preview</title><body>You are opening a CodeSandbox preview, do you want to continue?<a id="btn-answer-yes">Yes, proceed to preview</a><script>document.cookie="csb_is_trusted=true";</script></body></html>'), status: 400 })
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(r.calls.filter(url => url === LOADER).length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  const proof = jobs.sourceAudit.publicInventoryProof
  assert.ok(proof.failures.some(row => row.code === 'PUBLIC_ACCESS_CHALLENGE' && row.kind === 'codesandbox-preview-trust' && row.retryAllowed === false))
  assert.equal(proof.currentEmployerBinding, false)
  assert.equal(proof.nativeInventoryComplete, true)
  assert.ok(jobs.sourceAudit.publicScopeResponses.some(row => row.url === LOADER && row.status === 400 && row.accessChallenge === 'codesandbox-preview-trust'))
})

test('a new relative public recruiting endpoint in executing configuration blocks zero', async () => {
  const r = futureReplay()
  replaceBody(r, GENERAL, body => body.replace('</body>', '<script>window.secondaryCareers="/careers-new";</script></body>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.sourceAudit.publicInventoryProof.advertisedSurfacesComplete, false)
})

test('disabled ancestor fieldset cannot qualify an application submit button', async () => {
  const r = positiveReplay()
  replaceBody(r, vacancy.absolute_url, body => body.replace('<button type="submit">Submit application</button>', '<fieldset disabled><button type="submit">Submit application</button></fieldset>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('registered entry replays every original current HTTP body and stops the diagnosed trust gate after one read', async () => {
  const capture = JSON.parse(readFileSync(new URL('./native-captures/registered-http-20261101.json', import.meta.url)))
  for (const response of capture.responses) assert.equal(createHash('sha256').update(Buffer.from(response.bodyBase64, 'base64')).digest('hex'), response.sha256)
  let phase = 'opening', visits = 0, audit
  const calls = [], provider = getScraperCatalog().find(row => row.source === 'biofourmis')
  const jobs = await createCatalogScraper(provider).run({ now: () => NOW, onAudit: value => { audit = value }, fetchPage: async url => {
    if (url === GENERAL) phase = ++visits === 1 ? 'opening' : 'closing'
    calls.push(url)
    const response = capture.responses.find(row => row.phase === phase && row.url === url)
    assert.ok(response, 'No invented endpoint in the actual current replay: ' + url)
    return { ...response, url: response.finalURL }
  } })
  assert.equal(jobs.length, 0)
  assert.equal(calls.filter(url => url === LOADER).length, 1)
  assert.equal(calls.length, 17)
  assert.equal(audit.publicInventoryProof.nativeInventoryComplete, true)
  assert.equal(audit.publicInventoryProof.nativeReportedTotal, 0)
  assert.ok(audit.publicInventoryProof.failures.some(row => row.code === 'PUBLIC_ACCESS_CHALLENGE' && row.retryAllowed === false))
  assert.ok(audit.publicInventoryProof.failures.some(row => row.code === 'ADVERTISED_CAREERS_UNAVAILABLE' && row.status === 404))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).firstParty, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
})

for (const [name, extra] of [
  ['browser-closing bang comment', '<!-- banner --!><script>window.extraCareer="https://jobs.lever.co/another";</script>'],
  ['bang comment before a later normal close', '<!-- banner --!><script>window.extraCareer="https://jobs.lever.co/another";</script><!-- later -->'],
  ['abrupt empty comment', '<!--><script>window.extraCareer="https://jobs.lever.co/another";</script>'],
  ['duplicate unrelated attributes', '<script data-name="a" data-name="b">window.extraCareer="https://jobs.lever.co/another";</script>'],
  ['first JavaScript type wins', '<script type="text/javascript" type="text/plain">window.extraCareer="https://jobs.lever.co/another";</script>'],
  ['SVG template is not HTML inert content', '<svg><template><script>window.extraCareer="https://jobs.lever.co/another";</script></template></svg>'],
  ['foreignObject namespace integration is unreviewed', '<svg><foreignObject><script>window.extraCareer="https://jobs.lever.co/another";</script></foreignObject></svg>'],
]) test('review script boundary guard: ' + name, async () => {
  const r = futureReplay();replaceBody(r, GENERAL, body => body.replace('</body>', extra + '</body>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed, false)
})

test('SVG script src cannot establish the known HTML loader binding', async () => {
  const r = futureReplay()
  r.pages.set(GENERAL, textPage(GENERAL, careersHTML(GENERAL, `<svg><script src="${LOADER}"></script></svg>`)))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.sourceAudit.publicInventoryProof.currentEmployerBinding, false)
})

for (const [name, extra] of [
  ['ordinary HTML comment', '<!-- <script>window.extraCareer="https://jobs.lever.co/another";</script> -->'],
  ['real HTML template owns foreign contents', '<template><svg><script>window.extraCareer="https://jobs.lever.co/another";</script></svg></template>'],
  ['first data type makes the block inert', '<script type="text/plain" type="text/javascript">window.extraCareer="https://jobs.lever.co/another";</script>'],
]) test('review parser retains valid inert control: ' + name, async () => {
  const r = futureReplay();replaceBody(r, GENERAL, body => body.replace('</body>', extra + '</body>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('raw reader keeps browser first attributes and attribute-context entity decoding', () => {
  const [script] = rawScriptNodes('<div hidden inert><script type="text/javascript" type="text/plain" data-name="&notit;" data-name="ignored"></script></div>')
  assert.equal(script.attrs.type, 'text/javascript')
  assert.equal(script.attrs['data-name'], '&notit;')
  assert.deepEqual(script.duplicateAttributes, ['type', 'data-name'])
})

for (const [name, extra] of [
  ['document.defaultView direct mutation', '<script>document.defaultView.__remixContext.state.loaderData["routes/$url_token"].jobPosts.total=3;</script>'],
  ['document bracket defaultView alias', '<script>const view=document["defaultView"];view.__remixContext.state.loaderData["routes/$url_token"].jobPosts.total=3;</script>'],
  ['unknown initializer script statement', '<script>console.log("new native bootstrap");</script>'],
  ['duplicate attribute mutation', '<script data-name="a" data-name="b">window.__remixContext.state.loaderData["routes/$url_token"].jobPosts.total=3;</script>'],
  ['JavaScript first duplicate type mutation', '<script type="text/javascript" type="text/plain">window.__remixContext.state.loaderData["routes/$url_token"].jobPosts.total=3;</script>'],
]) test('native model rejects unreviewed executing source: ' + name, async () => {
  const r = futureReplay();replaceBody(r, BOARD, body => body.replace('</body>', extra + '</body>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.sourceAudit.publicInventoryProof.nativeInventoryComplete, false)
})

test('native initializer must occupy the whole executing script statement list', async () => {
  const r = futureReplay();replaceBody(r, BOARD, body => body.replace(';</script>', ';document.defaultView.__remixContext.state.loaderData["routes/$url_token"].jobPosts.total=3;</script>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('duplicate decorative attributes do not make the actual native initializer inert', async () => {
  const r = positiveReplay();replaceBody(r, vacancy.absolute_url, body => body.replace('<script>window.__remixContext', '<script data-name="a" data-name="b">window.__remixContext'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

for (const [name, attributes] of [
  ['another native account', 'formaction="https://boards.greenhouse.io/another/jobs/7010101004"'],
  ['another own-account role', 'formaction="https://boards.greenhouse.io/biofourmis/jobs/9999999999"'],
  ['unsafe method override', 'formmethod="get"'],
  ['dialog method override', 'formmethod="dialog"'],
  ['empty method override defaults to GET', 'formmethod=""'],
  ['another explicit form owner', 'form="unrelated-form"'],
  ['empty explicit form owner', 'form=""'],
]) test('effective native submitter rejects ' + name + ' and retains original criteria', async () => {
  const r = positiveReplay();replaceBody(r, vacancy.absolute_url, body => body.replace('<button type="submit">', `<button type="submit" ${attributes}>`))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.deepEqual(jobs[0].sourceNativeRecord, vacancy)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, attributes] of [
  ['explicit own form', 'form="application-form"'],
  ['same public role action', `formaction="${vacancy.absolute_url}" formmethod="POST"`],
  ['explicit native submit route', `formaction="https://boards.greenhouse.io/biofourmis/jobs/${vacancy.id}" formmethod="post"`],
]) test('effective native submitter accepts reviewed ' + name, async () => {
  const r = positiveReplay();replaceBody(r, vacancy.absolute_url, body => body.replace('<button type="submit">', `<button type="submit" ${attributes}>`))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourcePublicApplicationEvidence.effectiveMethod, 'post')
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('submitter POST override is authoritative over a GET form default', async () => {
  const r = positiveReplay();replaceBody(r, vacancy.absolute_url, body => body.replace('method="post"', 'method="get"').replace('<button type="submit">', '<button type="submit" formmethod="post">'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourcePublicApplicationEvidence.effectiveMethod, 'post')
})

test('another live submitter targeting the application form cannot be ignored', async () => {
  const r = positiveReplay();replaceBody(r, vacancy.absolute_url, body => body.replace('</form>', '</form><button type="submit" form="application-form" formaction="https://boards.greenhouse.io/another/jobs/7010101004">Other application</button>'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].jobDescription, fullCriteria)
})

test('ambiguous form owner ID prevents application qualification', async () => {
  const r = positiveReplay();replaceBody(r, vacancy.absolute_url, body => body.replace('<form id="application-form"', '<div id="application-form"></div><form id="application-form"'))
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs[0].sourceDetailComplete, false)
})

for (const [name, mutate] of [
  ['unavailable homepage', r => { r.pages.get(HOME).status = 404 }],
  ['wrong homepage identity', r => { r.pages.set(HOME, textPage(HOME, '<title>Another employer</title>')) }],
]) test('core hidden-loader India binding survives optional ' + name, async () => {
  const r = positiveReplay();r.pages.set(GENERAL, textPage(GENERAL, careersHTML(GENERAL, `<div hidden><script src="${LOADER}"></script></div>`)));mutate(r)
  const jobs = await createBiofourmisScraper().run(r.options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, fullCriteria)
  assert.deepEqual(jobs[0].sourceNativeRecord, vacancy)
  assert.deepEqual(jobs[0].sourceNativePayInputRanges, vacancy.pay_input_ranges)
  assert.equal(jobs[0].sourceNativeAIText, 'The employer may use AI for application review.')
  assert.deepEqual(jobs[0].locations, ['Bengaluru, Karnataka, India', 'Chennai, Tamil Nadu, India'])
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs.sourceAudit.publicInventoryProof.coreEmployerBinding, true)
  assert.equal(jobs.sourceAudit.publicInventoryProof.currentEmployerBinding, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
