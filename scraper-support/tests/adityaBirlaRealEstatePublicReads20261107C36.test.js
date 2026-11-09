import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {setTimeout as schedule, clearTimeout as unschedule} from 'node:timers'
import test from 'node:test'
import * as realestate from '../../scraper/adityabirlarealestate.workday/script.js'
import {buildScrapers, createCatalogScraper, getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence, isVerifiedEmptyEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const HOME = 'https://www.adityabirlarealestate.com/career'
const CORPORATE = 'https://www.adityabirlarealestate.com/'
const folder = new URL('./fixtures/adityaBirlaRealEstatePublicReads20261107C36/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder)))
const receipt = manifest.records[0]
const bytes = gunzipSync(fs.readFileSync(new URL('0001.body.gz', folder)))
const latest = JSON.parse(fs.readFileSync(new URL('collector-initial/manifest.json', folder)))
const entity = (record, body) => ({url:record.finalUrl, finalUrl:record.finalUrl, requestedUrl:record.requestedUrl,
  status:record.status, headers:structuredClone(record.headers), contentType:record.contentType,
  bodyBase64:body.toString('base64'), html:body.toString('utf8'), bytes:record.bytes, sha256:record.sha256,
  sourceRequestedAt:record.sourceRequestedAt, sourceCompletedAt:record.sourceCompletedAt,
  sourceHttpDate:record.sourceHttpDate, originalReceipt:structuredClone(record)})
const original = () => entity(receipt, bytes)
const savedPage = url => {
  if (url === HOME) return original()
  assert.equal(url, CORPORATE, 'Only the two genuine configured legacy documents may be replayed')
  return entity(latest.records[1], gunzipSync(fs.readFileSync(new URL('collector-initial/0002.body.gz', folder))))
}
const provider = getScraperCatalog().find(row => row.source === 'adityabirlarealestate')
const catalog = () => createCatalogScraper(provider)
const now = () => '2026-11-07T04:00:00.000Z'
const never = () => new Promise(() => {})
const digest = value => createHash('sha256').update(value).digest('hex')
const watchdog = async pending => {
  let timer
  try {return await Promise.race([pending, new Promise((_, reject) => {timer=schedule(() => reject(Error('Test watchdog exceeded')), 1000)})])}
  finally {unschedule(timer)}
}
const rejected = async pending => {
  try {await watchdog(pending)} catch (error) {return {rejected:true, error}}
  return {rejected:false}
}
const incomplete = jobs => {
  assert.equal(jobs.length, 0)
  const inventory=readInventoryEvidence(jobs), audit=jobs.nativeCollectionEvidence
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.verifiedAt, null)
  assert.equal(isVerifiedEmptyEvidence(inventory), false)
  for(const key of ['companyGlobalTotal','companyIndiaTotal','nativeReportedTotal','nativeIndiaTotal','inventoryVerifiedAt'])assert.equal(audit[key], null)
  for(const key of ['sourceScopeComplete','sourceListingComplete','sourceDetailComplete','lifecycleCleanupAllowed',
    'redirectsFollowed','corporateJavaScriptExecuted','subresourcesRequested','applicationInteractionPerformed'])assert.equal(audit[key], false)
  return audit
}
// Only the unmodified gzip/manifest pairs are genuine acquired evidence.
// Every constructed or mutated entity below is a synthetic boundary control.
const pageHTML = content => '<!doctype html><html><head><title>Careers at ABREL - Join Our Team of Innovators</title></head>'
  + '<body><h1>Empower your career journey with ABREL</h1>' + content
  + '<footer><h4>Aditya Birla Real Estate Limited (formerly Century Textiles and Industries Limited)</h4><p>Mumbai, India</p></footer></body></html>'
const roleHTML = (title='Synthetic Engineer, Synthetic Division', id='synthetic1') => '<div class="accordion-item">'
  + '<h2 class="accordion-header">' + title + '<br><span>Mumbai</span><button type="button" data-bs-target="#' + id + '" aria-controls="' + id + '"></button></h2>'
  + '<div id="' + id + '" class="accordion-collapse collapse" data-bs-parent="#accordionExample"><div class="accordion-body">'
  + '<h6>Job Description</h6><ul><li>Explicitly synthetic criteria: develop reliable engineering systems, review operational performance, and collaborate with the team on maintenance planning.</li></ul>'
  + '<a href="javascript:void(0)" onclick="throw new Error(\'never execute publisher handlers\')">Apply Now</a></div></div></div>'
const sectionHTML = content => '<section class="Job-openings-section"><div class="Job-openings-accordion">'
  + '<div class="heading-select"><h4>Job openings</h4><div class="custom-dropdown"><div class="dropdown-btn">Divisions</div>'
  + '<ul class="dropdown-options"><li data-value="Synthetic Division">Synthetic Division</li></ul></div></div>'
  + '<div class="accordion" id="accordionExample">' + content + '</div></div></section>'
const synthetic = (html=pageHTML(sectionHTML(roleHTML())), extra={}) => ({url:HOME, finalUrl:HOME, requestedUrl:HOME,
  status:200, headers:{'content-type':'text/html; charset=utf-8'},bodyBase64:Buffer.from(html).toString('base64'),
  sourceRequestedAt:'2026-11-07T00:00:00.000Z',sourceCompletedAt:'2026-11-07T00:00:00.001Z',
  syntheticBoundaryEntity:true,...extra})

test('genuine actual default retains three scoped published role contexts as partial observations', async () => {
  const calls = []
  const jobs = await catalog().run({now, fetchPage:async (url, init) => {calls.push({url, init}); return savedPage(url)}})
  assert.deepEqual(calls.map(row => row.url), [HOME])
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(calls[0].init.redirect, 'manual')
  assert.equal(calls[0].init.credentials, 'omit')
  assert.equal(jobs.length, 0)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(isVerifiedEmptyEvidence(inventory), false)
  const audit = jobs.nativeCollectionEvidence
  assert.deepEqual(audit.observations.map(row => [row.title, row.publishedLocation, row.publishedDivision]), [
    ['Head - Engineering, Century Pulp & Paper', 'Lalkuan, Uttarakhand', 'Century Pulp & Paper'],
    ['Head - Production, Planning & Control, Century Pulp & Paper', 'Lalkuan, Uttarakhand', 'Century Pulp & Paper'],
    ['Finance & Accounts - Team Member, Head Office', 'Mumbai', 'Head Office'],
  ])
  assert.deepEqual(readSourceObservationEvidence(jobs, 'adityabirlarealestate'), {
    source:'adityabirlarealestate', recordKind:'vacancy-rows', observedRecordCount:3, observedVacancyCount:3,
    sourceScopeComplete:false, companyGlobalTotal:null, companyIndiaTotal:null,
  })
})

test('genuine replay preserves complete scoped criteria while every role stays unqualified for eligibility', async () => {
  const audits=[], metadata=[], records=[]
  const jobs=await realestate.run({now,fetchPage:async()=>original(),onAudit:value=>audits.push(value),
    onMetadata:value=>metadata.push(value),onRecords:value=>records.push(value)})
  const audit=incomplete(jobs)
  const expected=[[
    'Plan for robust proactive maintenance practices and create systems for efficient operations of maintenance team to maximize plant uptime',
    'Lead & use the budgeting process, explore all cost saving opportunities and manage money invested in inventories to reduce the cost of maintenance',
    'Create maintenance processes & systems and explore new technologies & processes to continuously improve upon operational efficiencies',
    'Monitor power consumption and lead initiatives to reduce same to achieve the target energy savings',
    'Do detailed engineering planning for and monitor implementation of CAPEX projects to assist in timely completion',
    'Ensure all Statutory Compliances and compliance with internal systems and processes',
    'Drive periodic safety reviews and oversee plans and capability building to drive a culture of safety in the function as measured by reduction in safety incidents',
    'Work with the HR team to ensure availability & upgradation of talent & skills to ensure smooth operations and achieve the manpower productivity for the function',
  ],[
    'Prepare monthly and daily production plan aligned with the customer requirement to achieve the target OTIF for the business.',
    'Plan for capacity enhancements & changes with the production team to align future production capacities with the market need.',
    'Review daily production and dispatch plan and align the logistics team for dispatch of produced material.',
    'Maximize plant capacity utilization while minimizing product change overs to optimize production cost.',
    'Collaborate with sales & production team to minimize left over stocks and liquidate left over stocks in warehouse on time.',
    'Explore and bring in new practices, IT systems and create policies for efficient working of the department.',
    'Develop and build capability of team to ensure efficient & effective operations and meet current and future needs of the organization.',
  ],[
    'Preparation of Advance Tax Working, Tax Audit, Income Tax Returns and Other statutory forms.',
    'Co-ordination with various divisions and tracking changes in taxation laws and regulations.',
    'Timely payment of Advance Taxes, correctly filing IT returns for various entities, Quarterly TDS returns, generation of TDS certificates and completion of other IT related procedures.',
    'Prepare and assist in preparation of standalone and consolidated financial statements.',
    'Providing support to accounts and finance team during quarter and year-end closing.',
    'Responding to Auditors, IT department notices, queries from assessing officers and others.',
  ]]
  assert.deepEqual(audit.observations.map(row=>row.criteriaItems),expected)
  for(const [index,row] of audit.observations.entries()){
    assert.equal(row.criteriaText,'Job Description '+expected[index].join(' '))
    assert.equal(row.kind,'published-role-context')
    assert.equal(row.vacancy,true)
    assert.equal(row.qualification,'partial')
    assert.equal(row.documentUrl,HOME)
    for(const key of ['country','legalEmployer','typedLegalEmployer'])assert.equal(row[key],null)
    for(const key of ['typedCountryPresent','criteriaVisibilityQualified','sourceDetailComplete','sourceListingComplete',
      'sourceScopeComplete','eligibilityQualified','lifecycleCleanupAllowed','applicationInteractionPerformed'])assert.equal(row[key],false)
  }
  assert.deepEqual(records,[[]])
  assert.equal(audits.length,1)
  for(const key of ['verifiedAt','verifiedOn','verifiedPublicJobCount','verifiedIndiaJobCount'])assert.equal(metadata[0][key],null)
  assert.equal(metadata[0].runtimeInventoryVerification,false)
  assert.equal(metadata[0].lifecycleCleanupAllowed,false)
  const row=audit.responses[0]
  assert.equal(bytes.length,58844)
  assert.equal(digest(bytes),'274c4d271fae67acbfefc6e77b59c92b92ef8782fa932b120c89ccabef280bdb')
  assert.equal(row.bytes,58844)
  assert.equal(row.sha256,receipt.sha256)
  assert.equal(row.status,200)
  assert.equal(row.finalUrl,HOME)
  assert.deepEqual(row.headers,receipt.headers)
  assert.equal(row.bodyBase64,bytes.toString('base64'))
  assert.equal(row.sourceRequestedAt,'2026-11-07T02:46:44.776Z')
  assert.equal(row.sourceCompletedAt,'2026-11-07T02:46:55.841Z')
  assert.equal(row.sourceHttpDate,'Sat, 07 Nov 2026 02:47:19 GMT')
  assert.equal(row.observedRequestedAt,'2026-11-07T04:00:00.000Z')
  assert.deepEqual(audit.rawPages[0].originalReceipt,receipt)
  assert.equal(row.transportQualified,true)
})

test('genuine latest collector career entity retains its own independent bytes and clocks',async()=>{
  const record=latest.records[0],body=gunzipSync(fs.readFileSync(new URL('collector-initial/0001.body.gz',folder)))
  const audit=incomplete(await catalog().run({now,fetchPage:async()=>entity(record,body)}))
  assert.equal(audit.observations.length,3)
  assert.equal(audit.responses[0].sha256,'2c41e984030493db10cff9907bb4021737ae0b57687049a91a4abc8498cc72e2')
  assert.equal(audit.responses[0].sourceRequestedAt,'2026-11-07T03:43:08.619Z')
  assert.equal(audit.responses[0].sourceCompletedAt,'2026-11-07T03:43:18.924Z')
})

test('actual buildScrapers binding retains partial evidence despite historical catalog zero fields',async()=>{
  const route=buildScrapers().find(row=>row.name==='adityabirlarealestate')
  const audit=incomplete(await route.run({now,fetchPage:async url=>{assert.equal(url,HOME);return original()}}))
  assert.equal(audit.observations.length,3)
  assert.equal(audit.sourceMetadata.verifiedPublicJobCount,null)
  assert.equal(audit.sourceMetadata.verifiedIndiaJobCount,null)
})

test('composed acquisition retains fetchPage originals before decoded or native compatibility transports',async()=>{
  const audit=incomplete(await catalog().run({now,fetchPage:async()=>original(),
    fetchImpl:()=>assert.fail('native transport replaced original page'),fetchText:()=>assert.fail('decoded transport replaced original page')}))
  assert.equal(audit.responses[0].sourceRequestedAt,receipt.sourceRequestedAt)
  assert.equal(audit.responses[0].sha256,receipt.sha256)
})

test('native fetchImpl stream retains the exact anonymous GET entity',async()=>{
  const audit=incomplete(await catalog().run({now,fetchImpl:async(url,init)=>{
    assert.equal(url,HOME);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
    assert.equal(init.signal instanceof AbortSignal,true)
    const response=new Response(bytes,{status:200,headers:receipt.headers})
    Object.defineProperty(response,'url',{value:HOME})
    return response
  }}))
  assert.equal(audit.responses[0].sha256,receipt.sha256)
  assert.equal(audit.responses[0].bodyBase64,bytes.toString('base64'))
  assert.equal(audit.responses[0].sourceRequestedAt,'2026-11-07T04:00:00.000Z')
  assert.equal(audit.responses[0].sourceCompletedAt,'2026-11-07T04:00:00.000Z')
  assert.equal(audit.observations.length,3)
})

test('default native transport uses the configured GET when supplied a saved local response',async()=>{
  const previous=globalThis.fetch
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,HOME);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
    const response=new Response(bytes,{status:200,headers:receipt.headers})
    Object.defineProperty(response,'url',{value:HOME});return response
  }
  try{assert.equal(incomplete(await catalog().run({now})).responses[0].sha256,receipt.sha256)}
  finally{globalThis.fetch=previous}
})

