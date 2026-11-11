import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { declaredRipplingRecruitment, readRipplingRecruitment } from '../scraper-support/utils/recruitmentRippling.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-rippling-branch-20261111.json.gz', import.meta.url))))
const captured = new Map(fixture.responses.map(response => {
  const body = Buffer.from(response.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), response.bodySHA256)
  return [response.requestedURL, { ...response, html: body.toString('utf8') }]
}))
const publisherURL = 'https://www.branch.io/careers/'
const endpointURL = 'https://ats.rippling.com/api/v2/board/branch/jobs?groupJobsByLocation=false&page=0&pageSize=1000'
const rendererURL = 'https://www.branch.io/wp-content/plugins/branch-rippling-careers/assets/js/view.js?ver=1788895891'
const indiaIds = ['454f3d28-ca85-4640-9cfe-c48f1931cfdc', '736cd9d9-935d-4eff-9359-3437ac66eff1',
  '14034902-e87c-4cdc-a07b-46260a42d095', 'd69a1abd-a1b2-4a2e-a73b-57fd5769ce83', 'dd6618ff-342f-4a05-a258-96bb8d347be8']
const roleURL = id => 'https://ats.rippling.com/branch/jobs/' + id
const nativeData = html => JSON.parse(readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')[0].raw)
const editNative = (html, edit) => {
  const raw = readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')[0].raw
  const data = JSON.parse(raw); edit(data)
  return html.replace(raw, JSON.stringify(data))
}
const declaration = html => declaredRipplingRecruitment(readNativeDocument(html ?? captured.get(publisherURL).html), publisherURL,
  { source: 'branch', companyName: 'Branch', companyCareerPage: publisherURL })
const replay = (changes = {}) => {
  const jobs = [], records = [], inventories = [], unresolved = [], calls = [], counts = new Map()
  const read = async (url, init = {}, format = 'page') => {
    calls.push({ url, format, init }); const count = (counts.get(url) || 0) + 1; counts.set(url, count)
    const original = captured.get(url); assert.ok(original, 'Unadvertised request: ' + url)
    let response = { status: original.status, url: original.finalURL, html: original.html }
    if (changes.response) response = changes.response(url, response, count, format) ?? response
    return format === 'json' ? JSON.parse(response.html) : response
  }
  return { jobs, records, inventories, unresolved, calls, options: {
    readPage: (url, init) => read(url, init), readRenderer: (url, init) => read(url, init, 'renderer'),
    readJson: (url, init) => read(url, init, 'json'), permit: () => {},
    matchingEmployer: name => name === 'Branch Metrics, Inc.', addJob: job => jobs.push(job),
    recordRead: row => records.push(row), inventoryRead: evidence => inventories.push(evidence),
    unresolved: reason => unresolved.push(reason), canRead: () => true, maxDetails: 20,
    now: '2026-11-11T03:15:00.000Z', ...changes.options,
  } }
}

test('the current active first-party Rippling declaration exposes five real India roles with complete original criteria and legal employer', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured contract tests forbid uncontrolled HTTP'))
  const r = replay(), descriptor = declaration()
  assert.ok(descriptor, 'The current active first-party widget must be discovered')
  await readRipplingRecruitment(descriptor, r.options)
  assert.deepEqual(r.jobs.map(job => job.id), indiaIds)
  assert.equal(r.records.length, 11)
  assert.equal(r.records.reduce((count, record) => count + record.nativeListingRows.length, 0), 18)
  assert.equal(r.inventories[0].reportedTotal, 18)
  assert.equal(r.inventories[0].sourceScopeComplete, false)
  assert.equal(r.inventories[0].lifecycleCleanupAllowed, false)
  for (const job of r.jobs) {
    const original = nativeData(captured.get(roleURL(job.id)).html).props.pageProps.apiData
    assert.equal(job.description, original.jobPost.description.company + '\n' + original.jobPost.description.role)
    assert.equal(job.employer.name, 'Branch Metrics, Inc.')
    assert.equal(job.location, 'Bengaluru, India')
    assert.equal(job.posted, null, 'Native creation time is not a publication date')
    assert.equal(job.closing, null)
    assert.deepEqual(job.record.apiData, original)
    assert.equal(job.record.apiData.jobPost.createdOn, original.jobPost.createdOn)
    assert.equal(r.calls.filter(call => call.url === job.url).length, 2)
  }
  assert.equal(r.calls.filter(call => call.url === publisherURL).length, 1)
  assert.equal(r.calls.filter(call => call.url === endpointURL).length, 2)
  assert.equal(r.calls.filter(call => call.url === rendererURL).length, 2)
})

for (const [name, change] of [
  ['an inert widget', html => html.replace('<section class="branch-rippling-careers ', '<section hidden class="branch-rippling-careers ')],
  ['an inert renderer', html => html.replace('id="branch-rippling-careers-view-js"', 'hidden id="branch-rippling-careers-view-js"')],
  ['an unrelated native account', html => html.replace('ats.rippling.com/api/v2/board/branch/jobs', 'ats.rippling.com/api/v2/board/other/jobs')],
]) test('does not bind ' + name, () => {
  assert.equal(declaration(change(captured.get(publisherURL).html)), null)
})

