import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createLangchainNativeScraper, CAREERS_URL, BOARD_URL, API_URL} from './nativeInventory.js'
import {declaredNativeFrontend, nativeFrontendEntry, verifyNativeFrontend} from './nativeFrontendContract.js'

const fixture = new URL('./test-data/current-public-profile-20261107/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixture)))
const responses = manifest.records.map(record => {
  const bytes = gunzipSync(readFileSync(new URL(record.bodyFile, fixture)))
  assert.equal(bytes.length, record.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256)
  return {...record, url:record.finalUrl, body:bytes.toString('utf8')}
})
const board = responses[1].body
const loader = readFileSync(new URL('declared-loader.txt', fixture), 'utf8')
assert.ok(board.includes(loader))
assert.ok(loader.length > 4000)
function verify(program = responses[3].body, declarationChange = x => x) {
  const declaration = declaredNativeFrontend(loader)
  const rawManifest = JSON.parse(responses[2].body)
  rawManifest['index.html'].integrity = 'sha384-' + createHash('sha384').update(program).digest('base64')
  const entry = nativeFrontendEntry(declaration, {...responses[2],body:JSON.stringify(rawManifest)}, () => {})
  return verifyNativeFrontend(declarationChange(declaration), entry, {...responses[3],body:program}, () => {})
}
test('genuine current SRI client supports the reviewed public false-stealth board with unchanged unpaginated query', () => {
  const result = verify()
  assert.equal(result.reviewedProgramASTProfile, 'reviewed-complete-module-public-stealth-false-20261107')
  assert.equal(result.entrySHA256, responses[3].sha256)
  assert.equal(result.queryASTSHA256, '5757e608c18a177a1e70fb35eda558dc3d8204d8269cbc084317edd9c7f4c8ea')
  assert.deepEqual(result.criticalFunctions.map(x => x.name), ['NT','Jyt','ey','Rle','Fle','Yyt'])
  assert.equal(result.downloadedJavaScriptExecuted, false)
})

test('genuine current false-stealth bootstrap reaches its exact declared manifest without an API read', async () => {
  const calls = [], stop = Object.freeze({fixtureBoundary:'manifest is next; no complete inventory claimed'})
  await assert.rejects(createLangchainNativeScraper().run({acquisitionMode:'captured-response-replay',fetchDocument:async url=>{
    calls.push(url)
    if (calls.length === 3) throw stop
    return responses[calls.length - 1]
  }}), error => error === stop)
  assert.deepEqual(calls, [CAREERS_URL,BOARD_URL,responses[2].requestedUrl])
  assert.ok(!calls.includes(API_URL))
})
for (const [label, change] of [
  ['true stealth', value=>value.replace('"stealthAccess":false','"stealthAccess":true')],
  ['string stealth', value=>value.replace('"stealthAccess":false','"stealthAccess":"false"')],
  ['null stealth', value=>value.replace('"stealthAccess":false','"stealthAccess":null')],
  ['duplicate stealth', value=>value.replace('"stealthAccess":false','"stealthAccess":true,"stealthAccess":false')],
  ['escaped duplicate stealth', value=>value.replace('"stealthAccess":false','"stealthAccess":false,"stealth\\u0041ccess":false')],
  ['additional private authority', value=>value.replace('"stealthAccess":false','"stealthAccess":false,"privateAccess":false')],
  ['duplicate employer', value=>value.replace('"name":"LangChain"','"name":"Other employer","name":"LangChain"')],
]) test('synthetic current bootstrap rejects ' + label + ' before client/API access', async () => {
  const changed=change(board);assert.notEqual(changed,board)
  const calls=[]
  await assert.rejects(createLangchainNativeScraper().run({fetchDocument:async url=>{calls.push(url);assert.ok(calls.length<=2,'Rejected bootstrap must not request client/API');return {...responses[calls.length-1],...(url===BOARD_URL?{body:changed}:{})}}}), /board|bootstrap|duplicate|employer|authority/i)
  assert.deepEqual(calls,[CAREERS_URL,BOARD_URL])
})
for (const [label, change] of [
  ['extra bootstrap write', p=>p+'\nwindow.__appData.jobBoard.jobPostings=[];'],
  ['private redirect override', p=>p.replace('r&&c&&s.stealthAccess===!1','r&&s.stealthAccess===!1')],
  ['different actual query binding', p=>p.replace('tk(JOe,{variables:{organizationHostedJobsPageName:n}', 'tk(WOe,{variables:{organizationHostedJobsPageName:n}')],
  ['changed current deployment slot', p=>p.replace('function UCe({consentGranted:e})','function UnknownCe({consentGranted:e})')],
  ['unreviewed ordinary form logic', p=>p.replace('function uoe(e,t=!1){return t&&e==null?!0:typeof e==`object`&&!!e}', 'function uoe(e,t=!1){return true}')],
]) test('current whole-module fingerprint rejects synthetic ' + label + ' even with recomputed SRI', () => {
  const program=change(responses[3].body);assert.notEqual(program,responses[3].body)
  assert.throws(()=>verify(program), /AST|binding|contract|program/i)
})

test('current literal board query cannot gain pagination despite recomputed SRI', () => {
  const start = responses[3].body.indexOf('JOe=JSON.parse(`'), end = responses[3].body.indexOf('`)', start)
  assert.ok(start >= 0 && end > start)
  const query = responses[3].body.slice(start, end)
  const changed = query.replace('"value":"jobPostings"},"selectionSet"', '"value":"jobPostings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet"')
  assert.notEqual(changed, query)
  assert.throws(() => verify(responses[3].body.slice(0,start)+changed+responses[3].body.slice(end)), /query|pagination/i)
})

test('current client cannot consume an absent public access declaration from another board schema', async () => {
  const changed = board.replace('"stealthAccess":false,', '')
  assert.notEqual(changed, board)
  const calls = []
  await assert.rejects(createLangchainNativeScraper().run({fetchDocument:async url=>{
    calls.push(url); assert.ok(calls.length <= 4, 'No native API access after profile/schema disagreement')
    return {...responses[calls.length-1], ...(url===BOARD_URL?{body:changed}:{})}
  }}), /access declaration|profile disagree/i)
  assert.deepEqual(calls, responses.map(row=>row.requestedUrl))
})

test('genuine actual8 registered DEFAULT replay retains99 full roles, two worksite holds and unknown India total', async () => {
  const {replayGenuineRegisteredDefault}=await import('./test-data/registered-default-current-20261107/replay.mjs')
  const proof=await replayGenuineRegisteredDefault()
  assert.equal(proof.replayedOriginalRequests,8)
  assert.equal(proof.entireSerializedOutputEqualExceptExplicitClocks,true)
  assert.equal(proof.ignoredRuntimeFields.length,21)
  assert.deepEqual(proof.ignoredRoleOrBusinessFields,[])
})
