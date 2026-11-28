import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {recruitmentIndiaFacet} from '../../scraper-support/utils/verifiedRecruitment.js'

const HOME='https://lexisnexisrisk.com/en-us'
const CAREERS=HOME+'/about-us/careers'
const SOURCE='lexisnexisrisksolutions'
const fixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/currentSurface20261128.json.gz',import.meta.url))))
const sha=x=>createHash('sha256').update(x).digest('hex')
const key=(url,method,body)=>[method||'GET',url,body||''].join('\n')
const detail=row=>row.method==='GET'&&row.requestedUrl.includes('/wday/cxs/')&&row.requestedUrl.includes('/job/')

function transport(packets,mutate=()=>{}){
  const rows=structuredClone(packets);mutate(rows)
  const groups=new Map(),calls=[]
  for(const row of rows){
    const identity=key(row.requestedUrl,row.method,row.requestBody)
    if(!groups.has(identity))groups.set(identity,[])
    groups.get(identity).push(row)
  }
  const fetchImpl=async(url,options={})=>{
    const identity=key(String(url),options.method,options.body),group=groups.get(identity)
    assert.ok(group?.length,'Network tripwire: unexpected or excess request '+identity)
    const row=group.shift();calls.push({url:String(url),method:options.method||'GET',requestBody:options.body})
    const response=new Response(row.body,{status:row.status,headers:row.headers})
    Object.defineProperty(response,'url',{value:row.url||row.requestedUrl})
    return response
  }
  return {fetchImpl,calls,remaining:()=>[...groups.values()].reduce((sum,rows)=>sum+rows.length,0)}
}

async function attempt(mutate=()=>{}){
  const f=fixture(),mock=transport([...f.originalRedirectPackets,...f.candidatePackets],mutate)
  // This compatibility replay deliberately retains the captured unfiltered
  // protocol. Separate controls below exercise the wrapper's default priority.
  const jobs=await run({preferIndiaInventory:false,fetchImpl:mock.fetchImpl,now:()=>f.observedAt})
  return {jobs,mock,fixture:f}
}

function held(jobs){
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'coverage-gap')
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  for(const job of jobs){
    assert.equal(job.source,SOURCE)
    assert.equal(job.sourceScopeComplete,false)
    assert.equal(job.sourceListingComplete,false)
    assert.equal(job.lifecycleCleanupAllowed,false)
  }
}

function changeDetail(rows,predicate,change){
  let changed=0
  for(const row of rows){
    if(!detail(row))continue
    const value=JSON.parse(row.body)
    if(predicate(value,row)){change(value,row);row.body=JSON.stringify(value);changed++}
  }
  assert.ok(changed>0,'Synthetic control must touch a genuine captured native detail')
}

test('genuine migration fixture binds old redirects and separately observed current source models',()=>{
  const f=fixture()
  assert.equal(f.originalRedirectPackets.length,2)
  assert.equal(f.candidatePackets.length,30)
  assert.equal(f.candidateObservedJobs.length,9)
  assert.equal(f.provenance.candidateRegisteredSourceRun,false)
  for(const row of [...f.originalRedirectPackets,...f.candidatePackets])assert.equal(sha(row.body),row.sha256)
  assert.equal(f.originalRedirectPackets[0].requestedUrl,'https://risk.lexisnexis.com/')
  assert.equal(f.originalRedirectPackets[0].url,HOME)
  assert.equal(f.originalRedirectPackets[1].url,CAREERS)
})

test('explicit unfiltered source follows the qualified current domain and retains nine genuine India roles',async()=>{
  const {jobs,mock,fixture:f}=await attempt()
  assert.equal(jobs.length,9)
  assert.deepEqual(jobs.map(row=>row.link).sort(),f.candidateObservedJobs.map(row=>row.link).sort())
  assert.deepEqual(mock.calls.map(row=>row.url),f.candidatePackets.map(row=>row.requestedUrl))
  assert.equal(mock.calls[0].url,HOME)
  assert.equal(mock.calls[1].url,CAREERS)
  assert.ok(jobs.every(row=>row.country==='India'&&row.sourceDetailComplete===true))
  assert.ok(jobs.every(row=>row.nativeHiringOrganization?.name==='RELX India (Pvt) Ltd Risk div Company'))
  assert.deepEqual(jobs.map(row=>row.nativeHiringOrganization),f.candidateObservedJobs.map(row=>row.nativeHiringOrganization))
  held(jobs)
})

test('migration does not admit other RELX employers or replace native labels',async()=>{
  const {jobs,fixture:f}=await attempt(rows=>changeDetail(rows,()=>true,value=>{
    value.hiringOrganization={...(value.hiringOrganization||{}),name:'Other RELX business'}
  }))
  assert.equal(jobs.length,0)
  assert.equal(f.originalConfig.nativeEmployerNames.length,1)
  held(jobs)
})