test('decoded-only compatibility cannot qualify original acquisition or role observations',async()=>{
  const jobs=await catalog().run({now,fetchText:async url=>{assert.equal(url,HOME);return bytes.toString('utf8')}})
  const audit=incomplete(jobs)
  assert.equal(audit.observations.length,0)
  assert.equal(readInventoryEvidence(jobs).firstParty,false)
  assert.equal(audit.responses[0].bodyComplete,false)
  assert.equal(audit.responses[0].sha256,null)
})

test('frozen acquisition error is preserved and audit delivery remains available',async()=>{
  const reason=Object.freeze(Error('synthetic original acquisition failure')),audits=[]
  const result=await rejected(catalog().run({now,fetchPage:async()=>{throw reason},onAudit:value=>audits.push(value)}))
  assert.equal(result.rejected,true);assert.equal(result.error,reason)
  assert.equal(audits[0].outcome,'failed')
})

for(const kind of ['returned denial','frozen original-response denial','frozen direct denial'])test('synthetic '+kind+' retains bytes independently of contradictory requested clock',async()=>{
  const body='Synthetic denied original entity',page=synthetic(body,{status:403,headers:{'content-type':'text/plain','retry-after':'60'},requestedAt:'2026-11-07T01:00:00.000Z'})
  const reason=Object.freeze(Object.assign(Error('synthetic original denial'),kind==='frozen direct denial'?page:{originalResponse:page}))
  const audits=[],heldHosts=new Set()
  const result=await rejected(catalog().run({now,heldHosts,onAudit:value=>audits.push(value),fetchPage:async()=>{
    if(kind==='returned denial')return page
    throw reason
  }}))
  assert.equal(result.rejected,true)
  if(kind!=='returned denial')assert.equal(result.error,reason)
  else assert.equal(result.error.status,403)
  const row=audits[0].responses[0]
  assert.equal(row.status,403)
  assert.equal(row.bodyBase64,Buffer.from(body).toString('base64'))
  assert.equal(row.sha256,digest(Buffer.from(body)))
  assert.deepEqual(row.headers,page.headers)
  assert.equal(row.sourceRequestedAt,null)
  assert.equal(row.sourceCompletedAt,'2026-11-07T00:00:00.001Z')
  assert.equal(row.rawAcquisitionClocks.requestedAt,'2026-11-07T01:00:00.000Z')
  assert.equal(row.acquisitionClocksQualified,false)
  assert.equal(row.transportQualified,false)
  assert.equal(heldHosts.has('www.adityabirlarealestate.com'),true)
  assert.equal(audits[0].rawPages[0].bodyBase64,page.bodyBase64)
})

