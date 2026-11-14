import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {readObservedCognizantRole,runCognizantCurrent20261113} from './currentNative20261113.js'
import {extractSearchResults,extractPaginationSummary} from './script.js'

const oldURL='https://careers.cognizant.com/phb/style.css.v639301575709021910'
const currentURL='https://careers.cognizant.com/phb/style.css.v639302436116504436'
const boardURL='https://careers.cognizant.com/india-en/jobs/'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261114/stylesheet-alias-native.json.gz',import.meta.url))))
const packets=new Map(fixture.responses.map(row=>[row.requestedUrl,row]))
const currentCSS=packets.get(currentURL).body
const currentRole=fixture.responses.find(row=>/\/jobs\/\d+\//.test(row.requestedUrl))
const id=currentRole.requestedUrl.match(/\/jobs\/(\d+)\//)[1]
const sha=value=>createHash('sha256').update(value).digest('hex')
const oldFolder=new URL('./fixtures/current-20261113/positive-native/',import.meta.url)
const oldReceipts=JSON.parse(readFileSync(new URL('receipts.json',oldFolder)))
const sourceHeaders={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}
const response=(body,url,mime='text/html')=>{const r=new Response(body,{headers:{'content-type':mime}});Object.defineProperty(r,'url',{value:url});return r}
test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network in stylesheet regression')}))

test('three genuine current native entities retain exact bytes and the complete same-content stylesheet',()=>{
 assert.equal(fixture.responses.length,3)
 for(const row of fixture.responses){assert.equal(row.status,200);assert.equal(row.finalUrl,row.requestedUrl);assert.equal(Buffer.byteLength(row.body),row.bytes);assert.equal(sha(row.body),row.sha256)}
 const oldCSS=gunzipSync(readFileSync(new URL('current-native.css.gz',oldFolder)))
 assert.equal(oldCSS.length,369496);assert.equal(sha(oldCSS),sha(currentCSS))
 assert.equal(currentCSS,oldCSS.toString('utf8'))
 assert.ok(packets.get(boardURL).body.includes(new URL(currentURL).pathname))
})

test('actual current full authored criteria qualify with the exact same-content CSS alias while the foreign role/application remain held',()=>{
 const observation=readObservedCognizantRole(currentRole.body,{id,sourceUrl:currentRole.requestedUrl,css:currentCSS})
 assert.equal(observation.criteriaComplete,true,observation.issues.join(';'))
 assert.equal(observation.indiaCandidate,false)
 assert.equal(observation.nativeCountries.length,1)
 assert.match(observation.nativeCountries[0],/^United States$/i)
 assert.ok(observation.originalDescription.length>100)
 assert.equal(observation.applicationHandoffComplete,false)
 assert.match(observation.declaredApplyUrl,/^https:\/\/cognizant[.]taleo[.]net\//)
 assert.equal(observation.job,null)
})

test('exact current declaration progresses registered acquisition and retains all old explicit holds',async()=>{
 const calls=[]
 let audit
 // This is a declaration mutation of the genuine prior ten-row page, not a new live inventory claim.
 const fetchImpl=async(url)=>{
  calls.push(url)
  if(url===currentURL)return response(currentCSS,url,'text/css')
  const receipt=oldReceipts.find(row=>row.requestedUrl===url)
  if(receipt){const body=gunzipSync(readFileSync(new URL(receipt.file,oldFolder))).toString('utf8').replaceAll(new URL(oldURL).pathname,new URL(currentURL).pathname);return response(body,url)}
  if(url.startsWith('https://talent.cognizant.com/4681/?RRID='))return response(gunzipSync(readFileSync(new URL('application-shell.html.gz',oldFolder))),url)
  if(url.endsWith('/main.e62755a514d3e160.js'))return new Response('Application access remains denied',{status:403})
  throw Error('Unexpected declared fixture request '+url)
 }
 const jobs=await runCognizantCurrent20261113({fetchImpl,onAudit:value=>{audit=value}},{extractSearchResults,extractPaginationSummary,maxPages:1,headers:sourceHeaders})
 assert.equal(jobs.length,0);assert.equal(calls[1],currentURL)
 assert.equal(audit.observedRecordCount,10)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.closingStable,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.ok(audit.observations.every(row=>row.nativeRecord&&row.nativeArticleHtml&&row.job===null))
})

test('an actual Response BOM in the new immutable CSS entity rejects before any role detail read',async()=>{
 const calls=[]
 const fetchImpl=async(url)=>{calls.push(url);if(url===boardURL)return response(packets.get(boardURL).body,url);assert.equal(url,currentURL);return response(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(currentCSS)]),url,'text/css')}
 await assert.rejects(runCognizantCurrent20261113({fetchImpl},{extractSearchResults,extractPaginationSummary,maxPages:1,headers:sourceHeaders}),/raw native stylesheet bytes changed/)
 assert.deepEqual(calls,[boardURL,currentURL])
})

for(const [label,change] of [
 ['unknown version',html=>html.replaceAll(new URL(currentURL).pathname,new URL(currentURL).pathname+'9')],
 ['foreign authority',html=>html.replaceAll(new URL(currentURL).pathname,'https://example.com'+new URL(currentURL).pathname)],
 ['new CSS visibility rule',html=>html],
])test('finite current CSS qualification rejects '+label,()=>{
 const html=change(currentRole.body),css=label==='new CSS visibility rule'?currentCSS+'\n.cms-content{display:none}':currentCSS
 assert.equal(readObservedCognizantRole(html,{id,sourceUrl:currentRole.requestedUrl,css}).criteriaComplete,false)
})