test('missing native employer leaves no authoritative empty inventory after migration',async()=>{
  const {jobs}=await attempt(rows=>changeDetail(rows,()=>true,value=>{delete value.hiringOrganization}))
  assert.equal(jobs.length,0)
  held(jobs)
})

test('explicit foreign native countries remain excluded without a false India zero',async()=>{
  const {jobs}=await attempt(rows=>changeDetail(rows,()=>true,value=>{
    value.jobPostingInfo.country={descriptor:'United States of America'}
    if(value.jobPostingInfo.jobRequisitionLocation)value.jobPostingInfo.jobRequisitionLocation.country={descriptor:'United States of America'}
  }))
  assert.equal(jobs.length,0)
  held(jobs)
})

test('native description loss is not repaired by the company domain migration',async()=>{
  const {jobs}=await attempt(rows=>changeDetail(rows,()=>true,value=>{value.jobPostingInfo.jobDescription=''}))
  assert.equal(jobs.length,0)
  held(jobs)
})

test('expired native roles remain excluded without a complete-zero claim',async()=>{
  const {jobs}=await attempt(rows=>changeDetail(rows,()=>true,value=>{value.jobPostingInfo.endDate='2000-01-01'}))
  assert.equal(jobs.length,0)
  held(jobs)
})

test('future authority-changing current redirects still fail closed',async()=>{
  await assert.rejects(attempt(rows=>{
    for(const row of rows)if(row.requestedUrl===HOME||row.requestedUrl===CAREERS)row.url='https://unrelated.example/careers'
  }),/redirect changed authority|inventory is unavailable/i)
})

test('public denials at both current official surfaces stay terminal',async()=>{
  await assert.rejects(attempt(rows=>{
    for(const row of rows)if(row.requestedUrl===HOME||row.requestedUrl===CAREERS){row.status=403;row.body='<html><h1>Access denied</h1></html>'}
  }),/403|denied|inventory is unavailable/i)
})

for(const [name,options,syntheticSupportedFacet,preferIndia] of [
  ['default with supported selector',{},true,true],
  ['explicit false with supported selector',{preferIndiaInventory:false},true,false],
  ['explicit true with supported selector',{preferIndiaInventory:true},true,true],
  ['default with genuine currently unqualified publisher selector',{},false,false],
])test(name+' retains the existing native India priority and explicit caller override',async()=>{
  const f=fixture()
  const firstIndex=f.candidatePackets.findIndex(row=>row.method==='POST'&&row.requestedUrl.endsWith('/jobs'))
  assert.ok(firstIndex>0)
  const first=f.candidatePackets[firstIndex],model=JSON.parse(first.body)
  const country=model.facets.find(row=>row.facetParameter==='Country___Territory')
  const india=country.values.find(row=>row.descriptor==='India')
  assert.equal(india.id,'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(recruitmentIndiaFacet(model),null)
  const selector='synthetic-qualified-india-country-control'
  const listingCalls=[],reads=[]
  const fetchImpl=async(url,init)=>{
    reads.push(String(url))
    if(String(url)===first.requestedUrl&&init.method==='POST'){
      listingCalls.push(JSON.parse(init.body))
      if(listingCalls.length===2)return Object.defineProperty(new Response('Synthetic dispatch boundary',{status:403}),'url',{value:String(url)})
    }
    const original=f.candidatePackets.find(row=>row.requestedUrl===String(url)&&(row.method||'GET')===(init.method||'GET'))
    assert.ok(original,'Dispatch control cannot fetch outside the genuine public graph: '+url)
    const row=structuredClone(original)
    if(syntheticSupportedFacet&&String(url)===first.requestedUrl&&init.method==='POST'){
      // A synthetic supported selector demonstrates the wrapper contract. The
      // genuine current Country___Territory facet above remains unqualified.
      const value=JSON.parse(row.body)
      value.facets.push({facetParameter:'locationCountry',descriptor:'Location Country',
        values:[{descriptor:'India',id:selector,count:9}]})
      row.body=JSON.stringify(value)
    }
    return Object.defineProperty(new Response(row.body,{status:row.status,headers:row.headers}),'url',{value:row.url||String(url)})
  }
  try{await run({...options,fetchImpl,now:()=>f.observedAt})}
  catch(error){assert.match(error.message,/403|denied|inventory is unavailable/i)}
  assert.deepEqual(reads.slice(0,firstIndex+1),f.candidatePackets.slice(0,firstIndex+1).map(row=>row.requestedUrl))
  assert.equal(listingCalls.length,2)
  assert.deepEqual(listingCalls[0],JSON.parse(first.requestBody))
  assert.deepEqual(listingCalls[1].appliedFacets,preferIndia?{locationCountry:[selector]}:{})
  assert.equal(listingCalls[1].offset,preferIndia?0:20)
  assert.equal(listingCalls[1].searchText,'')
})
