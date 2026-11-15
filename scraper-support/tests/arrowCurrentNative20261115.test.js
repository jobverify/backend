import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from '../../scraper/arrowelectronics.workday/script.js'
import {readNativeDocument} from '../utils/activeNativeHtml.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/arrowelectronics.workday/fixtures/native-20261115.json.gz',import.meta.url))))
const renderers=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/arrowelectronics.workday/fixtures/renderer-clients-20261115.json.gz',import.meta.url))))
const roleId='R248308'
const rewriteRole=(html,change)=>{
 const marker=/\bphApp\.ddo\s*=\s*/.exec(html);assert.ok(marker)
 const start=html.indexOf('{',marker.index+marker[0].length);let end=start,depth=0,quote=false
 for(;end<html.length;end++){const c=html[end];if(quote){if(c==='\\')end++;else if(c==='"')quote=false}else if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){end++;break}}
 const raw=html.slice(start,end),value=JSON.parse(raw);change(value.jobDetail.data.job)
 return html.slice(0,start)+JSON.stringify(value)+html.slice(end)
}
const rewritePosting=(html,change)=>{
 const node=readNativeDocument(html).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0];assert.ok(node)
 const value=JSON.parse(node.raw);change(value);return html.replace(node.raw,JSON.stringify(value))
}
const fixtureFetch=(fixture,change=()=>{})=>{
 const requests=[],detailReads=new Map();let widgetReads=0
 return {requests,fetchImpl:async(url,init={})=>{
  const from=init.method==='POST'?JSON.parse(init.body).from:null,id=String(url).split('/job/')[1]?.split('/')[0]
  const count=id?(detailReads.get(id)||0)+1:0;if(id)detailReads.set(id,count)
  const widgetRead=init.method==='POST'?++widgetReads:widgetReads
  const client=renderers[url],html=client?.html??(init.method==='POST'?(widgetRead>2&&from===0?fixture.closingFirstWidgetPage:fixture.openingWidgetPages[from/500]):id?fixture.details.find(d=>d.id===id)?.html:fixture.searchHTML)
  if(html==null)throw Error('Missing real native fixture '+url)
  const context={url,init,from,id,count,widgetRead,html,requests};requests.push(context)
  const value=change(context)??html,response=new Response(value,{status:200,headers:client?.headers})
  Object.defineProperty(response,'url',{value:url});return response
 }}
}
test('registered Arrow publishes only full own roles with independent closing proof despite native tie-order changes',async()=>{
 const transport=fixtureFetch(original),jobs=await run({...transport,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,34)
 assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.failures.length===0&&j.country==='India'&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,535)
 assert.equal(jobs.nativeCollectionEvidence.heldRecords.filter(r=>/missing-description/.test(r.reason)).length,5)
 assert.ok(jobs.every(j=>j.sourceNativeClosingContext.eachFullRoleRechecked===true))
 const firstClosing=transport.requests.findIndex(r=>r.id&&r.count===2),lastOpening=transport.requests.findLastIndex(r=>r.id&&r.count===1)
 assert.ok(firstClosing>lastOpening)
 assert.equal(transport.requests.filter(r=>r.init.method==='POST').length,4)
})
test('an unrelated closing native role cannot certify the opening role or its full criteria',async()=>{
 const t=fixtureFetch(original,({id,count,html})=>id===roleId&&count===2?html.replaceAll(roleId,'R999999'):undefined)
 const jobs=await run({...t,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,33);assert.ok(!jobs.some(j=>j.jobId===roleId))
 assert.ok(jobs.nativeCollectionEvidence.heldRecords.some(r=>r.id===roleId&&r.phase==='closing-detail'))
})
test('a closing duplicate cannot be pruned into complete or zero inventory',async()=>{
 const t=fixtureFetch(original,({from,widgetRead,html})=>{
  if(from!==500||widgetRead<=2)return
  const p=JSON.parse(html),first=JSON.parse(original.openingWidgetPages[0]).refineSearch.data.jobs[0]
  p.refineSearch.data.jobs[0]=first;return JSON.stringify(p)
 })
 await assert.rejects(run({...t,now:'2026-11-15T06:30:00Z'}),/closing.*(?:duplicate|identity|pagination)/)
})
for(const [name,mutate,reason]of[
 ['different native employer',html=>rewriteRole(html,d=>{d.companyName='Unrelated employer'}),/employer/],
 ['foreign typed primary country',html=>rewriteRole(html,d=>{d.country='United States'}),/country/],
 ['different native role identity',html=>rewriteRole(html,d=>{d.reqId='R999999'}),/identity/],
 ['different native application account',html=>rewriteRole(html,d=>{d.applyUrl=d.applyUrl.replace('arrow.wd1.myworkdayjobs.com','unrelated.invalid')}),/application/],
 ['explicitly closed own role',html=>rewriteRole(html,d=>{d.status='CLOSED'}),/closed|lifecycle/],
 ['expired own deadline',html=>rewritePosting(html,p=>{p.validThrough='2026-11-14T23:59:59Z'}),/deadline/],
 ['inconsistent full schema criteria',html=>rewritePosting(html,p=>{assert.match(p.description,/5-8 Years/);p.description=p.description.replace('5-8 Years','2-3 Years')}),/authored criteria/],
])test('Arrow withholds '+name+' and retains all native raw observations',async()=>{
 const t=fixtureFetch(original,({id,html})=>id===roleId?mutate(html):undefined),jobs=await run({...t,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,33);assert.ok(!jobs.some(j=>j.jobId===roleId))
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,535)
 assert.match(jobs.nativeCollectionEvidence.heldRecords.find(r=>r.id===roleId).reason,reason)
})
test('Arrow holds a closing full criteria change even when both own closing models agree',async()=>{
 const t=fixtureFetch(original,({id,count,html})=>id===roleId&&count===2?rewritePosting(rewriteRole(html,d=>{d.description=d.description.replace('5-8 Years','2-3 Years')}),p=>{p.description=p.description.replace('5-8 Years','2-3 Years')}):undefined)
 const jobs=await run({...t,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,33);assert.ok(!jobs.some(j=>j.jobId===roleId))
 assert.match(jobs.nativeCollectionEvidence.heldRecords.find(r=>r.id===roleId).reason,/closing full native role/)
})
test('Arrow holds a closing own membership change without borrowing another global role',async()=>{
 const t=fixtureFetch(original,({from,widgetRead,html})=>{
  if(from!==0||widgetRead<=2)return
  const value=JSON.parse(html);value.refineSearch.data.jobs.find(r=>r.reqId===roleId).title+=' changed';return JSON.stringify(value)
 }),jobs=await run({...t,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,33);assert.ok(!jobs.some(j=>j.jobId===roleId))
 assert.equal(jobs.nativeCollectionEvidence.nativeMembershipUnchanged,false)
 assert.ok(jobs.nativeCollectionEvidence.heldRecords.some(r=>r.id===roleId&&r.phase==='closing-membership'))
})
for(const notice of ['This position has been filled.','This job is not available.','This position is currently unavailable.'])
for(const closingOnly of [false,true])test('Arrow holds an active role notice '+(closingOnly?'in the independent closing page: ':'despite unchanged native models: ')+notice,async()=>{
 const t=fixtureFetch(original,({id,count,html})=>id===roleId&&(!closingOnly||count===2)?html.replace(/<body\b[^>]*>/i,tag=>tag+'<p>'+notice+'</p>'):undefined)
 const jobs=await run({...t,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,33);assert.ok(!jobs.some(j=>j.jobId===roleId))
 assert.match(jobs.nativeCollectionEvidence.heldRecords.find(r=>r.id===roleId).reason,/visible.*(?:closed|closure|filled)/)
})
for(const notice of ['This position has been filled.','This job is not available.','This position is currently unavailable.'])
test('Arrow does not treat stylesheet-hidden expired-state fallback as a current visible closure: '+notice,async()=>{
 const t=fixtureFetch(original,({id,html})=>id===roleId?html.replace('</head>','<style>.job-expired-view.hide{display:none!important}</style></head>')
  .replace(/(<div\b[^>]*ph-page-state="expired"[^>]*>)/i,'$1<p>'+notice+'</p>'):undefined)
 const jobs=await run({...t,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,34);assert.ok(jobs.some(j=>j.jobId===roleId))
})

for(const notice of ['<p hidden>This job is not available.</p>','<template><p>This position is currently unavailable.</p></template>'])
test('Arrow retains the current own role when unavailable prose is inactive: '+notice,async()=>{
 const t=fixtureFetch(original,({id,html})=>id===roleId?html.replace(/<body\b[^>]*>/i,tag=>tag+notice):undefined)
 const jobs=await run({...t,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,34);assert.ok(jobs.some(j=>j.jobId===roleId))
})
test('an inert declared renderer cannot authorize the native preboot body mask',async()=>{
 const t=fixtureFetch(original,({id,html})=>id===roleId?html.replace(/<script\b[^>]*\bid="phwRunnerJs"[^>]*><\/script>/i,tag=>'<template>'+tag+'</template>'):undefined)
 const jobs=await run({...t,now:'2026-11-15T06:30:00Z'})
 assert.equal(jobs.length,33);assert.ok(!jobs.some(j=>j.jobId===roleId))
})
test('a changed final native renderer cannot certify any opening role visibility',async()=>{
 const t=fixtureFetch(original,({url,html,requests})=>renderers[url]&&requests.filter(r=>r.url===url).length===2?html+';/* changed */':undefined)
 await assert.rejects(run({...t,now:'2026-11-15T06:30:00Z'}),/renderer.*(?:identity|body).*changed/)
})