test('held public host prevents acquisition without replacing unknown totals with zero',async()=>{
  const heldHosts=new Set(['www.adityabirlarealestate.com']),audits=[]
  const result=await rejected(catalog().run({now,heldHosts,onAudit:value=>audits.push(value),fetchPage:()=>assert.fail('held host read')}))
  assert.equal(result.rejected,true);assert.equal(result.error.failureKind,'blocked_or_access_denied')
  assert.equal(audits[0].responses.length,0);assert.equal(audits[0].companyGlobalTotal,null)
})

for(const key of ['maxResponseBytes','maxSourceBytes','maxTotalBytes'])test('synthetic '+key+' limit rejects before retaining oversized originals',async()=>{
  const audits=[]
  const result=await rejected(catalog().run({now,[key]:100,onAudit:value=>audits.push(value),fetchPage:async()=>original()}))
  assert.equal(result.rejected,true);assert.match(result.error.message,/byte/)
  assert.equal(audits[0].responses[0].bodyBase64,null)
  assert.equal(audits[0].rawPages.some(row=>typeof row.bodyBase64==='string'),false)
})

test('native oversize body cancels and releases once even when cancellation never settles',async()=>{
  let cancelled=0,released=0
  const reader={read:async()=>({done:false,value:new Uint8Array(101)}),cancel(){cancelled++;return never()},releaseLock(){released++}}
  const result=await rejected(catalog().run({now,maxResponseBytes:100,fetchImpl:async()=>({url:HOME,status:200,
    headers:{'content-type':'text/html'},body:{getReader:()=>reader}})}))
  assert.equal(result.rejected,true);assert.match(result.error.message,/byte/)
  assert.equal(cancelled,1);assert.equal(released,1)
})

