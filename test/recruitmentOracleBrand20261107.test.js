import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/recruitmentOracle20261107/hilton-current.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='hilton')
const ids=['221401','225311','227080']
const nativeDetails=new Map(packets.filter(row=>row.requestUrl.includes('recruitingCEJobRequisitionDetails'))
 .map(row=>{const detail=JSON.parse(row.body).items[0];return [detail.Id,detail]}))
const descriptionFields=['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr','CorporateDescriptionStr','OrganizationDescriptionStr']
const replay=async(t,{detailChange,rowChange,providerChange,registered=true}={})=>{
 const byURL=new Map(packets.map(row=>[row.requestUrl,row]))
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  assert.equal(init.method||'GET','GET')
  const row=byURL.get(String(input));assert.ok(row,'Uncaptured public request refused: '+input)
  let body=row.body
  if(row.contentType?.includes('json')){
   const payload=JSON.parse(body)
   if(String(input).includes('recruitingCEJobRequisitionDetails')&&detailChange)for(const detail of payload.items)detailChange(detail)
   if(String(input).includes('recruitingCEJobRequisitions?')&&rowChange)for(const detail of payload.items[0].requisitionList)rowChange(detail)
   body=JSON.stringify(payload)
  }
  const response=new Response(body,{status:row.status,headers:{'content-type':row.contentType}})
  Object.defineProperty(response,'url',{value:row.url})
  return response
 })
 const scraper=registered&&!providerChange?createCatalogScraper(provider):createVerifiedRecruitmentScraper({...provider,...providerChange})
 return scraper.run({now:()=> '2026-11-07T00:00:00.000Z'})
}

test('registered Hilton replays only native role-owned workplace declarations and complete public criteria',async t=>{
 assert.equal(provider.requireNativeEmployerName,true)
 const jobs=await replay(t)
 assert.deepEqual(jobs.map(job=>job.jobId),ids)
 for(const job of jobs){
  const detail=nativeDetails.get(job.jobId)
  assert.equal(job.country,'India')
  assert.equal(job.nativeHiringOrganization.name,'Hilton')
  assert.equal(job.nativeLegalEmployer,null)
  assert.equal(job.nativeSourceRecord.detail.LegalEmployer,null)
  assert.equal(job.nativeEmployerBinding.method,'explicit-native-role-corporate-workplace-declaration')
  assert.equal(job.nativeEmployerBinding.field,'CorporateDescriptionStr')
  assert.equal(job.nativeEmployerBinding.legalEmployer,null)
  assert.equal(job.sourceDescription,descriptionFields.map(field=>detail[field]).filter(value=>typeof value==='string'&&value.trim()).join('\n'))
  assert.equal(job.nativeSourceRecord.detail.CorporateDescriptionStr,detail.CorporateDescriptionStr)
  assert.equal(job.nativeSourceRecord.detail.ExternalDescriptionStr,detail.ExternalDescriptionStr)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-employer-mismatch'))
})

for(const [label,change] of [
 ['a missing own workplace declaration',detail=>{detail.CorporateDescriptionStr=''}],
 ['a quoted workplace declaration',detail=>{detail.CorporateDescriptionStr='<blockquote>'+detail.CorporateDescriptionStr+'</blockquote>'}],
 ['a hidden workplace declaration',detail=>{detail.CorporateDescriptionStr='<div hidden>'+detail.CorporateDescriptionStr+'</div>'}],
 ['an inert workplace declaration',detail=>{detail.CorporateDescriptionStr='<template>'+detail.CorporateDescriptionStr+'</template>'}],
 ['a code sample',detail=>{detail.CorporateDescriptionStr='<pre>'+detail.CorporateDescriptionStr+'</pre>'}],
 ['unrelated copied marketing',detail=>{detail.CorporateDescriptionStr='<p>A marketing case study from another company follows.</p>'+detail.CorporateDescriptionStr}],
 ['a corporate declaration copied into the role duties',detail=>{detail.ExternalDescriptionStr+='\n'+detail.CorporateDescriptionStr;detail.CorporateDescriptionStr=''}],
 ['generic company marketing',detail=>{detail.CorporateDescriptionStr='<p>Hilton is a leading global hospitality company.</p>'}],
 ['a franchise employer',detail=>{detail.ExternalDescriptionStr+='<p>You will be employed by an independent franchise owner and not by Hilton.</p>'}],
 ['a franchise role without employer keywords',detail=>{detail.ExternalDescriptionStr+='<p>This position is with an independently owned and operated franchise hotel.</p>'}],
 ['independent ownership of the advertised property',detail=>{detail.ExternalDescriptionStr+='<p>This property is independently owned and operated by a separate owner.</p>'}],
 ['an independently operated hotel employer',detail=>{detail.ExternalDescriptionStr+='<p>This hotel is independently owned and operated. Employment is with the franchise owner.</p>'}],
 ['an explicit Hilton employment denial',detail=>{detail.ExternalDescriptionStr+='<p>Hilton will not be your employer for this position.</p>'}],
 ['a conflicting native legal employer',detail=>{detail.LegalEmployer='Other Company'}],
 ['corporate content without full role criteria',detail=>{detail.ExternalDescriptionStr='Apply now';detail.ExternalResponsibilitiesStr='';detail.ExternalQualificationsStr=''}],
])test('protected Hilton admission retains the gap for '+label,async t=>{
 const jobs=await replay(t,{detailChange:change})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].sourceScopeComplete,false)
})

test('a reviewed brand declaration cannot invent a typed India work country',async t=>{
 const jobs=await replay(t,{detailChange:detail=>{detail.PrimaryLocationCountry=null;detail.secondaryLocations=[];detail.workLocation=[]},
  rowChange:row=>{row.PrimaryLocationCountry=null;row.secondaryLocations=[]}})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})

test('the exact workplace contract remains required for protected brand admission',async t=>{
 const jobs=await replay(t,{providerChange:{nativeOracleBrandEmployerDeclaration:null}})
 assert.equal(jobs.length,0)
})

