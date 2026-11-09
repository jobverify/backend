import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { OFFICIAL_ATS_DISCOVERY } from '../scraper-support/utils/officialAtsRecovery.js'

const root = new URL('../scraper/chownow/fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root), 'utf8'))
const records = manifest.requests.map(receipt => {
  const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, root)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return { ...receipt, body: body.toString('utf8') }
})
const CAREERS = 'https://get.chownow.com/careers/'
const CLIENT = 'https://get.chownow.com/wp-content/themes/cn-merged/assets/js/careers-lever-api.js'
const API = 'https://api.lever.co/v0/postings/chownow?mode=json'
const payload = JSON.parse(records.find(row => row.requestedURL === API).body)
const role = payload[0]
assert.equal(payload.length, 15)
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'chownow')).run(options)
const emptyRenderer = code => {
  const program = parse(code, { ecmaVersion: 'latest' })
  const initializer = program.body[0].expression.callee.body.body.find(node => node.type === 'FunctionDeclaration')
  const renderer = initializer.body.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'renderJobs')
  return code.slice(0, renderer.body.start) + '{}' + code.slice(renderer.body.end)
}
const retirePathHelper = code => {
  const program = parse(code, { ecmaVersion: 'latest' })
  const initializer = program.body[0].expression.callee.body.body.find(node => node.type === 'FunctionDeclaration')
  const helper = initializer.body.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'getLeverTeam')
  return code.slice(0, helper.body.start) + '{ throw new Error("native client retired"); }' + code.slice(helper.body.end)
}
const replay = (t, mutate) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    calls.push(url)
    assert.equal(init.method || 'GET', 'GET')
    const receipt = records.find(row => row.requestedURL === url)
    assert.ok(receipt, 'Uncaptured HTTP request: ' + url)
    const current = mutate ? mutate({ ...receipt }, calls) : receipt
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
// Native geography alone is changed to exercise future India extraction. These
// mutations are test cases, not assertions that any current feed role is Indian.
const withIndia = row => {
  if (row.requestedURL !== API) return row
  const data = JSON.parse(row.body)
  Object.assign(data[0], { country: 'IN', categories: { ...data[0].categories,
    location: 'Bengaluru, India', allLocations: ['Bengaluru, India'] } })
  return { ...row, body: JSON.stringify(data) }
}

test('registered ChowNow follows the current corporate script loader and native15-role Lever feed without a company-wide zero claim', async t => {
  const calls = replay(t)
  const jobs = await run()
  assert.deepEqual(calls, [CAREERS, CLIENT, API])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards[0].boardToken, 'chownow')
})

test('ChowNow retains a future native India role with all original content sections and publication time', async t => {
  replay(t, withIndia)
  const jobs = await run()
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, role.id)
  assert.equal(job.company, 'Chownow')
  assert.equal(job.title, role.text)
  assert.equal(job.country, 'India')
  assert.equal(job.sourceUrl, role.hostedUrl)
  assert.equal(job.applyUrl, role.applyUrl)
  assert.ok(job.sourceDescription.includes(role.descriptionBody))
  assert.ok(role.lists.every(section => job.sourceDescription.includes(section.content)))
  assert.ok(job.sourceDescription.includes(role.additional))
  assert.equal(new Date(job.postingDate).getTime(), role.createdAt)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
})

test('ChowNow preserves an unknown native publication date without replacing it with fetch time', async t => {
  replay(t, row => {
    row = withIndia(row)
    if (row.requestedURL !== API) return row
    const data = JSON.parse(row.body)
    delete data[0].createdAt
    return { ...row, body: JSON.stringify(data) }
  })
  assert.equal((await run())[0].postingDate, null)
})

const brokenClient = ['detached client initialization', 'native method', 'URL reassignment', 'fetcher early return',
  'ready early return', 'renderer early return', 'initializer early return', 'wrapper early return',
  'generator wrapper', 'empty renderer', 'detached renderer', 'unreachable script entry',
  'shadowed renderer sink', 'initializer side effect', 'mutated outer sink', 'shadowed row helper',
  'reassigned row helper', 'retired path helper', 'initial path side effect',
  'unsupported wrapper call', 'unsupported initializer call', 'selector initializer side effect']
