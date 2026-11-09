import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import test from 'node:test'
import {run, CAREERS_URL, PEOPLESTRONG_URLINFO_API_URL, fetchSobhaJobDetail} from '../../scraper/sobha/script.js'
import {resolveJobPublicationDate} from '../../src/utils/jobPublicationDate.js'

const read = name => {const bytes=fs.readFileSync(new URL(`./fixtures/sobha/${name}`,import.meta.url));return(name.endsWith('.gz')?zlib.gunzipSync(bytes):bytes).toString()}
const captured = name => {const value=JSON.parse(read(name+'.json'));return{...value,payload:JSON.parse(value.body)}}
const ids=['MPR-GMW-000185','MPR-GMW-000184','MPR-GMW-000179']
const records=()=>captured('listing').payload.response.filter(row=>ids.includes(row.jobCode))
const info=()=>captured('urlinfo').payload
const native=(id)=>({detail:captured(id+'-detail'),organization:captured(id+'-organization')})
const execute=(options={})=>run({
  fetchText:async url=>read(url===CAREERS_URL?'careers.html.gz':'portal.html'),
  fetchJson:async url=>url===PEOPLESTRONG_URLINFO_API_URL?info():{
    ...captured('listing').payload,response:records(),totalRecords:3,
  },
  fetchJobDetail:async job=>native(job.jobId),
  now:()=> '2026-10-29T18:10:00.000Z',
  ...options,
})

test('Sobha recovers three actual native role bodies with bound India, formal IDs and original lifecycle dates',async()=>{
  const jobs=await execute()
  assert.equal(jobs.length,3)
  for(const [index,expected]of [
    {id:'MPR-GMW-000185',requisitionId:'1903909',title:'Senior Quality Auditor',posted:'2026-10-24',closing:'2026-12-01',phrase:'Conduct quality audits and inspections of façade glazing'},
    {id:'MPR-GMW-000184',requisitionId:'1903915',title:'Quality Auditor Glazing',posted:'2026-10-24',closing:'2026-11-30',phrase:'Lead and oversee quality control and assurance activities'},
    {id:'MPR-GMW-000179',requisitionId:'1835243',title:'Façade structural design',posted:'2026-10-06',closing:'2026-10-31',phrase:'Perform structural analysis and design of facade systems'},
  ].entries()){
    const job=jobs[index]
    assert.equal(job.jobId,expected.id)
    assert.equal(job.title,expected.title)
    assert.equal(job.requisitionId,expected.requisitionId)
    assert.ok(job.sourceDescription.includes(expected.phrase))
    assert.equal(job.jobDescription,job.sourceDescription)
    assert.equal(job.jobDescriptionHtml,native(expected.id).detail.payload.response.jobDescription)
    assert.equal(job.postingDate,expected.posted+'T00:00:00.000Z')
    assert.equal(job.postedAt,expected.posted+'T00:00:00.000Z')
    assert.equal(job.postedAtProvenance,'source')
    assert.equal(resolveJobPublicationDate(job).provenance,'source')
    assert.equal(job.closingDate,expected.closing)
    assert.equal(job.sourceDateEvidence,'sobha-peoplestrong-native-detail-listing-v1')
    assert.equal(job.sourceNativeRealm,1368)
    assert.equal(job.sourceCountryEvidence.country,'India')
    assert.equal(job.sourceCountryEvidence.worksiteID,'1705061')
    assert.equal(job.sourceDetailComplete,true)
  }
})

test('Sobha details reject substituted role, employer, India location, formal IDs, dates and redirects',async()=>{
  const mutations=[
    value=>{value.detail.payload.response.requisitionCode='MPR-GMW-000184'},
    value=>{value.detail.payload.response.jobTitle='Another title'},
    value=>{value.detail.payload.response.requisitionId='invalid'},
    value=>{value.detail.payload.response.organizationUnitComplete='Other employer>GMW-Quality'},
    value=>{value.detail.payload.response.locationHierarchyComplete='Germany>Bavaria>Munich'},
    value=>{value.detail.payload.response.CandidatePortalStartDate='2026-10-25 00:00:00.0'},
    value=>{value.detail.url='https://unrelated.example/job/MPR-GMW-000185'},
    value=>{value.detail.status=404},
    value=>{value.detail.payload.messageCode.code=403},
    value=>{value.organization.payload.response.orgUnitHierarchy.find(row=>row.orgUnitType==='Company').orgUnitName='Other employer'},
    value=>{value.organization.payload.response.workSiteHierarchy.find(row=>row.orgUnitType==='Country').orgUnitName='Germany'},
    value=>{value.organization.url=value.organization.url.replace('000185','000184')},
  ]
  for(const mutate of mutations){
    const jobs=await execute({fetchJobDetail:async job=>{const result=native(job.jobId);if(job.jobId===ids[0])mutate(result);return result}})
    assert.equal(jobs[0].sourceDescription,undefined)
    assert.equal(jobs[0].jobDescription,null)
    assert.equal(jobs[0].sourceDetailComplete,false)
    assert.ok(jobs[1].sourceDescription,'A failed role must not discard another validated role')
  }
})

