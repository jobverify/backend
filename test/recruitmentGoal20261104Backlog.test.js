import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {qualifyNativeWspRole,PUBLIC_ROLE_FIELDS,PUBLIC_DESCRIPTION_FIELDS,readWspResponse} from '../scraper/wspindia/nativeDetails.js'
import {extractJobsFromHtml,hasOfficialIndiaSiteSignal} from '../scraper/wspindia/script.js'
import {extractActiveDescription} from '../scraper-support/utils/activeNativeHtml.js'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run as mintifiRun} from '../scraper/mintifi/script.js'
import {run as waymoRun} from '../scraper/waymo/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const payload=JSON.parse(fs.readFileSync(new URL('../scraper/wspindia/fixtures/detail-97196.json',import.meta.url)))
const listing=extractJobsFromHtml(fs.readFileSync(new URL('../scraper/wspindia/fixtures/jobs-current-page-1.html',import.meta.url),'utf8'))[0]
const clock='2026-11-05T00:00:00Z'
const read=edit=>{
  const changed=structuredClone(payload)
  edit?.(changed.items[0])
  return qualifyNativeWspRole(listing,changed,clock)
}
const followup=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/native-backlog-followup.json.gz',import.meta.url))))
const offlineNative=(context,source,edit=()=>{})=>{
  const capture=followup.sources.find(row=>row.source===source),pending=new Map()
  for(const row of capture.requests){const rows=pending.get(row.requestedURL)||[];rows.push(structuredClone(row));pending.set(row.requestedURL,rows)}
  context.mock.method(globalThis,'fetch',async(url,init={})=>{
    assert.equal(init.method||'GET','GET')
    const rows=pending.get(String(url))
    assert.ok(rows?.length,'Uncaptured public native request: '+url)
    const row=rows.shift();edit(row)
    const response=new Response(row.text,{status:row.status,headers:row.headers})
    Object.defineProperty(response,'url',{value:row.finalURL})
    return response
  })
  return{capture,pending}
}

test('backlog follow-up preserves all 15 original Mintifi and Waymo public responses',()=>{
  assert.equal(followup.sources.reduce((n,row)=>n+row.requests.length,0),15)
  for(const source of followup.sources)for(const row of source.requests){
    assert.equal(row.replayed,false)
    assert.equal(createHash('sha256').update(row.text).digest('hex'),row.bodySHA256)
  }
})

test('Mintifi current native contract preserves every India placement and the exact complete model',async context=>{
  const {capture,pending}=offlineNative(context,'mintifi')
  const jobs=await mintifiRun({now:()=>capture.completedAt})
  assert.equal(jobs.length,1)
  const job=jobs[0]
  assert.equal(job.country,'India')
  assert.equal(job.locations.length,3)
  for(const place of job.nativeSourceRecord.jobLocations)assert.ok(job.location.includes(place.name))
  assert.equal(job.city,null)
  assert.equal(job.requisitionId,null)
  assert.equal(job.jobId,'167293')
  assert.equal(job.nativeHiringOrganization.name,'Mintifi')
  assert.equal(job.postingDate,job.nativeSourceRecord.publishedOn)
  assert.equal(job.sourceDescription,job.nativeSourceRecord.description)
  assert.ok(extractActiveDescription(job.sourceDescription).length>1000)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.applicationVisited,false)
  assert.equal(job.applyUrl,job.sourceUrl)
  assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].nativeRecords,1)
  assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].nativeInventoryReads[0].kind,'keka')
  assert.equal([...pending.values()].reduce((n,rows)=>n+rows.length,0),0)
})

for(const kind of ['foreign','conflicting','unknown'])test('Mintifi cannot turn '+kind+' native country metadata into an India job',async context=>{
  const {capture}=offlineNative(context,'mintifi',row=>{
    if(!row.requestedURL.includes('/api/embedjobs/default/active/'))return
    const data=JSON.parse(row.text)
    for(const job of data)for(const place of job.jobLocations){
      place.countryCode=kind==='unknown'?'ZZ':'US'
      place.countryName=kind==='foreign'?'United States':'India'
    }
    row.text=JSON.stringify(data)
  })
  const jobs=await mintifiRun({now:()=>capture.completedAt})
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.ok(jobs[Symbol.for('jobverify.verified-recruitment-observations')])
})

