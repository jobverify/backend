import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./currentRegistrationOriginals20261120.json.gz',import.meta.url))))
for(const r of fixture.responses)assert.equal(createHash('sha256').update(Buffer.from(r.bodyBase64,'base64')).digest('hex'),r.sha256)
const next='https://edxn.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_5001,limit=20,offset=0,keyword=India'
async function retained(t,change=()=>{},runner=run){
 const calls=[],unretained=[]
 t.mock.method(globalThis,'fetch',async(input)=>{
  const url=String(input);calls.push(url);const row=fixture.responses.find(r=>r.requestedURL===url)
  if(!row){unretained.push(url);throw new Error('OFFLINE_UNRETAINED_NATIVE_AUTHORITY')}
  const r={...row,body:Buffer.from(row.bodyBase64,'base64').toString('utf8')};change(r)
  return Object.defineProperty(new Response(r.body,{status:r.status,headers:{'content-type':r.contentType}}),'url',{value:r.finalURL})
 })
 let error;try{await runner()}catch(e){error=e}
 return{calls,unretained,error}
}
test('genuine retained corporate handoff and current BXP native publisher reach exact next native authority',async t=>{
 const r=await retained(t);assert.deepEqual(r.calls,fixture.responses.map(r=>r.requestedURL).concat(next));assert.deepEqual(r.unretained,[next]);assert.ok(r.error);assert.match(JSON.stringify(r.error.recruitmentObservations??r.error.observations??{}),/OFFLINE_UNRETAINED_NATIVE_AUTHORITY/)
})
export {fixture,next,retained}

const replaced=(r,old,value)=>{assert.ok(r.body.includes(old),'Negative control matches retained literal carrier');r.body=r.body.replaceAll(old,value)}
for(const[label,change]of[
 ['missing active corporate handoff',r=>{if(r.requestedURL===fixture.responses[0].requestedURL)replaced(r,fixture.responses[1].requestedURL,'')}],
 ['corporate brand identity mismatch',r=>{if(r.requestedURL===fixture.responses[0].requestedURL)replaced(r,'BXP','Unrelated Publisher')}],
 ['foreign native publisher',r=>{if(r.requestedURL===fixture.responses[1].requestedURL)replaced(r,'Careers | BXP','Careers | Different Company')}],
 ['cross-tenant final redirect',r=>{if(r.requestedURL===fixture.responses[1].requestedURL)r.finalURL=r.finalURL.replace('edxn.','foreign.')}],
 ['native site-number disagreement',r=>{if(r.requestedURL===fixture.responses[1].requestedURL)replaced(r,'data-sitenumber="CX_5001"','data-sitenumber="CX_9999"')}],
 ['native API origin disagreement',r=>{if(r.requestedURL===fixture.responses[1].requestedURL)replaced(r,'https://edxn.fa.us2.oraclecloud.com:443','https://foreign.example')}],
])test('BXP brand registration retains rejection for '+label,async t=>{
 const r=await retained(t,change);assert.deepEqual(r.unretained,[]);assert.equal(r.calls.includes(next),false);assert.ok(r.error)
})

test('registered catalog default reaches the identical current native authority without a donated job',async t=>{
 const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
 const provider=getScraperCatalog().find(p=>p.source==='bostonproperties')
 assert.ok(provider)
 const r=await retained(t,()=>{},()=>createCatalogScraper(provider).run())
 assert.ok(r.error);assert.ok(r.calls.includes(next));assert.ok(r.unretained.every(url=>url===next))
})
