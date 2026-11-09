import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createLangchainNativeScraper } from './nativeInventory.js'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const frontendFixture = new URL('./test-data/frontend-contract-20261105/', import.meta.url)
const frontendManifest = JSON.parse(readFileSync(new URL('manifest.json', frontendFixture)))
const nativeFixture = new URL('./test-data/native-inventory-20261105/', import.meta.url)
const nativeManifest = JSON.parse(readFileSync(new URL('manifest.json', nativeFixture)))
const nativeResponses = nativeManifest.records.map(record => {
  const bytes = gunzipSync(readFileSync(new URL(record.bodyFile, nativeFixture)))
  assert.equal(sha(bytes), record.sha256)
  return { ...record, url: record.finalUrl, body: bytes.toString('utf8') }
})
const loaders = frontendManifest.loaders.map(record => {
  const body = readFileSync(new URL(record.bodyFile, frontendFixture), 'utf8')
  assert.equal(sha(body), record.loaderSHA256)
  return { ...record, body }
})
const profiles = Object.fromEntries(Object.entries(frontendManifest.profiles).map(([name, profile]) => {
  const read = record => {
    const bytes = gunzipSync(readFileSync(new URL(record.bodyFile, frontendFixture)))
    assert.equal(bytes.length, record.bytes); assert.equal(sha(bytes), record.sha256)
    return bytes.toString('utf8')
  }
  const manifest = JSON.parse(read(profile.manifest)), program = read(profile.program)
  const base = profile.manifest.requestedUrl.slice(0, -'.vite/manifest.json'.length)
  return [name, { manifest, program, base, version: base.split('/').at(-2),
    normalizedProgramASTSHA256: profile.normalizedProgramASTSHA256 ?? '088cf22a4f0074e78997d6cdba2c378321f164237a95e98089a3a0937dda00ca' }]
}))
const CAREERS = 'https://www.langchain.com/careers', BOARD = 'https://jobs.ashbyhq.com/langchain'
const API = 'https://api.ashbyhq.com/posting-api/job-board/langchain'
const OBSERVATIONS = Symbol.for('jobverify.verified-recruitment-observations')

// These compose genuine immutable data with explicitly SYNTHETIC deployment
// substitutions/mutations. No new live inventory or acquisition is claimed.
function dynamicContext(profileName = 'v2', change = () => {}) {
  const profile = profiles[profileName], version = 'a'.repeat(40)
  const base = 'https://cdn.ashbyprd.com/frontend_non_user/' + version + '/'
  assert.equal(profile.program.split(profile.version).length - 1, 2)
  const data = { base, manifest: structuredClone(profile.manifest),
    program: profile.program.replaceAll(profile.version, version),
    loader: loaders[0].body.replaceAll(loaders[0].deploymentBase, base), badSRI: false }
  change(data)
  if (!data.badSRI) data.manifest['index.html'].integrity = 'sha384-' + createHash('sha384').update(data.program).digest('base64')
  const board = nativeResponses.find(record => record.requestedUrl === BOARD).body.replace(loaders[0].body, data.loader)
  const manifestURL = base + '.vite/manifest.json'
  const entryURL = base + profile.manifest['index.html'].file
  const calls = []
  return { calls, data, options: { acquisitionMode: 'captured-response-replay', fetchDocument: async url => {
    calls.push(url)
    if (url === manifestURL) return { status: 200, url, body: JSON.stringify(data.manifest), headers: { 'content-type': 'application/json' } }
    if (url === entryURL) return { status: 200, url, body: data.program, headers: { 'content-type': 'application/javascript' } }
    const record = nativeResponses.find(record => record.requestedUrl === url)
    assert.ok(record, 'Unexpected synthetic contract request: ' + url)
    return { ...record, ...(url === BOARD ? { body: board } : {}) }
  } }, expectedCalls: [CAREERS, BOARD, manifestURL, entryURL, API, API, BOARD, CAREERS] }
}

