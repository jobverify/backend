import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {createZohoNativeInventoryScraper} from '../../scraper-support/utils/zohoNativeInventory.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=source=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/current-native-20261107.json.gz',import.meta.url)))).packets
async function execute(t,source,change=p=>p,direct=false){
 const packets=fixture(source),calls=[],counts=new Map(),fetchImpl=async(url,init={})=>{
  const p=packets.find(p=>p.url===url||p.responseUrl===url);assert.ok(p,'Captured public URL only '+url)
  const count=(counts.get(url)||0)+1;counts.set(url,count);calls.push(url)
  const q=change({...p,url,body:Buffer.from(p.bodyBase64,'base64'),count})
  const response=new Response(q.body,{status:q.status,headers:{'content-type':q.contentType}});Object.defineProperty(response,'url',{value:q.responseUrl||url});return response
 }
 const mock=t.mock.method(globalThis,'fetch',fetchImpl)
 try{
  const config=source==='wissentechnology'?{source,company:'Wissen Technology',companyDomain:'wissen.com',boardUrl:'https://careers.wissen.com/jobs/Careers',orgId:'80238000000244522',pageId:'80238000000244670',nativeCompany:'Wissen Technology Pvt. Ltd.'}:{source:'uniqus',company:'Uniqus',companyDomain:'uniqus.com',
   boardUrl:'https://uniqusus.zohorecruit.com/jobs/Careers-at-Uniqus',pageName:'Careers-at-Uniqus',officialUrl:'https://uniqus.com/careers/',
   orgId:'717173000000454128',pageId:'717173000003530045',nativeCompany:'Uniqus Consultech Inc'}
  const jobs=direct?await createZohoNativeInventoryScraper(config).run({fetchPage:async url=>{const r=await fetchImpl(url);return{status:r.status,url:r.url,html:await r.text()}},fetchJson:async url=>(await fetchImpl(url)).json()}):
   await createCatalogScraper(getScraperCatalog().find(p=>p.source===source)).run({fetchImpl})
  return{jobs,calls}
 }finally{mock.mock.restore()}
}
test('Zoho custom published page name remains exact across native metadata, API and canonical role URLs',async t=>{
 const {jobs,calls}=await execute(t,'uniqus',p=>p,true);assert.equal(jobs.length,23)
 assert.ok(calls.some(url=>url.includes('pagename=Careers-at-Uniqus')));assert.ok(jobs.every(j=>j.country==='India'&&j.applyUrl.includes('/Careers-at-Uniqus/')))
})
for(const [source,count]of [['uniqus',23],['wissentechnology',49]])test('registered '+source+' returns current native full India roles with original dates and explicit incomplete company scope',async t=>{
 const {jobs}=await execute(t,source);assert.equal(jobs.length,count)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.postingDate&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(j=>j.sourceNativeDetailRecord?.Job_Description))
})
test('custom native API page name cannot be substituted by the default Careers page',async t=>{
 await assert.rejects(execute(t,'uniqus',p=>p.url.includes('/Job_Openings?')?{...p,body:Buffer.from(p.body.toString().replace('"page_name":"Careers-at-Uniqus"','"page_name":"Careers"'))}:p,true),/page|inventory|identity/)
})
test('existing Zoho consumers keep strict listing/detail State comparison unless explicitly opted in',async t=>{
 await assert.rejects(execute(t,'wissentechnology',p=>p,true),/State changed/)
})
test('Wissen native inventory order may change while every complete record and all employer metadata remain identical',async t=>{
 const{jobs}=await execute(t,'wissentechnology',p=>{
  if(!p.url.includes('/Job_Openings?')||p.count!==3)return p
  const model=JSON.parse(p.body);model.data.reverse();return{...p,body:Buffer.from(JSON.stringify(model))}
 });assert.equal(jobs.length,49)
})
test('sorting a current native inventory never hides a changed closing record',async t=>{
 await assert.rejects(execute(t,'wissentechnology',p=>{
  if(!p.url.includes('/Job_Openings?')||p.count!==3)return p
  const model=JSON.parse(p.body);model.data.reverse();model.data[0].Posting_Title+=' changed';return{...p,body:Buffer.from(JSON.stringify(model))}
 }),/closing|changed/)
})
test('Uniqus closing full criteria drift cannot certify the earlier native description',async t=>{
 await assert.rejects(execute(t,'uniqus',p=>p.url.includes('/Job_Openings/717173000000687059?')&&p.count===2?{...p,body:Buffer.from(p.body.toString().replace('Consultant','Changed closing role'))}:p),/closing|changed|identity/)
})
test('current Wissen handoff bytes cannot silently change to a different native tenant',async t=>{
 await assert.rejects(execute(t,'wissentechnology',p=>p.url.includes('/career/opportunities-')?{...p,body:Buffer.from(p.body.toString().replace('site:"https://wissen.zohorecruit.in"','site:"https://foreign.zohorecruit.in"'))}:p),/handoff|binding|embed|program/)
})
test('registered current Uniqus access denial throws an incomplete result and stops the denied native origin',async t=>{
 let denied=0,after=0
 await assert.rejects(execute(t,'uniqus',p=>{
  if(denied&&p.url.startsWith('https://uniqusus.zohorecruit.com'))after++
  if(p.url.includes('/Job_Openings?')){denied++;return{...p,status:403,contentType:'text/html',body:Buffer.from('Forbidden')}}return p
 }),e=>e.status===403&&e.failureKind==='blocked_or_access_denied')
 assert.equal(denied,1);assert.equal(after,0)
})
test('Scaleflex retains three current native observations without claiming an India zero from absent countries and staffing employer proof',async t=>{
 const {jobs}=await execute(t,'scaleflex');assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,3)
})

test('Wissen detail may add an absent State only while country, city, identity and full criteria still agree',async t=>{
 for(const [field,value]of [['Country',''],['Country','United States'],['City','Different City'],['Posting_Title','Different Role'],['id','999999999999999999'],['Job_Description','']]){
  await assert.rejects(execute(t,'wissentechnology',p=>{
   if(!p.url.includes('/Job_Openings/'))return p
   const valueModel=JSON.parse(p.body);valueModel.data[0][field]=value
   return{...p,body:Buffer.from(JSON.stringify(valueModel))}
  }),/changed|identity|ambiguous|description|invalid/)
 }
 await assert.rejects(execute(t,'wissentechnology',p=>{
  if(!p.url.includes('/Job_Openings?'))return p
  const model=JSON.parse(p.body);model.data[0].State='Different State'
  return{...p,body:Buffer.from(JSON.stringify(model))}
 }),/State|changed/)
})
