import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {runCurrentHuntressProgramme} from './currentProgramme.js'
import {nativeAPI} from './currentProgrammeData.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-deployment-20261121.json.gz',import.meta.url))))
const CORPORATE='https://www.huntress.com/company/careers',BOARD='https://job-boards.greenhouse.io/huntress',API='https://boards-api.greenhouse.io/v1/boards/huntress/jobs?content=true'
const originalAPI=JSON.parse(Buffer.from(fixture.packets[2].bodyBase64,'base64').toString('utf8'))
const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/fixtures/huntress-current-programme-20261111.json.gz',import.meta.url))))
const boardScript=readNativeDocument(Buffer.from(fixture.packets[1].bodyBase64,'base64').toString('utf8')).nodes(node=>node.tag==='script'&&(node.raw??'').startsWith('window.__remixContext = '))[0]
const currentPosts=JSON.parse(boardScript.raw.slice('window.__remixContext = '.length,-1)).state.loaderData['routes/$url_token'].jobPosts.data
const editBody=(packet,change)=>{const before=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),after=change(before);assert.notEqual(after,before,'Control changes actual acquired bytes');packet.bodyBase64=Buffer.from(after).toString('base64')}
async function replay(change=()=>{},{independentCorporate=false}={}){
 const counts=new Map(),calls=[]
 const jobs=await runCurrentHuntressProgramme({now:()=>fixture.capturedAt,requestIntervalMs:0,fetchImpl:async url=>{
  const visit=(counts.get(url)??0)+1;counts.set(url,visit);assert.ok(visit<=2,'Bounded closing reads')
  const packet=structuredClone(independentCorporate&&url===CORPORATE?fixture.corporateVariants[visit-1]:fixture.packets.find(packet=>packet.requestedURL===url))
  assert.ok(packet,'Only current acquired programme URLs')
  change(packet,url,visit);calls.push(url)
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 return {jobs,calls}
}
test('original native h2 section headings retain every full published criterion and explicit foreign scope',()=>{
 const parsed=nativeAPI(Buffer.from(fixture.packets[2].bodyBase64,'base64').toString('utf8'),{posts:currentPosts},fixture.capturedAt)
 assert.deepEqual(parsed.value,originalAPI)
 assert.match(parsed.value.jobs.find(job=>job.id===8199228003).content,/&lt;h2&gt;/)
})
test('independent current corporate GETs with issued anonymous experiment visitor IDs close without losing original bytes',async()=>{
 const {jobs}=await replay(()=>{},{independentCorporate:true}),audit=jobs.nativeCollectionEvidence
 assert.equal(audit.nativePayload.jobs.length,49);assert.equal(audit.corporateClosing.rawBodiesEqual,false)
 assert.equal(audit.rawResponses[0].bodyBase64,fixture.corporateVariants[0].bodyBase64)
 assert.equal(audit.rawResponses[5].bodyBase64,fixture.corporateVariants[1].bodyBase64)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})
test('anonymous experiment comparison cannot hide a changed programme field',async()=>{
 await assert.rejects(replay((packet,url)=>{if(url===CORPORATE)editBody(packet,raw=>raw.replace('"visitorData":{"id":','"visitorCountry":{"id":'))},{independentCorporate:true}),error=>error.code==='HUNTRESS_PROGRAMME_HOLD')
})
test('current original Huntress deployment reconciles all49 foreign postings with source and cleanup held',async()=>{
 const {jobs,calls}=await replay(),inventory=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(inventory.reportedTotal,49);assert.equal(inventory.indiaFacetCount,0);assert.equal(inventory.listingComplete,true)
 assert.equal(inventory.lifecycleCleanupAllowed,false);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalScopeQualified,false)
 assert.equal(audit.ownRoleSchemaAcquired,false);assert.equal(audit.applicationScreeningAcquired,false)
 assert.deepEqual(audit.nativePayload,originalAPI);assert.equal(audit.nativeBoard.posts.length,49)
 assert.deepEqual([...new Set(audit.nativePayload.jobs.map(job=>job.company_name))],['Huntress Labs'])
 assert.deepEqual(calls,[CORPORATE,BOARD,API,API,BOARD,CORPORATE])
})
for(const [name,change]of[
 ['foreign actual employer',value=>{value.jobs[0].company_name='Unrelated Employer'}],
 ['India office country',value=>{value.jobs[0].offices[0].name='India'}],
 ['authored India qualification',value=>{value.jobs[0].content+='&lt;p&gt;Applicants must reside in India.&lt;/p&gt;'}],
 ['impossible original publication date',value=>{value.jobs[0].first_published='2026-02-30T12:00:00-04:00'}],
])test('current native programme holds '+name,async()=>{
 await assert.rejects(replay((packet,url)=>{if(url===API)editBody(packet,raw=>{const value=JSON.parse(raw);change(value);return JSON.stringify(value)})}),error=>error.code==='HUNTRESS_PROGRAMME_HOLD')
})
test('current corporate programme rejects changed hiring conditions',async()=>{
 await assert.rejects(replay((packet,url)=>{if(url===CORPORATE)editBody(packet,raw=>raw.replace('</body>','<p>All positions require residence in India.</p></body>'))}),error=>error.code==='HUNTRESS_PROGRAMME_HOLD')
})
test('current native programme rejects a filtered scope despite matching employer and rows',async()=>{
 await assert.rejects(replay((packet,url)=>{if(url===BOARD)editBody(packet,raw=>raw.replace('"departmentIds":[]','"departmentIds":[4137176003]'))}),error=>error.code==='HUNTRESS_PROGRAMME_HOLD')
})
test('current native board rejects mismatched reviewed security and programme deployments',async()=>{
 await assert.rejects(replay((packet,url)=>{if(url===BOARD)packet.headers['content-security-policy']=historical.responses[1].headers['content-security-policy']}),error=>error.code==='HUNTRESS_PROGRAMME_HOLD'&&/coherent native security\/programme/.test(error.message))
})
test('current programme rejects closing full-criteria drift',async()=>{
 await assert.rejects(replay((packet,url,visit)=>{if(url===API&&visit===2)editBody(packet,raw=>{const value=JSON.parse(raw);value.jobs[0].content+='&lt;p&gt;An additional certification is required.&lt;/p&gt;';return JSON.stringify(value)})}),error=>error.code==='HUNTRESS_PROGRAMME_HOLD'&&/Closing whole native API/.test(error.message))
})