for (const profile of ['v2', 'v3', 'current-reviewed']) test('dynamic bounded contract accepts only deployment substitutions over genuine ' + profile + ' data', async () => {
  const context = dynamicContext(profile)
  const jobs = await createLangchainNativeScraper().run(context.options)
  assert.deepEqual(context.calls, context.expectedCalls)
  assert.equal(jobs.length, 0)
  const audit = jobs[OBSERVATIONS].nativeInventoryAudit
  assert.equal(audit.fullNativeModels.length, 101)
  assert.equal(audit.reviewedNativeFrontend.programsRefetchedDuringThisAttempt, true)
  assert.equal(audit.reviewedNativeFrontend.downloadedJavaScriptExecuted, false)
  assert.equal(audit.reviewedNativeFrontend.normalizedProgramASTSHA256, profiles[profile].normalizedProgramASTSHA256)
  assert.equal(audit.reviewedNativeFrontend.entrySHA256, sha(context.data.program))
  assert.equal(audit.allRoleDetailHealth.incompleteWorksiteJobs, 2)
  assert.equal(audit.configuredBoardInventoryComplete, false)
  assert.equal(audit.configuredBoardIndiaCount, null)
  assert.equal(audit.sourceScopeComplete, false); assert.equal(audit.lifecycleCleanupAllowed, false)
})

test('five genuine loader deployments have one exact normalized declared template', async () => {
  const { declaredNativeFrontend } = await import('./nativeFrontendContract.js')
  for (const loader of loaders) {
    const declaration = declaredNativeFrontend(loader.body)
    assert.equal(declaration.base, loader.deploymentBase)
    assert.equal(declaration.manifestURL, loader.manifestURL)
    assert.equal(declaration.normalizedLoaderSHA256, 'd68cc05fe45b187a88eb9a68be8ed88ad33a1e99656c0b6756ab1967ae94ed07')
  }
})

for (const [label, change, calls] of [
  ['mixed loader deployments', data => { data.loader = data.loader.replace(data.base, data.base.replace(/a{40}/, 'b'.repeat(40))) }, 2],
  ['changed loader behavior', data => { data.loader += '\nwindow.__appData.jobBoard.jobPostings=[];' }, 2],
  ['foreign manifest entry', data => { data.manifest['index.html'].file = 'https://foreign.invalid/entry.js' }, 3],
  ['traversing manifest entry', data => { data.manifest['index.html'].file = '../assets/index-12345678.js' }, 3],
  ['incorrect actual entry SRI', data => { data.badSRI = true; data.program += '\n;' }, 4],
  ['an unreviewed static import', data => { data.program += '\nimport "https://foreign.invalid/entry.js";' }, 4],
  ['a later critical binding replacement', data => { data.program += '\nRyt={jobPostings:[],teams:[]};' }, 4],
  ['an extra bootstrap property mutation', data => { data.program += '\nwindow.__appData.jobBoard.jobPostings=[];' }, 4],
  ['a changed traversal helper', data => {
    const marker = 'function*ty(', start = data.program.indexOf(marker)
    assert.ok(start >= 0)
    const body = data.program.indexOf('{', start)
    data.program = data.program.slice(0, body + 1) + 'return;' + data.program.slice(body + 1)
  }, 4],
  ['an unapproved normalization slot context', data => { data.program = data.program.replace('"ddDebugId":', '"otherDebugId":') }, 4],
]) test('dynamic contract rejects synthetic ' + label + ' before native API access', async () => {
  const context = dynamicContext('v2', change)
  await assert.rejects(createLangchainNativeScraper().run(context.options), /loader|contract|manifest|entry|integrity|SRI|AST|binding|program|imports/i)
  assert.equal(context.calls.length, calls)
  assert.ok(!context.calls.includes(API))
})

test('dynamic contract rejects native query pagination despite recomputed synthetic SRI', async () => {
  const context = dynamicContext('v2', data => {
    const start = data.program.indexOf('WOe=JSON.parse(`'), end = data.program.indexOf('`)', start)
    assert.ok(start >= 0 && end > start)
    const query = data.program.slice(start, end)
    const changed = query.replace('"value":"jobPostings"},"selectionSet"', '"value":"jobPostings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet"')
    assert.notEqual(changed, query)
    data.program = data.program.slice(0, start) + changed + data.program.slice(end)
  })
  await assert.rejects(createLangchainNativeScraper().run(context.options), /contract|AST|query|program/i)
  assert.equal(context.calls.length, 4)
  assert.ok(!context.calls.includes(API))
})