for (const [name, mutate, expected] of [
  ['a different requisition', data => { data.props.pageProps.apiData.jobPost.uuid = indiaIds[1] }, /identity/i],
  ['a different legal employer', data => { data.props.pageProps.apiData.jobPost.companyName = 'Another Employer' }, /employer/i],
  ['a missing role description', data => { data.props.pageProps.apiData.jobPost.description.role = '' }, /description|criteria/i],
  ['an unlisted role', data => { data.props.pageProps.apiData.jobPost.unlistedFromSearch = true }, /unlisted|public/i],
  ['a test board', data => { data.props.pageProps.apiData.jobBoard.isTest = true }, /board|public/i],
  ['a different native location', data => { data.props.pageProps.apiData.jobPost.workLocations = ['London, United Kingdom'] }, /location/i],
]) test('rejects ' + name + ' without exposing staged jobs', async () => {
  const r = replay({ response: (url, response) => url === roleURL(indiaIds[0])
    ? { ...response, html: editNative(response.html, mutate) } : response })
  await assert.rejects(readRipplingRecruitment(declaration(), r.options), expected)
  assert.equal(r.jobs.length, 0)
})

test('does not admit structured full criteria absent from the visible role', async () => {
  const r = replay({ response: (url, response) => url === roleURL(indiaIds[0])
    ? { ...response, html: response.html.replace('3-5+ years of experience', '0-1 years of experience') } : response })
  await assert.rejects(readRipplingRecruitment(declaration(), r.options), /visible.*(?:content|criteria)|criteria.*visible/i)
  assert.equal(r.jobs.length, 0)
})

test('a native country label contradictory to its ISO country code cannot authorize India', async () => {
  const r = replay({ response: (url, response) => {
    if (url !== endpointURL) return response
    const payload = JSON.parse(response.html)
    payload.items.find(row => row.locations.some(location => location.countryCode === 'IN')).locations[0].countryCode = 'US'
    return { ...response, html: JSON.stringify(payload) }
  } })
  await assert.rejects(readRipplingRecruitment(declaration(), r.options), /country/i)
  assert.equal(r.jobs.length, 0)
})

test('closing native creation-date changes invalidate the complete staged result', async () => {
  const r = replay({ response: (url, response, count) => url === roleURL(indiaIds[0]) && count === 2
    ? { ...response, html: editNative(response.html, data => { data.props.pageProps.apiData.jobPost.createdOn = '2026-11-11T00:00:00Z' }) } : response })
  await assert.rejects(readRipplingRecruitment(declaration(), r.options), /closing.*(?:role|context)|role.*changed/i)
  assert.equal(r.jobs.length, 0)
})

test('closing native listing location drift invalidates the complete staged result', async () => {
  const r = replay({ response: (url, response, count) => {
    if (url !== endpointURL || count !== 2) return response
    const payload = JSON.parse(response.html); payload.items[0].locations[0].city = 'Elsewhere'
    return { ...response, html: JSON.stringify(payload) }
  } })
  await assert.rejects(readRipplingRecruitment(declaration(), r.options), /closing.*listing|listing.*changed/i)
  assert.equal(r.jobs.length, 0)
})

test('closing current publisher handoff changes invalidate the complete staged result', async () => {
  const r = replay({ response: (url, response) => url === publisherURL
    ? { ...response, html: response.html.replace('ats.rippling.com/api/v2/board/branch/jobs', 'ats.rippling.com/api/v2/board/other/jobs') } : response })
  await assert.rejects(readRipplingRecruitment(declaration(), r.options), /closing.*publisher|handoff/i)
  assert.equal(r.jobs.length, 0)
})

test('an unreviewed renderer cannot authorize the publisher data attribute', async () => {
  const r = replay({ response: (url, response) => url === rendererURL ? { ...response, html: response.html + '\n// changed' } : response })
  await assert.rejects(readRipplingRecruitment(declaration(), r.options), /renderer/i)
  assert.equal(r.jobs.length, 0)
})

test('the selected role cap retains all observed location rows and the incomplete source hold', async () => {
  const r = replay({ options: { maxDetails: 1 } })
  await readRipplingRecruitment(declaration(), r.options)
  assert.deepEqual(r.jobs.map(job => job.id), [indiaIds[0]])
  assert.equal(r.records.length, 11)
  assert.ok(r.unresolved.includes('native-detail-budget-reached'))
  assert.equal(r.inventories[0].sourceScopeComplete, false)
})

test('a depleted source read budget refuses work before starting a callback', async () => {
  const r = replay({ options: { canRead: () => false } })
  await assert.rejects(readRipplingRecruitment(declaration(), r.options), /budget/i)
  assert.equal(r.calls.length, 0)
  assert.equal(r.jobs.length, 0)
})

test('a caller cannot replace the reviewed renderer with an unrelated URL', async () => {
  const r = replay()
  await assert.rejects(readRipplingRecruitment({ ...declaration(), rendererURL: 'https://other.example/widget.js' }, r.options), /renderer|declaration/i)
  assert.equal(r.calls.length, 0)
})