for(const status of [200,403])test('synthetic native HTTP '+status+' preserves acquisition start and original body-read failure',async()=>{
  const reason=Object.freeze(Error('synthetic native original body failure')),audits=[]
  let cancelled=0,released=0
  const result=await rejected(catalog().run({now,onAudit:value=>audits.push(value),fetchImpl:async()=>({url:HOME,status,
    headers:{'content-type':'text/plain'},body:{getReader:()=>({read(){throw reason},cancel(){cancelled++},releaseLock(){released++}})}})}))
  assert.equal(result.rejected,true)
  if(status===200)assert.equal(result.error,reason)
  else{assert.equal(result.error.status,403);assert.equal(result.error.bodyReadError,reason)}
  const row=audits[0].responses[0]
  assert.equal(row.sourceRequestedAt,'2026-11-07T04:00:00.000Z')
  assert.equal(row.sourceCompletedAt,null);assert.equal(row.bodyComplete,false);assert.equal(row.sha256,null)
  assert.equal(cancelled,1);assert.equal(released,1)
})

test('caller cancellation before acquisition preserves the caller reason',async()=>{
  const controller=new AbortController(),reason=Object.freeze({cancelled:'before acquisition'})
  controller.abort(reason)
  const result=await rejected(catalog().run({now,signal:controller.signal,fetchPage:()=>assert.fail('cancelled read')}))
  assert.equal(result.rejected,true);assert.equal(result.error,reason)
})