test('Sobha keeps genuine content for an older closed role and excludes private or inactive text',async()=>{
  const jobs=await execute({fetchJobDetail:async job=>{
    const result=native(job.jobId)
    result.detail.payload.response.internalJobDescription='PRIVATE INTERNAL CONTENT'
    result.detail.payload.response.jobDescription+='<template>INERT TEXT</template><p hidden>HIDDEN TEXT</p>'
    if(job.jobId===ids[2])result.detail.payload.response.requisitionStatus='CLOSED'
    return result
  }})
  assert.equal(jobs[2].postingDate,'2026-10-06T00:00:00.000Z')
  assert.equal(jobs[2].nativeRequisitionStatus,'CLOSED')
  assert.match(jobs[2].sourceDescription,/Required Qualifications/)
  assert.ok(jobs.every(job=>!/PRIVATE INTERNAL CONTENT|INERT TEXT|HIDDEN TEXT/.test(job.sourceDescription)))
})

test('Sobha default HTTP detail reader recovers captured public responses using exact anonymous GETs',async()=>{
  const requests=[]
  const jobs=await execute({fetchJobDetail:async(job,options)=>fetchSobhaJobDetail(job,{...options,
    fetchImpl:async(url,init)=>{
      requests.push({url,method:init.method,body:init.body})
      assert.ok(init.signal instanceof AbortSignal)
      const found=[captured(job.jobId+'-detail'),captured(job.jobId+'-organization')].find(value=>value.url===url)
      assert.ok(found,'Only captured native detail endpoints may be used')
      const response=new Response(found.body,{status:found.status,headers:{'content-type':'application/json'}})
      Object.defineProperty(response,'url',{value:found.url})
      return response
    },
  })})
  assert.ok(jobs.every(job=>job.sourceDescription&&job.sourceDetailComplete===true))
  assert.deepEqual(requests.map(request=>request.url).sort(),ids.flatMap(id=>[
    captured(id+'-detail').url,captured(id+'-organization').url,
  ]).sort())
  assert.ok(requests.every(request=>request.method==='GET'&&request.body===undefined))
})

test('Sobha default HTTP reader cancels a stalled public request', {timeout:2000},async()=>{
  let fallback
  try{
    await assert.rejects(fetchSobhaJobDetail({jobId:ids[0],sourceUrl:'https://sobhalimited-careers.peoplestrong.com/job/detail/MPR-GMW-000185'},
      {timeoutMs:20,fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>{
        fallback=setTimeout(()=>resolve(null),1000)
        signal.addEventListener('abort',()=>reject(signal.reason),{once:true})
      })}),error=>error.name==='TimeoutError')
  }finally{clearTimeout(fallback)}
})

test('Sobha uses the formal slash code for organization requests while detail routes use the advertised underscore code',async()=>{
  const native=JSON.parse(read('SOL_QAD_1833775-native.json'))
  const listing=captured('listing').payload.response.find(row=>row.jobCode==='SOL/QAD/1833775')
  const [job]=await execute({fetchJson:async url=>url===PEOPLESTRONG_URLINFO_API_URL?info():{
    ...captured('listing').payload,response:[listing],totalRecords:1,
  },fetchJobDetail:async()=>native})
  assert.ok(job.sourceDescription)
  assert.equal(job.requisitionId,'1833775')
  assert.equal(job.sourceCountryEvidence.country,'India')
})

test('Sobha verifies exact tenant realm and aborts details without fallback requests',async()=>{
  for(const realm of [1,1369])await assert.rejects(execute({fetchJson:async()=>({response:{...info().response,realm}})}),/identity/i)
  const controller=new AbortController(),reason=new Error('stop Sobha details')
  await assert.rejects(execute({signal:controller.signal,fetchJobDetail:async()=>{controller.abort(reason);throw reason}}),error=>error===reason)
  const jobs=await execute({detailEnrichmentBudgetMs:0,fetchJobDetail:async()=>assert.fail('No detail read with zero budget')})
  assert.ok(jobs.every(job=>!job.sourceDescription&&job.sourceDetailComplete===false))
})
