import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createProvidenceScraper,readProvidenceAuthorityHTML,PROVIDENCE_INDIA_BOARD_URL,PROVIDENCE_INDIA_CAREERS_URL} from './currentIndia20261108.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/closing-board-full-reads.json.gz',import.meta.url))))
const boards=capture.responses.filter(packet=>packet.requestUrl===PROVIDENCE_INDIA_BOARD_URL)
const closing=boards[1]
test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected live network in Providence closing-board tests')}))

test('Providence independently admits both observed board cache declarations with the same owned search handoff',()=>{
 assert.equal(boards.length,2)
 for(const packet of boards){
  assert.equal(packet.status,200)
  assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
  const authority=readProvidenceAuthorityHTML(packet.body,PROVIDENCE_INDIA_BOARD_URL)
  assert.equal(authority.nextURL,'https://careers.providence.in/search/')
  assert.equal(authority.bodySHA256,packet.sha256)
 }
 assert.notEqual(boards[0].sha256,closing.sha256)
})

test('Providence retains all configured observations and 63 qualified roles after the captured closing board cache change',async()=>{
 const pages=new Map(),counts=new Map()
 for(const packet of capture.responses){const queue=pages.get(packet.requestUrl)||[];queue.push(packet);pages.set(packet.requestUrl,queue)}
 let audit
 const jobs=await createProvidenceScraper().run({onAudit:value=>{audit=value},fetchImpl:async url=>{
  const queue=pages.get(url);assert.ok(queue,'Uncaptured request: '+url)
  const index=counts.get(url)||0;counts.set(url,index+1)
  // The live run stopped at the closing board. Only the final corporate
  // response is a controlled stable replay of its authentic opening response.
  if(index>=queue.length)assert.equal(url,PROVIDENCE_INDIA_CAREERS_URL)
  const packet=queue[Math.min(index,queue.length-1)]
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
 }})
 assert.equal(jobs.length,63)
 assert.equal(audit.nativeObservedRows,76)
 assert.equal(audit.openingRoles.length,76)
 assert.equal(audit.closingRoles.length,76)
 assert.equal(audit.held.length,13)
 assert.equal(audit.configuredBoardReconciled,true)
 assert.equal(readSourceObservationEvidence(jobs,'providence').observedVacancyCount,76)
 assert.ok(audit.authorityClosingEvidence.some(row=>row.kind==='board'&&row.selectedAuthorityModelsEntireEqual&&row.wholeRawBodyEqual===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(job=>job.country==='India'&&job.lifecycleCleanupAllowed===false))
})

for(const[name,change]of[
 ['an unknown cache declaration',html=>html.replaceAll('i=565448483','i=565448484')],
 ['a changed carrier ancestor',html=>html.replace('<body ','<body data-unreviewed="1" ')],
 ['unreviewed inline code',html=>html.replace('var ctid =','var ctid = /*unreviewed*/')],
 ['an extra stylesheet',html=>html.replace('</head>','<style>body{display:none}</style></head>')],
 ['foreign search authority',html=>html.replaceAll('/search/','https://foreign.invalid/search/')],
])test('Providence closing board admission still rejects '+name,()=>{
 const changed=change(closing.body)
 assert.ok(changed!==closing.body,'Negative control must change the captured response')
 assert.throws(()=>readProvidenceAuthorityHTML(changed,PROVIDENCE_INDIA_BOARD_URL),/Providence India/)
})