test('caller cancellation during pending acquisition preserves the caller reason',async()=>{
  const controller=new AbortController(),reason=Object.freeze({cancelled:'pending acquisition'})
  const timer=schedule(()=>controller.abort(reason),10)
  try{
    const result=await rejected(catalog().run({now,signal:controller.signal,fetchPage:never}))
    assert.equal(result.rejected,true);assert.equal(result.error,reason)
  }finally{unschedule(timer)}
})

test('pending acquisition terminates at its request deadline and cancels a late response',async()=>{
  let resolve,cancelled=0
  const pending=new Promise(done=>{resolve=done})
  const result=await rejected(catalog().run({now,requestTimeoutMs:10,fetchImpl:()=>pending}))
  assert.equal(result.rejected,true);assert.match(result.error.message,/deadline/)
  resolve({body:{cancel(){cancelled++;return never()}}})
  await new Promise(done=>schedule(done,0))
  assert.equal(cancelled,1)
})

test('pending native entity terminates at its own deadline and releases its reader',async()=>{
  let cancelled=0,released=0
  const result=await rejected(catalog().run({now,entityTimeoutMs:10,fetchImpl:async()=>({url:HOME,status:200,
    headers:{'content-type':'text/html'},body:{getReader:()=>({read:never,cancel(){cancelled++},releaseLock(){released++}})}})}))
  assert.equal(result.rejected,true);assert.match(result.error.message,/entity deadline/)
  assert.equal(cancelled,1);assert.equal(released,1)
})