for (const changed of ['removed loader', 'inactive loader', ...brokenClient, 'country', 'posting account', 'duplicate identity', 'missing content', 'error envelope']) {
  test('ChowNow rejects ' + changed + ' without inventing an empty success', async t => {
    const calls = replay(t, row => {
      if (row.requestedURL === CAREERS && changed === 'removed loader') return { ...row, body: row.body.replaceAll('careers-lever-api.js', 'unrelated-client.js') }
      if (row.requestedURL === CAREERS && changed === 'inactive loader') return { ...row, body: row.body.replace(/loadjs\(\[hwJsDir \+ 'careers-lever-api\.js', [^\]]+\], 'careersjs'\);/, 'if (false) $&') }
      if (row.requestedURL === CLIENT && changed === 'detached client initialization') return { ...row, body: row.body.replace('leverJobsInit();', '') }
      if (row.requestedURL === CLIENT && changed === 'native method') return { ...row, body: row.body.replace('dataType: "json",', 'dataType: "json", type: "POST",') }
      if (row.requestedURL === CLIENT && changed === 'URL reassignment') return { ...row, body: row.body.replace('$.ajax({', "leverUrl = 'https://api.lever.co/v0/postings/unrelated?mode=json'; $.ajax({") }
      if (row.requestedURL === CLIENT && changed === 'fetcher early return') return { ...row, body: row.body.replace('$.ajax({', 'return; $.ajax({') }
      if (row.requestedURL === CLIENT && changed === 'ready early return') return { ...row, body: row.body.replace('leverJobsInit();', 'return; leverJobsInit();') }
      if (row.requestedURL === CLIENT && changed === 'renderer early return') return { ...row, body: row.body.replace('function renderJobs(_data) {', 'function renderJobs(_data) { return;') }
      if (row.requestedURL === CLIENT && changed === 'initializer early return') return { ...row, body: row.body.replace('function leverJobsInit() {', 'function leverJobsInit() { return;') }
      if (row.requestedURL === CLIENT && changed === 'wrapper early return') return { ...row, body: row.body.replace('(function($){', '(function($){ return;') }
      if (row.requestedURL === CLIENT && changed === 'generator wrapper') return { ...row, body: row.body.replace('(function($){', '(function*($){') }
      if (row.requestedURL === CLIENT && changed === 'empty renderer') return { ...row, body: emptyRenderer(row.body) }
      if (row.requestedURL === CLIENT && changed === 'detached renderer') return { ...row, body: row.body.replaceAll('$jobsListContainer.html(', '$("<div>").html(') }
      if (row.requestedURL === CLIENT && changed === 'unreachable script entry') return { ...row, body: 'throw new Error("native client retired");\n' + row.body }
      if (row.requestedURL === CLIENT && changed === 'shadowed renderer sink') return { ...row, body: row.body.replace('var posting = _data[i];', 'var $jobsListContainer = $("<div>"); var posting = _data[i];') }
      if (row.requestedURL === CLIENT && changed === 'initializer side effect') return { ...row, body: row.body.replace('var locationCleanString = cleanString(location);', 'var locationCleanString = (retireNativeBinding(), cleanString(location));') }
      if (row.requestedURL === CLIENT && changed === 'mutated outer sink') return { ...row, body: row.body.replace('function cleanString(string) {', 'function cleanString(string) { $jobsListContainer = $("<div>");') }
      if (row.requestedURL === CLIENT && changed === 'shadowed row helper') return { ...row, body: row.body.replace('function leverJobsInit() {', 'function leverJobsInit() { var cleanString = function() { throw new Error("renderer retired"); };') }
      if (row.requestedURL === CLIENT && changed === 'reassigned row helper') return { ...row, body: row.body.replace('function renderCareersFilters(_data) {', 'function renderCareersFilters(_data) { cleanString = function() { throw new Error("renderer retired"); };') }
      if (row.requestedURL === CLIENT && changed === 'retired path helper') return { ...row, body: retirePathHelper(row.body) }
      if (row.requestedURL === CLIENT && changed === 'initial path side effect') return { ...row, body: row.body.replace('var leverTeam = getLeverTeam(lastSegment);', 'var leverTeam = (retireNativeBinding(), getLeverTeam(lastSegment));') }
      if (row.requestedURL === CLIENT && changed === 'unsupported wrapper call') return { ...row, body: row.body.replace('(function($){', '(function($){ retireNativeBinding();') }
      if (row.requestedURL === CLIENT && changed === 'unsupported initializer call') return { ...row, body: row.body.replace('function leverJobsInit() {', 'function leverJobsInit() { retireNativeBinding();') }
      if (row.requestedURL === CLIENT && changed === 'selector initializer side effect') return { ...row, body: row.body.replace("var $jobsTeam = $('.jobs-sort .jobs-teams');", 'var $jobsTeam = retireNativeBinding();') }
      row = withIndia(row)
      if (row.requestedURL !== API) return row
      let data = JSON.parse(row.body)
      if (changed === 'country') data[0].country = 'US'
      if (changed === 'posting account') data[0].applyUrl = 'https://jobs.lever.co/unrelated/' + role.id + '/apply'
      if (changed === 'duplicate identity') data.push({ ...data[0], text: 'Other role', description: '<p>Other source content</p>' })
      if (changed === 'missing content') Object.assign(data[0], { opening: '', openingPlain: '', description: '', descriptionPlain: '', descriptionBody: '', descriptionBodyPlain: '', lists: [], additional: '', additionalPlain: '' })
      if (changed === 'error envelope') data = { success: false, error: 'Unavailable', jobs: [] }
      return { ...row, body: JSON.stringify(data) }
    })
    await assert.rejects(run())
    if (['removed loader', 'inactive loader', ...brokenClient].includes(changed)) assert.ok(!calls.includes(API))
  })
}

test('ChowNow honors caller cancellation before any employer or native request', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled source must not fetch'))
  const controller = new AbortController()
  controller.abort(Error('cancel ChowNow source'))
  await assert.rejects(run({ signal: controller.signal }), /cancel ChowNow source/)
})
