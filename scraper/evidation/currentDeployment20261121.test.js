import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-deployment-20261121.json.gz',import.meta.url))))
const FRAME='https://ats.rippling.com/embed/evidation/jobs?s=https%3A%2F%2Fevidation.com%2Fopen-positions',CLIENT='https://ats.us1.rippling.com/_next/static/chunks/387-77dfce139cfbd362.js',PROOF=Symbol.for('jobverify.official-ats-discovery')
async function replay(t,change=()=>{},options={}){
 const calls=[],counts=new Map()
 t.mock.method(globalThis,'fetch',async url=>{
  const original=fixture.packets.find(p=>p.requestedURL===url);assert.ok(original,'Only current explicitly advertised retained request: '+url)
  const visit=(counts.get(url)??0)+1;counts.set(url,visit);assert.ok(visit<=2,'Bounded original opening/closing protocol')
  const p=structuredClone(original);change(p,url,visit);calls.push(url)
  const response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 })
 return {jobs:await run({now:()=>fixture.capturedAt,...options}),calls}
}
const editBody=(p,change)=>{const before=Buffer.from(p.bodyBase64,'base64').toString('utf8'),after=change(before);assert.notEqual(after,before,'Actually changes original current bytes');p.bodyBase64=Buffer.from(after).toString('base64')}
const editNext=(p,change)=>editBody(p,body=>body.replace(/(<script\b[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,start,raw,end)=>{const n=JSON.parse(raw);change(n);return start+JSON.stringify(n).replaceAll('<','\\u003c')+end}))
const query=n=>n.props.pageProps.dehydratedState.queries.find(q=>q.queryKey?.[2]==='job-posts')

test('current exact Evidation locale-aware deployment reconciles three complete foreign roles with inventory holds',async t=>{
 for(const p of fixture.packets)assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.sha256)
 const {jobs,calls}=await replay(t);assert.equal(jobs.length,0);assert.equal(calls.length,16)
 assert.equal(calls.filter(url=>url===CLIENT).length,2);assert.equal(calls.filter(url=>url.startsWith('https://ats.rippling.com/en-US/evidation/jobs/')).length,6)
 assert.deepEqual(jobs[PROOF].nativeInventory,{observedNativeRows:3,observedUniqueRoles:3,observedIndiaRoles:0,snapshots:2,pagesPerSnapshot:2,allDetailsValidated:true})
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.lifecycleCleanupAllowed,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
})

test('changed current declared pagination bytes cannot qualify original native observations',async t=>{
 await assert.rejects(replay(t,(p,url)=>{if(url===CLIENT)editBody(p,body=>body+'\n/* changed current programme */')}),/pagination client contract changed/)
})
for(const [name,change]of[
 ['foreign cache-key locale',n=>{query(n).queryKey[5]='fr-FR'}],
 ['missing new language dimension',n=>{query(n).queryKey.pop()}],
 ['an extra unreviewed dimension',n=>{query(n).queryKey.push(true)}],
 ['a nonempty country filter',n=>{query(n).queryKey[4].country='IN'}],
 ['a failed native query',n=>{query(n).state.status='error'}],
])test('current Evidation still rejects '+name,async t=>{
 await assert.rejects(replay(t,(p,url)=>{if(url.startsWith(FRAME))editNext(p,change)}),/native listing query filtered or failed/)
})

test('current locale-bearing query cannot borrow the historical client declaration',async t=>{
 await assert.rejects(replay(t,(p,url)=>{if(url.startsWith(FRAME))editBody(p,body=>body.replace(CLIENT,'https://ats.us1.rippling.com/_next/static/chunks/387-80356090a770fa21.js'))}),/native listing query filtered or failed/)
})

test('current original country conflict remains held before any native role can qualify',async t=>{
 await assert.rejects(replay(t,(p,url)=>{if(url===FRAME)editBody(p,body=>body.replace('"countryCode":"US"','"countryCode":"IN"'))}),/native country\/geography missing or contradictory/)
})

test('current full native role criteria remain mandatory',async t=>{
 await assert.rejects(replay(t,(p,url)=>{if(url.includes('/en-US/evidation/jobs/'))editNext(p,n=>{n.props.pageProps.apiData.jobPost.description.role=''})}),/full employer description\/content missing/)
})

test('current closing additional mandatory native question cannot hide behind stable role identity',async t=>{
 await assert.rejects(replay(t,(p,url,visit)=>{if(visit===2&&url.includes('/en-US/evidation/jobs/'))editNext(p,n=>{n.props.pageProps.apiData.jobPost.activeJobApplication.basicQuestions.push({oid:'unreviewed_native_requirement',required:true,label:'Additional certification required'})})}),/native corporate\/listing\/full detail content changed during closing reconciliation/)
})

test('explicit caller cancellation keeps its exact reason in current Evidation deployment',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'current-evidation-regression'});controller.abort(reason);await assert.rejects(run({signal:controller.signal}),error=>error===reason)
})