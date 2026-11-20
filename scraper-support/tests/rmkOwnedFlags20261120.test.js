import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {document} from '../shared/rmkNativePairHtml.js'
for(const config of [
 {dir:'payu',module:'currentPublished20261119',listing:'readPayUListing',role:'readPayURole',count:3},
 {dir:'paccar.workday',module:'currentPublication20261119',listing:'readPaccarListing',role:'readPaccarRole',count:24},
 {dir:'teradyne.workday',module:'currentPublication20261119',listing:'readTeradyneListing',role:'readTeradyneRole',count:7},
]){
 const m=await import('../../scraper/'+config.dir+'/'+config.module+'.js'),entry=await import('../../scraper/'+config.dir+'/script.js'),f=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/'+config.dir+'/fixtures/current-publication-20261119.json.gz',import.meta.url)))),text=r=>Buffer.from(r.bodyBase64,'base64').toString(),packet=f.responses.find(r=>r.requestedUrl.includes(config.dir==='payu'?'/PayU/go/':'/search/')),first=m[config.listing](text(packet),packet.requestedUrl).rows.find(r=>config.dir!=='teradyne.workday'||r.nativeBrand==='Teradyne'&&r.countryCode==='IN'),html=text(f.responses.find(r=>r.requestedUrl===first.sourceUrl))
 test(config.dir+' explicit typed publication flags and native employer metadata override an otherwise open role',()=>{
  const d=document(html),owner=d.nodes(n=>n.attrs.itemtype?.endsWith('/JobPosting'))[0]
  for(const [key,value]of [['postingStatus','Draft'],['published','false'],['active','false']])assert.throws(()=>m[config.role](html.slice(0,owner.closeStart)+'<meta itemprop="'+key+'" content="'+value+'">'+html.slice(owner.closeStart),first,f.observedAt),key)
  assert.throws(()=>m[config.role](html,{...first,nativeAttributes:{...first.nativeAttributes,'data-employer':'Other Company'}},f.observedAt))
 })
 test(config.dir+' an explicitly unpublished, closed, expired or different-employer row stays held while healthy publications survive',async()=>{
  for(const [key,value]of [['data-is-published','false'],['data-is-closed','true'],['data-is-expired','true'],['data-employer','Other Company']]){
   const counts=new Map(),jobs=await entry.run({now:()=>f.observedAt,requestIntervalMs:0,...config.dir==='payu'?{maxRoleDetails:3}:{},fetchImpl:async(url)=>{
    const n=counts.get(url)||0;counts.set(url,n+1);const originals=f.responses.filter(r=>r.requestedUrl===url),p=originals[n]??originals[0];assert.ok(p,'Only declared fixture requests '+url);let body=text(p)
    if(url.includes(config.dir==='payu'?'/PayU/go/':'/search/')){const d=document(body),row=d.nodes(n=>n.tag==='tr'&&d.hasClass(n,'data-row')).find(n=>d.nodes(a=>a.tag==='a'&&a.attrs.href&&new URL(a.attrs.href,url).href===first.sourceUrl,n).length);if(row)body=body.slice(0,row.openEnd-1)+' '+key+'="'+value+'"'+body.slice(row.openEnd-1)}
    return Object.defineProperty(new Response(Buffer.from(body),{status:p.status,headers:p.headers}),'url',{value:p.url})
   }})
   assert.equal(jobs.length,config.count-1,key);assert.ok(!jobs.some(j=>j.jobId===first.jobId),key)
  }
 })
}