test('synchronous request overrun is checked with the independent monotonic clock',async()=>{
  let tick=0
  const result=await rejected(catalog().run({now,monotonicNow:()=>tick,requestTimeoutMs:20,fetchPage:()=>{tick=100;return original()}}))
  assert.equal(result.rejected,true);assert.match(result.error.message,/deadline/)
})

test('bounded callback deadline terminates ignored signals',async()=>{
  const result=await rejected(catalog().run({now,callbackTimeoutMs:10,fetchPage:async()=>original(),onRecords:never}))
  assert.equal(result.rejected,true);assert.match(result.error.message,/deadline/)
})

test('audit callback snapshots cannot change retained criteria or original bytes',async()=>{
  const jobs=await catalog().run({now,fetchPage:async()=>original(),onAudit:(audit,control)=>{
    assert.equal(control.signal instanceof AbortSignal,true);control.throwIfAborted()
    audit.responses[0].bodyBase64='edited';audit.observations.length=0
  },onMetadata:value=>{value.verifiedPublicJobCount=0}})
  const audit=incomplete(jobs)
  assert.equal(audit.observations.length,3);assert.equal(audit.responses[0].bodyBase64,bytes.toString('base64'))
  assert.equal(audit.sourceMetadata.verifiedPublicJobCount,null)
})

test('frozen callback rejection retains its identity and already admitted original evidence',async()=>{
  const reason=Object.freeze(Error('synthetic callback failure')),audits=[]
  const result=await rejected(catalog().run({now,fetchPage:async()=>original(),onRecords:()=>{throw reason},onAudit:value=>audits.push(value)}))
  assert.equal(result.rejected,true);assert.equal(result.error,reason)
  assert.equal(audits[0].responses[0].sha256,receipt.sha256);assert.equal(audits[0].observations.length,3)
})

test('error accessors and inherited metadata setters remain inert',async()=>{
  let accessed=0
  const reason=Object.create({set inventoryEvidence(value){accessed++}})
  Object.defineProperty(reason,'status',{get(){accessed++;throw Error('synthetic accessor')}})
  Object.defineProperty(reason,'sourceAudit',{configurable:true,get(){accessed++;throw Error('synthetic accessor')}})
  const result=await rejected(catalog().run({now,fetchPage:async()=>{throw reason}}))
  assert.equal(result.rejected,true);assert.equal(result.error,reason);assert.equal(accessed,0)
})

test('synthetic positive native role context does not inherit country or legal employer from footer',async()=>{
  const audit=incomplete(await catalog().run({now,fetchPage:async()=>synthetic()}))
  assert.equal(audit.observations.length,1)
  assert.equal(audit.observations[0].title,'Synthetic Engineer, Synthetic Division')
  assert.equal(audit.observations[0].country,null);assert.equal(audit.observations[0].legalEmployer,null)
})

for(const [label,wrap] of [
  ['template',value=>'<template>'+value+'</template>'],['object',value=>'<object>'+value+'</object>'],
  ['textarea',value=>'<textarea>'+value+'</textarea>'],['noscript',value=>'<noscript>'+value+'</noscript>'],
  ['iframe fallback',value=>'<iframe>'+value+'</iframe>'],['SVG foreignObject',value=>'<svg><foreignObject>'+value+'</foreignObject></svg>'],
  ['MathML',value=>'<math>'+value+'</math>'],['hidden',value=>'<div hidden>'+value+'</div>'],
  ['inert',value=>'<div inert>'+value+'</div>'],['aria hidden',value=>'<div aria-hidden="true">'+value+'</div>'],
  ['display none',value=>'<div style="display:none">'+value+'</div>'],['comment',value=>'<!--'+value+'-->'],
])test('synthetic '+label+' subtree cannot supply published role authority',async()=>{
  const jobs=await catalog().run({now,fetchPage:async()=>synthetic(pageHTML(sectionHTML(wrap(roleHTML()))))})
  const audit=incomplete(jobs)
  assert.equal(audit.observations.length,0)
  assert.equal(readSourceObservationEvidence(jobs,'adityabirlarealestate').observedVacancyCount,0)
})