test('Mintifi requires the real current account identity and refuses future publication dates',async context=>{
  for(const kind of ['employer','future']){
    const {capture}=offlineNative(context,'mintifi',row=>{
      if(kind==='employer'&&row.requestedURL.includes('/api/organization/')){
        const data=JSON.parse(row.text);data.name='Unrelated organization';row.text=JSON.stringify(data)
      }
      if(kind==='future'&&row.requestedURL.includes('/api/embedjobs/default/active/')){
        const data=JSON.parse(row.text);data[0].publishedOn='2030-01-01T00:00:00Z';row.text=JSON.stringify(data)
      }
    })
    await assert.rejects(mintifiRun({now:()=>capture.completedAt}),/inventory|future|native/i)
  }
})

test('Mintifi zero result limit preserves an incomplete inventory and cannot establish verified empty',async context=>{
  const {capture}=offlineNative(context,'mintifi')
  const jobs=await mintifiRun({maxJobs:0,now:()=>capture.completedAt})
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('the current Waymo 202 responses remain unresolved even when opening roles have full descriptions',async context=>{
  const {capture,pending}=offlineNative(context,'waymo')
  const jobs=await waymoRun({now:()=>capture.completedAt})
  assert.equal(jobs.length,3)
  assert.ok(jobs.every(job=>job.country==='India'&&job.nativeRoleClosingReconciled===false&&job.sourceDetailComplete===false
    &&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false&&job.activeApplyVerified===false))
  assert.equal(jobs.nativeCollectionEvidence.individuallyReconciledRoles,0)
  assert.equal(jobs.nativeCollectionEvidence.heldNativeRows.length,4)
  assert.equal(jobs.nativeCollectionEvidence.openingClosingReconciled,false)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  const skipped=[...pending.values()].flat()
  assert.equal(skipped.length,1,'The closing read remains unrequested after the interruption')
  assert.equal(skipped[0].requestedURL,jobs.nativeCollectionEvidence.retainedResponses[0].url)
  assert.equal(skipped[0].status,202)
})

test('WSP retains all public native criteria and original dates with exact own employer and country evidence',()=>{
  const job=read(),detail=payload.items[0]
  assert.equal(job.country,'India')
  assert.equal(job.nativeHiringOrganization.name,'WSP')
  assert.equal(job.nativeEmployerBinding.legalEmployer,null)
  assert.deepEqual(job.nativeSourceRecord.detail,detail)
  assert.deepEqual(job.nativeSourceRecord.listing,listing)
  const full=PUBLIC_DESCRIPTION_FIELDS.map(field=>detail[field]).filter(value=>value?.trim()).join('\n')
  assert.equal(job.sourceDescription,extractActiveDescription(full))
  assert.equal(job.postingDate,new Date(detail.ExternalPostedStartDate).toISOString())
  assert.equal(job.sourcePostedDateRaw,detail.ExternalPostedStartDate)
  assert.equal(job.sourceDatePrecision,'second')
  assert.equal(job.firstEverPublication,null)
  assert.equal(job.companyDomain,'wsp.com')
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.applicationVisited,false)
})

test('WSP internal description fields cannot enter the public criteria',()=>{
  const before=read()
  const job=read(detail=>{
    detail.InternalResponsibilitiesStr='<p>Invented internal employee requirement</p>'
    detail.InternalQualificationsStr='<p>Invented internal application instruction</p>'
  })
  assert.equal(job.sourceDescription,before.sourceDescription)
  assert.equal(job.nativeDescriptionSHA256,before.nativeDescriptionSHA256)
  assert.ok(!job.sourceDescription.includes('Invented internal'))
  assert.ok(job.nativeSourceRecord.detail.InternalResponsibilitiesStr.includes('Invented internal'))
})

test('WSP company boilerplate and internal criteria cannot replace missing or hidden public role criteria',()=>{
  for(const hidden of [false,true])assert.throws(()=>read(detail=>{
    for(const field of PUBLIC_ROLE_FIELDS)detail[field]=hidden?'<div hidden>'+detail[field]+'</div>':null
    detail.InternalResponsibilitiesStr=payload.items[0].ExternalDescriptionStr
  }),error=>error.code==='WSP_NATIVE_CONTENT_MISSING')
})

for(const [label,change]of[
  ['different native ID',detail=>detail.Id='99999'],
  ['malformed native ID',detail=>detail.Id=[listing.jobId]],
  ['different title',detail=>detail.Title='Unrelated role'],
  ['foreign primary country',detail=>detail.PrimaryLocationCountry='US'],
  ['missing primary country',detail=>delete detail.PrimaryLocationCountry],
  ['unrecognized primary country',detail=>detail.PrimaryLocationCountry='Bengaluru'],
  ['different legal employer',detail=>detail.LegalEmployer='Unrelated staffing business'],
  ['foreign additional country',detail=>detail.secondaryLocations=[{CountryCode:'US'}]],
  ['future publication',detail=>detail.ExternalPostedStartDate='2030-01-01T12:00:00Z'],
  ['impossible date',detail=>detail.ExternalPostedStartDate='2026-02-30T12:00:00Z'],
  ['expired role',detail=>detail.ExternalPostedEndDate='2026-10-01T12:00:00Z'],
])test('WSP refuses '+label,()=>assert.throws(()=>read(change)))

test('WSP preserves time and offset rather than replacing a source date with observation time',()=>{
  const job=read(detail=>detail.ExternalPostedStartDate='2026-10-08T00:15:12+05:30')
  assert.equal(job.postingDate,'2026-10-07T18:45:12.000Z')
  assert.equal(job.sourcePostedDateRaw,'2026-10-08T00:15:12+05:30')
})

test('WSP quoted and hidden company paragraphs cannot establish the role employer',()=>{
  for(const wrapper of [html=>'<blockquote>'+html+'</blockquote>',html=>'<div><blockquote>'+html+'</blockquote></div>',
    html=>'<div hidden>'+html+'</div>']){
    assert.throws(()=>read(detail=>{
      detail.CorporateDescriptionStr=wrapper(detail.CorporateDescriptionStr)
      detail.OrganizationDescriptionStr=null
      detail.ExternalDescriptionStr='<p>Deliver engineering project plans and drawings, check models, and work with the project team to meet every technical design and delivery requirement.</p>'
      detail.ExternalResponsibilitiesStr=null
      detail.ExternalQualificationsStr=null
    }),/employer statement missing/)
  }
})

test('WSP inactive source cards and corporate handoffs cannot qualify public jobs',()=>{
  const page=fs.readFileSync(new URL('../scraper/wspindia/fixtures/jobs-current-page-1.html',import.meta.url),'utf8')
  assert.equal(extractJobsFromHtml('<template>'+page+'</template>').length,0)
  assert.equal(extractJobsFromHtml('<div hidden>'+page+'</div>').length,0)
  assert.equal(hasOfficialIndiaSiteSignal('<template>WSP Search and apply<a href="https://www.wsp.com/en-gl/careers/job-opportunities?country=IN">Jobs</a></template>'),false)
})

test('WSP native transport requires the original response URL, public JSON type and a cancellable GET',async context=>{
  const url='https://emit.fa.ca3.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
  const requests=[]
  context.mock.method(globalThis,'fetch',async(target,init)=>{
    requests.push({target,init})
    const response=new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}})
    Object.defineProperty(response,'url',{value:url})
    return response
  })
  assert.deepEqual(await readWspResponse(url,{json:true}),payload)
  assert.equal(requests[0].init.redirect,'manual')
  assert.equal(requests[0].init.credentials,'omit')
  assert.ok(requests[0].init.signal instanceof AbortSignal)
  context.mock.method(globalThis,'fetch',async()=>{
    const response=new Response('{}',{headers:{'content-type':'text/html'}})
    Object.defineProperty(response,'url',{value:url})
    return response
  })
  await assert.rejects(readWspResponse(url,{json:true}),/not JSON/)
})