test('publisher script strings and application handlers are never interpreted as role records or executed',async()=>{
  const content='<script>globalThis.__realestateRemoteExecuted=true;'+JSON.stringify(roleHTML())+'</script>'
    + '<a onclick="globalThis.__realestateRemoteExecuted=true">Apply Now</a><form><h2>General Applications</h2></form>'
  const audit=incomplete(await catalog().run({now,fetchPage:async()=>synthetic(pageHTML(sectionHTML(content)))}))
  assert.equal(audit.observations.length,0);assert.equal(globalThis.__realestateRemoteExecuted,undefined)
})

test('synthetic general intake remains a non-vacancy context even inside role-shaped markup',async()=>{
  const jobs=await catalog().run({now,fetchPage:async()=>synthetic(pageHTML(sectionHTML(roleHTML('General Applications, Synthetic Division'))))})
  const audit=incomplete(jobs),summary=readSourceObservationEvidence(jobs,'adityabirlarealestate')
  assert.equal(audit.observations.length,1);assert.equal(audit.observations[0].vacancy,false)
  assert.equal(audit.observations[0].kind,'hiring-context')
  assert.equal(summary.recordKind,'hiring-signals');assert.equal(summary.observedVacancyCount,0)
})

for(const [label,mutate] of [
  ['duplicate role collapse identity',html=>html.replace('</div></div></section>',roleHTML('Another Engineer, Synthetic Division')+'</div></div></section>')],
  ['contradictory collapse reference',html=>html.replace('aria-controls="synthetic1"','aria-controls="other"')],
  ['duplicate job section',html=>html+sectionHTML(roleHTML())],
])test('synthetic '+label+' cannot qualify ambiguous role context',async()=>{
  const audits=[]
  const result=await rejected(catalog().run({now,fetchPage:async()=>synthetic(pageHTML(mutate(sectionHTML(roleHTML())))),onAudit:value=>audits.push(value)}))
  assert.equal(result.rejected,true);assert.match(result.error.message,/ambiguous|identity|reference/i)
  assert.equal(audits[0].observations.length,0)
  assert.equal(audits[0].responses[0].bodyComplete,true)
})

for(const [label,page] of [
  ['changed URL',()=>synthetic(undefined,{finalUrl:CORPORATE,url:CORPORATE})],
  ['non-HTML MIME',()=>synthetic(undefined,{headers:{'content-type':'application/json'}})],
  ['contradictory digest',()=>({...original(),sha256:'0'.repeat(64)})],
  ['invalid original clock',()=>({...original(),sourceRequestedAt:'unavailable-original-clock'})],
  ['invalid UTF8',()=>synthetic(undefined,{bodyBase64:Buffer.from([0xff]).toString('base64')})],
  ['changed publisher',()=>synthetic(pageHTML(sectionHTML(roleHTML())).replace('Careers at ABREL','Careers at Another Publisher'))],
])test('synthetic '+label+' remains unavailable while admitted entity evidence survives',async()=>{
  const audits=[]
  const result=await rejected(catalog().run({now,fetchPage:async()=>page(),onAudit:value=>audits.push(value)}))
  assert.equal(result.rejected,true)
  assert.equal(audits[0].responses[0].bodyComplete,true)
  assert.equal(audits[0].responses[0].transportQualified,label==='changed publisher')
  assert.equal(audits[0].observations.length,0)
})

test('unavailable decoded body is a failure rather than verified empty inventory',async()=>{
  const result=await rejected(catalog().run({now,fetchText:async()=>''}))
  assert.equal(result.rejected,true);assert.match(result.error.message,/unavailable/)
})

// F1 controls mutate only the first genuine role heading. Originals stay
// untouched, and every changed entity is explicitly synthetic boundary data.
const f1Title='Head - Engineering, Century Pulp & Paper'
const f1Location='Lalkuan, Uttarakhand'
const f1Header='<h2 class="accordion-header">'+f1Title+'<br><span>'+f1Location+'</span>'
const f1Remainder=[
  ['collapse2','Head - Production, Planning & Control, Century Pulp & Paper','Lalkuan, Uttarakhand','Century Pulp & Paper'],
  ['collapse3','Finance & Accounts - Team Member, Head Office','Mumbai','Head Office'],
]
const f1Shape=row=>[row.scopeId,row.title,row.publishedLocation,row.publishedDivision]
const f1Partial=jobs=>{
  const audit=incomplete(jobs)
  for(const row of audit.observations){
    assert.equal(row.qualification,'partial')
    assert.equal(row.country,null);assert.equal(row.legalEmployer,null)
    assert.equal(row.criteriaVisibilityQualified,false);assert.equal(row.eligibilityQualified,false)
    assert.equal(row.sourceDetailComplete,false);assert.equal(row.lifecycleCleanupAllowed,false)
  }
  return audit
}
for(const [name,replacement,entitySHA256] of [
  ['exact review title span before break','<h2 class="accordion-header"><span>'+f1Title+'</span><br>'+f1Location,
    '87adb07fefe09cf3ec2253561d9f97a2d5823a4197c2049a34a858549cd51008'],
  ['exact review location span before break','<h2 class="accordion-header">'+f1Title+'<span>'+f1Location+'</span><br>',
    '4c97b1afb312d7945e84694afa217bafc97caddcd8038793c1e30c93a5efed8b'],
  ['title span before break plus another location span','<h2 class="accordion-header"><span>'+f1Title+'</span><br><span>'+f1Location+'</span>'],
  ['bare post-break location without a location span','<h2 class="accordion-header">'+f1Title+'<br>'+f1Location],
  ['ambiguous bare text before location span','<h2 class="accordion-header">'+f1Title+'<br>Other location <span>'+f1Location+'</span>'],
  ['ambiguous bare text after location span','<h2 class="accordion-header">'+f1Title+'<br><span>'+f1Location+'</span> Other location'],
  ['a second direct break','<h2 class="accordion-header">'+f1Title+'<br><br><span>'+f1Location+'</span>'],
])test('F1 skips '+name+' while preserving the other two genuine partial contexts',async()=>{
  const genuine=bytes.toString('utf8')
  assert.equal(genuine.includes(f1Header),true)
  const modified=genuine.replace(f1Header,replacement)
  if(entitySHA256)assert.equal(digest(Buffer.from(modified)),entitySHA256)
  const jobs=await catalog().run({now,fetchPage:async()=>synthetic(modified)})
  const audit=f1Partial(jobs)
  assert.deepEqual(audit.observations.map(f1Shape),f1Remainder)
  const summary=readSourceObservationEvidence(jobs,'adityabirlarealestate')
  assert.equal(summary.observedRecordCount,2);assert.equal(summary.observedVacancyCount,2)
})

test('F1 skips a location span moved after its collapse button',async()=>{
  const genuine=bytes.toString('utf8')
  const firstEnd=genuine.indexOf('</h2>',genuine.indexOf(f1Header))
  assert.equal(firstEnd>0,true)
  const prefix=genuine.slice(0,firstEnd).replace(f1Header,'<h2 class="accordion-header">'+f1Title+'<br>')
  const modified=prefix+'<span>'+f1Location+'</span>'+genuine.slice(firstEnd)
  const jobs=await catalog().run({now,fetchPage:async()=>synthetic(modified)})
  assert.deepEqual(f1Partial(jobs).observations.map(f1Shape),f1Remainder)
})

for(const [name,replacement] of [
  ['whitespace on both sides of the supported partition','<h2 class="accordion-header"> \n\t'+f1Title+' \r\n<br> \t\n<span> Lalkuan,\n Uttarakhand </span> \n\t'],
  ['inert comments beside the supported partition','<h2 class="accordion-header">'+f1Title+'<!-- title boundary --><br><!-- location boundary --><span>'+f1Location+'</span><!-- field boundary -->'],
])test('F1 retains all three partial contexts with '+name,async()=>{
  const genuine=bytes.toString('utf8')
  assert.equal(genuine.includes(f1Header),true)
  const jobs=await catalog().run({now,fetchPage:async()=>synthetic(genuine.replace(f1Header,replacement))})
  const audit=f1Partial(jobs)
  assert.deepEqual(audit.observations.map(f1Shape),[
    ['collapse1',f1Title,f1Location,'Century Pulp & Paper'],...f1Remainder,
  ])
  assert.equal(audit.observations[0].criteriaItems.length,8)
})

test('test execution made no attempt to use a network transport',()=>{
  assert.deepEqual(globalThis[Symbol.for('realestate.c36.offline-network-attempts')]??[],[])
})
