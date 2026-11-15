import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import * as script from './script.js'
import {createEvonikOriginalReader,readEvonikLanding,readEvonikRole,readEvonikListing,readEvonikJSON,readEvonikCorporate} from './currentNativeData20261114.js'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {currentEvonikFixture,createEvonikReplay,withEvonikReplayClock,assertEvonikCurrentJobs} from './test-data/replayNativeData20261114.js'

const provider=()=>getScraperCatalog().find(row=>row.source==='evonik')
const profile=JSON.parse(readFileSync(new URL('./reviewedNativeData20261114.json',import.meta.url),'utf8'))
const NOW='2026-11-14T23:05:20.335Z',fixture=currentEvonikFixture()
const role=id=>profile.roles.find(item=>item.id===id)
const row=id=>profile.IndiaRows.find(item=>item.bulletFields[0]===id)
const packet=(id,kind='API')=>fixture.packets[fixture.rolePairs.find(item=>item.id===id)[kind==='API'?'APIPacketIndex':'HTMLPacketIndex']]
const packetText=item=>Buffer.from(item.bodyBase64,'base64').toString()
const landingPage=(id,mutate=text=>text)=>{const text=mutate(packetText(packet(id,'HTML')));return{text,bytes:Buffer.from(text)}}
const nativeMutation=(id,mutate)=>{const data=JSON.parse(packetText(packet(id)));mutate(data);return JSON.stringify(data)}
const authority=error=>error.softFailure===true&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false
test('current genuine originals retain ten explicit India native/public full criteria pairs through exported run',async()=>{
 const io=createEvonikReplay()
 const jobs=await withEvonikReplayClock(()=>script.run({fetchImpl:io.fetchImpl,now:()=> '2026-11-14T23:05:20.335Z'}))
 assertEvonikCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,48)
})
test('current genuine originals qualify the actual registered Evonik route without corporate mirror404',async()=>{
 const io=createEvonikReplay()
 const jobs=await withEvonikReplayClock(()=>createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl,now:()=> '2026-11-14T23:05:20.335Z'}))
 assertEvonikCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,48)
 assert(!io.calls.some(call=>call.url==='https://www.evonik.com/en/careers/jobs/job.html?jobId=R52507'))
})
test('fixture retains complete genuine decoded entities and labels simulated role closures as replay',()=>{
 const fixture=currentEvonikFixture();assert.equal(fixture.packets.length,27);assert.equal(fixture.physicalAllTenClosingProved,false)
 assert.equal(fixture.rolePairs.length,10);assert.equal(fixture.schedule.length,48)
 assert(fixture.schedule.filter(row=>row.reusesAnOpeningEntityToSimulateClosing).length>0)
 assert.equal(createHash('sha256').update(JSON.stringify(fixture.packets.slice(0,26))).digest('hex'),'4ceae62586e44e1b6fc7b71bb6741142c44c1198cb04e3b08e1573b9662fefee')
 assert.equal(fixture.corporateCardOrderVariant.genuineSingleObservation,true);assert.equal(fixture.corporateCardOrderVariant.physicalPair,false)
})

const corporatePacket=current=>fixture.packets[current?fixture.corporateCardOrderVariant.packetIndex:0]
const corporatePage=(current=true,change=text=>text)=>{const text=change(packetText(corporatePacket(current)));return{text,bytes:Buffer.from(text)}}
const corporateResponse=current=>{
 const original=corporatePacket(current),response=new Response(Buffer.from(original.bodyBase64,'base64'),{status:original.status,headers:original.headers})
 Object.defineProperty(response,'url',{value:original.finalUrl});return response
}
const corporateReplay=(opening,closing)=>createEvonikReplay((_bytes,item,count)=>item.requestedUrl===script.CAREERS_URL?corporateResponse(count===1?opening:closing):undefined)

for(const entry of ['run','factory','registered'])test('genuine reordered corporate cards qualify through '+entry,async()=>{
 const io=corporateReplay(true,true),options={fetchImpl:io.fetchImpl,now:()=>NOW}
 const jobs=await withEvonikReplayClock(()=>entry==='run'?script.run(options):entry==='factory'?script.createEvonikNativeDataScraper(options).run():createCatalogScraper(provider()).run(options))
 assertEvonikCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,48)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningCorporate.observation.sha256,corporatePacket(true).sha256)
 assert.equal(jobs.nativeCollectionEvidence.nativeClosingCorporate.observation.sha256,corporatePacket(true).sha256)
})

for(const[opening,closing]of [[false,true],[true,false]])test('only corporate immutable card order may differ between actual-carrier opening and closing '+opening+'-'+closing,async()=>{
 const io=corporateReplay(opening,closing),jobs=await withEvonikReplayClock(()=>createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl,now:()=>NOW}))
 assertEvonikCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,48)
 const evidence=jobs.nativeCollectionEvidence,a=evidence.nativeOpeningCorporate,b=evidence.nativeClosingCorporate
 assert.deepEqual(a.handshake,b.handshake);assert.notDeepEqual(a.observation.orderedCardIds,b.observation.orderedCardIds)
 assert.equal(a.observation.sha256,corporatePacket(opening).sha256);assert.equal(b.observation.sha256,corporatePacket(closing).sha256)
 assert.equal(evidence.currentCSSCoverage,false);assert.equal(evidence.companyScopeComplete,false);assert.equal(evidence.lifecycleCleanupAllowed,false)
})

const cardMatches=text=>[...text.matchAll(/<a\b[^>]*\bclass="tile-job(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/a>/g)]
function corporateCardsInOrder(text,order){const matches=cardMatches(text);assert.equal(matches.length,8);let index=0;return text.replace(/<a\b[^>]*\bclass="tile-job(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/a>/g,()=>matches[order[index++]][0])}
test('all eight immutable cards can change order while every noncard byte stays exact',()=>{
 const result=readEvonikCorporate(corporatePage(false,text=>corporateCardsInOrder(text,[7,6,5,4,3,2,1,0])))
 assert.deepEqual(result.observation.orderedCardIds,['R52244','R51646','R52176','R52568','R51254','R51287','R51552','R47504'])
 assert.equal(result.handshake.cards.length,8)
})

const corporateNegatives=[
 ['changed full card title',text=>text.replace('title="IT Application Developer SAP ABAP / Fiori / UI5"','title="Changed role"')],
 ['changed full card href',text=>text.replace('jobId=R47504"','jobId=R99999"')],
 ['changed full card country text',text=>text.replace('Malaysia | Selangor','India | Selangor')],
 ['changed full card date text',text=>text.replace('2026-11-10</span>','2026-11-11</span>')],
 ['added card hidden attribute',text=>text.replace('<a class="tile-job ','<a hidden class="tile-job ')],
 ['added card inert attribute',text=>text.replace('<a class="tile-job ','<a inert class="tile-job ')],
 ['added card style',text=>text.replace('<a class="tile-job ','<a style="display:none" class="tile-job ')],
 ['added card event',text=>text.replace('<a class="tile-job ','<a onclick="hide()" class="tile-job ')],
 ['changed card class',text=>text.replace('<a class="tile-job ','<a class="tile-job disN ')],
 ['missing immutable card',text=>text.replace(cardMatches(text)[0][0],'')],
 ['new duplicate immutable card',text=>text.replace(cardMatches(text)[0][0],cardMatches(text)[0][0]+cardMatches(text)[0][0])],
 ['duplicate replacing an existing card',text=>corporateCardsInOrder(text,[0,1,2,3,4,5,6,6])],
 ['missing owner close tag',text=>text.replace('</a>\n\n\n            </div>','</a>\n\n\n            ')],
 ['hidden owner',text=>text.replace('<section class="slider-jobs">','<section hidden class="slider-jobs">')],
 ['template owner',text=>text.replace('<section class="slider-jobs">','<template><section class="slider-jobs">').replace('</main>','</template></main>')],
 ['changed owner activation attribute',text=>text.replace('x-data="swiperSlider"','x-data="changedSlider"')],
 ['changed outer whitespace',text=>text.replace(/<!doctype html>/i,original=>original+' ')],
 ['changed complete script',text=>text.replace('<script ','<script data-new="unreviewed" ')],
 ['new inline style',text=>text.replace('</head>','<style>.tile-job{display:none}</style></head>')],
 ['new stylesheet declaration',text=>text.replace('</head>','<link rel="stylesheet" href="/unreviewed.css"></head>')],
 ['changed careers handoff',text=>text.replace('href="/en/careers/jobs.html"','href="/en/careers/other.html"')],
 ['extra authority carrier',text=>text.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting"}</script></head>')],
 ['changed document base',text=>text.replace('</head>','<base href="https://other.example/"></head>')],
]
for(const[label,change]of corporateNegatives)test('corporate immutable card envelope rejects '+label,()=>{
 const page=corporatePage(false,change);assert.equal(page.text!==packetText(corporatePacket(false)),true,'Mutation must change actual original bytes')
 assert.throws(()=>readEvonikCorporate(page),authority)
})
test('corporate parser cannot pair original bytes with independently changed text',()=>{
 const page=corporatePage(false);page.text=page.text.replace('jobId=R47504','jobId=R99999')
 assert.throws(()=>readEvonikCorporate(page),authority)
})
test('native original MIME rejects an unmatched UTF8 charset quote',async()=>{
 const io=createEvonikReplay(),reader=createEvonikOriginalReader({fetchImpl:async(url,init)=>{const response=await io.fetchImpl(url,init);response.headers.set('content-type','text/html; charset="utf-8');return response}})
 try{await assert.rejects(reader.read(script.CAREERS_URL),error=>error.softFailure===true&&/MIME/.test(error.message))}finally{reader.close()}
})
test('nested spread in original bootstrap data rejects with bounded native authority diagnostics',()=>{
 const fixture=currentEvonikFixture(),packet=fixture.packets[fixture.rolePairs[0].HTMLPacketIndex]
 const text=Buffer.from(packet.bodyBase64,'base64').toString().replace('branding: {','branding: {...{},')
 assert.throws(()=>readEvonikLanding({text,bytes:Buffer.from(text)},profile.roles[0]),error=>error.softFailure===true&&/boot/i.test(error.message))
})

for(const id of fixture.expectedIndiaIds)test(id+': both complete original criteria, all fields and explicit native/public country remain qualified only as data',()=>{
 const native=readEvonikRole(packetText(packet(id)),row(id),NOW),publicData=readEvonikLanding(landingPage(id),role(id))
 assert.deepEqual(native.data,role(id).APIRecord);assert.deepEqual(publicData.model,role(id).publicSchema)
 assert.equal(publicData.model.jobLocation.address.addressCountry,'India')
 assert.equal(publicData.account.wholeProgramQualified,false);assert.equal(publicData.account.tokenValueShapeOrLengthQualified,false)
 assert.equal(publicData.wholeExecutableOrCSSOrUIOrApplicationQualified,false)
})

const nativeNegatives=[
 ['foreign primary country',value=>value.jobPostingInfo.country.descriptor='United States of America'],
 ['foreign primary UUID',value=>value.jobPostingInfo.country.id='bc33aa3152ec42d4995f4791a106ed09'],
 ['extra empty country field',value=>value.jobPostingInfo.country.code=''],
 ['foreign requisition country',value=>value.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US'],
 ['extra nested country authority',value=>value.jobPostingInfo.jobRequisitionLocation.country.countryCode='IN'],
 ['contradictory worksite',value=>value.jobPostingInfo.jobRequisitionLocation.descriptor='Other worksite'],
 ['unknown legal employer',value=>value.hiringOrganization.name='Other Employer'],
 ['new legal website authority',value=>value.hiringOrganization.url='https://other.example'],
 ['foreign native logo account',value=>value.jobPostingInfo.logoImage.src=value.jobPostingInfo.logoImage.src.replace('/evonik/','/other/')],
 ['wrong requisition',value=>value.jobPostingInfo.jobReqId='R99999'],
 ['wrong full native identity',value=>value.jobPostingInfo.id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
 ['wrong posting',value=>value.jobPostingInfo.jobPostingId+='-2'],
 ['foreign posting site',value=>value.jobPostingInfo.jobPostingSiteId='Other_Careers'],
 ['wrong native external URL',value=>value.jobPostingInfo.externalUrl=value.jobPostingInfo.externalUrl.replace('evonik.wd3','other.wd3')],
 ['wrong original title',value=>value.jobPostingInfo.title+=' changed'],
 ['unknown extra criteria carrier',value=>value.jobPostingInfo.qualifications='Additional independently required certification'],
 ['extra root criterion',value=>value.qualifications={mandatory:'Unreviewed'}],
 ['removed original rich section',value=>value.jobPostingInfo.jobDescription=value.jobPostingInfo.jobDescription.slice(0,1000)],
 ['added mandatory rich section',value=>value.jobPostingInfo.jobDescription+='<p>Mandatory: additional certification.</p>'],
 ['explicit native closed notice',value=>value.jobPostingInfo.jobDescription+='<p>This position is closed. We are no longer accepting applications.</p>'],
 ['inactive native publication',value=>value.jobPostingInfo.posted=false],
 ['native application unavailable',value=>value.jobPostingInfo.canApply=false],
 ['native status string',value=>value.jobPostingInfo.canApply='true'],
 ['impossible native calendar',value=>value.jobPostingInfo.startDate='2026-02-30'],
 ['future native posting',value=>value.jobPostingInfo.startDate='2027-01-01'],
 ['expired native role',value=>value.jobPostingInfo.endDate='2026-11-01'],
 ['extra native attachment',value=>value.jobPostingInfo.attachments=[{url:'https://other.example/criteria.pdf'}]],
 ['unknown native response field',value=>value.newState={}],
 ['relative display pretending to be a status',value=>value.jobPostingInfo.postedOn='This job is closed.'],
]
for(const[label,mutate]of nativeNegatives)test('complete native data rejects '+label,()=>assert.throws(()=>readEvonikRole(nativeMutation('R52507',mutate),row('R52507'),NOW),authority))
test('relative display counters remain original data, never a refreshed posting clock',()=>{
 const text=nativeMutation('R52507',value=>{value.jobPostingInfo.postedOn='Posted 3 Days Ago';value.jobPostingInfo.timeLeftToApply='29 days left to apply'})
 const value=readEvonikRole(text,row('R52507'),NOW).data
 assert.equal(value.jobPostingInfo.startDate,'2026-11-12');assert.equal(value.jobPostingInfo.postedOn,'Posted 3 Days Ago');assert.equal(value.jobPostingInfo.timeLeftToApply,'29 days left to apply')
})
test('extra location strings are preserved without promoting their country',()=>{
 for(const id of ['R52195','R52196','R52191']){
  const value=readEvonikRole(packetText(packet(id)),row(id),NOW).data
  assert.deepEqual(value.jobPostingInfo.additionalLocations,role(id).APIRecord.jobPostingInfo.additionalLocations)
  assert.equal(role(id).additionalLocationCountryScopeUnresolved,true)
 }
 assert.throws(()=>readEvonikRole(nativeMutation('R52195',value=>value.jobPostingInfo.additionalLocations.push('Unknown location')),row('R52195'),NOW),authority)
})
test('exact two original title vectors remain disclosed and are never generally normalized',()=>{
 assert.equal(readEvonikLanding(landingPage('R52912'),role('R52912')).model.title,'Technical Marketing &amp; Business Development Manager')
 assert.equal(readEvonikRole(packetText(packet('R52912')),row('R52912'),NOW).data.jobPostingInfo.title,'Technical Marketing & Business Development Manager')
 assert.throws(()=>readEvonikLanding(landingPage('R52912',text=>mutateSchema(text,value=>{value.title=value.title.replace('&amp;','&');value.identifier.name=value.title})),role('R52912')),authority)
 assert.throws(()=>readEvonikLanding(landingPage('R52196',text=>mutateSchema(text,value=>{value.title=value.title.replace(' - Electrical',' -  Electrical');value.identifier.name=value.title})),role('R52196')),authority)
})

const documentNegatives=[
 ['whole hidden body',text=>text.replace('<body','<body hidden')],
 ['whole inert html',text=>text.replace('<html','<html inert')],
 ['hidden data owner',text=>text.replace('<script type="application/ld+json"','<script hidden type="application/ld+json"')],
 ['template data ancestor',text=>text.replace('<head>','<head><template>').replace('</head>','</template></head>')],
 ['hidden style ancestor',text=>text.replace('<head>','<head style="display:none">')],
 ['unknown native base',text=>text.replace('</head>','<base href="https://other.example"></head>')],
 ['meta refresh',text=>text.replace('</head>','<meta http-equiv="refresh" content="0;url=https://other.example"></head>')],
 ['event activation',text=>text.replace('<body','<body onload="hideCriteria()"')],
 ['unknown class',text=>text.replace('<body','<body class="hidden"')],
 ['duplicate raw attribute',text=>text.replace('<html lang="en-US"','<html lang="en-US" lang="en-US"')],
 ['duplicate native owner',text=>text.replace('</body>','<div id="root"></div></body>')],
 ['additional inert criteria',text=>text.replace('</body>','<template>Mandatory new qualifications</template></body>')],
 ['external script',text=>text.replace('</head>','<script src="https://other.example/a.js"></script></head>')],
 ['additional inline script',text=>text.replace('</head>','<script>window.other=true</script></head>')],
 ['unknown stylesheet',text=>text.replace('</head>','<link rel="stylesheet" href="https://other.example/a.css"></head>')],
 ['unknown style block',text=>text.replace('</head>','<style>body{display:none}</style></head>')],
 ['changed doctype',text=>text.replace(/<!doctype html>/i,'<!doctype html PUBLIC "other">')],
 ['unreviewed outer whitespace',text=>text+' '],
 ['changed canonical identity',text=>text.replace('/job/Assistant-Manager-Formulation-Development_R52507','/job/Other_R99999')],
 ['static tenant contradiction',text=>text.replace(/(tenant:\s*)"evonik"/,'$1"other"')],
 ['static site contradiction',text=>text.replace(/(siteId:\s*)"External_Careers"/,'$1"Other_Careers"')],
 ['static unavailable role',text=>text.replace('postingAvailable: true','postingAvailable: false')],
 ['extra initial boot property',text=>text.replace('postingAvailable: true','unreviewedState: true, postingAvailable: true')],
 ['computed boot authority',text=>text.replace('postingAvailable: true',"['postingAvailable']: true")],
 ['duplicate boot authority',text=>text.replace('postingAvailable: true','postingAvailable: true, postingAvailable: true')],
]
for(const[label,mutate]of documentNegatives)test('complete raw16node carrier rejects '+label,()=>{
 const original=landingPage('R52507').text,changed=mutate(original);assert.ok(changed!==original,'Mutation must alter the actual original')
 assert.throws(()=>readEvonikLanding({text:changed,bytes:Buffer.from(changed)},role('R52507')),authority)
})
test('bootstrap comments remain explicitly unqualified whole executable evidence',()=>{
 const changed=landingPage('R52507',text=>text.replace('window.workday =','/* unqualified program observation */ window.workday ='))
 const data=readEvonikLanding(changed,role('R52507'))
 assert.equal(data.account.wholeProgramQualified,false);assert.equal(data.account.tokenValueShapeOrLengthQualified,false)
 assert.equal(data.wholeExecutableOrCSSOrUIOrApplicationQualified,false)
})
const mutateSchema=(text,mutate)=>text.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const model=JSON.parse(raw);mutate(model);return start+JSON.stringify(model)+end})
for(const[label,mutate]of [
 ['foreign schema country',value=>value.jobLocation.address.addressCountry='US'],
 ['unknown schema country object',value=>value.jobLocation.address.addressCountry={name:'India',code:'US'}],
 ['extra schema criteria',value=>value.qualifications='Additional mandatory criteria'],
 ['foreign schema employer',value=>value.hiringOrganization.name='Other Employer'],
 ['invented application action',value=>value.directApply=true],
 ['missing public company copy',value=>value.description=value.description.slice(0,-800)],
 ['added public criteria',value=>value.description+=' Additional mandatory certification.'],
 ['closed public role',value=>value.description+=' This position is closed. We are no longer accepting applications.'],
 ['changed schema expiry',value=>value.validThrough='2027-01-01'],
 ['changed schema ID',value=>value.identifier.value='R99999'],
])test('complete original JobPosting data rejects '+label,()=>assert.throws(()=>readEvonikLanding(landingPage('R52507',text=>mutateSchema(text,mutate)),role('R52507')),authority))

const indiaPacket=fixture.packets[3],indiaText=packetText(indiaPacket)
const mutateListing=mutate=>{const value=JSON.parse(indiaText);mutate(value);return JSON.stringify(value)}
for(const[label,mutate]of [
 ['incomplete count',value=>value.total=10],
 ['missing row',value=>value.jobPostings.pop()],
 ['duplicate native ID',value=>value.jobPostings[1]=value.jobPostings[0]],
 ['unknown row country',value=>value.jobPostings[0].countryCode='US'],
 ['changed ordered rows',value=>value.jobPostings.reverse()],
 ['foreign role endpoint',value=>value.jobPostings[0].externalPath='https://other.example/job/R52507'],
 ['changed reviewed title',value=>value.jobPostings[0].title='Other title'],
 ['unknown root property',value=>value.moreJobs=[]],
 ['missing country facet',value=>value.facets.splice(1,1)],
 ['changed typed India ID',value=>value.facets[1].values.find(item=>item.descriptor==='India').id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
 ['changed typed India count',value=>value.facets[1].values.find(item=>item.descriptor==='India').count=10],
 ['duplicate selected country',value=>value.facets[1].values.push(value.facets[1].values.find(item=>item.descriptor==='India'))],
 ['extra unknown facet value property',value=>value.facets[1].values[0].otherCountry='US'],
 ['changed nested facet schema',value=>value.facets[4].values[0].endpoint='/other'],
])test('current complete native inventory rejects '+label,()=>assert.throws(()=>readEvonikListing(mutateListing(mutate),true),authority))
test('nonselected facet options retain their exact received order without normalization',()=>{
 const changed=mutateListing(value=>{value.facets[1].values.reverse();[value.facets[0].values[3],value.facets[0].values[4]]=[value.facets[0].values[4],value.facets[0].values[3]]})
 const value=readEvonikListing(changed,true)
 assert.equal(JSON.stringify(value),changed);assert.equal(value.jobPostings.length,11)
})
for(const text of ['{"a":1,"a":2}','{"__proto__":{}}','{"nested":{"constructor":1}}','{"x":undefined}'])test('original JSON rejects duplicate/unsafe/nonJSON '+text,()=>assert.throws(()=>readEvonikJSON(text),authority))

async function registeredRead(change,extra={}){
 const io=createEvonikReplay(change)
 const jobs=await withEvonikReplayClock(()=>createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl,now:()=>NOW,...extra}))
 return{jobs,calls:io.calls}
}
test('exported factory uses the same complete collector and retains full data/cleanup holds',async()=>{
 const io=createEvonikReplay(),jobs=await withEvonikReplayClock(()=>script.createEvonikNativeDataScraper({fetchImpl:io.fetchImpl,now:()=>NOW}).run())
 assertEvonikCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,48)
 assert.equal(jobs.filter(job=>job.additionalLocationCountryScopeUnresolved).length,3)
 assert.equal(jobs.filter(job=>job.nativeEvonikEvidence.titleVectorDisagreementDisclosed).length,2)
})
test('registered metadata retains all eleven observed India vacancies with one unhydrated hold',async()=>{
 const {jobs}=await registeredRead(),evidence=readSourceObservationEvidence(jobs,'evonik')
 assert.ok(evidence);assert.equal(evidence.recordKind,'vacancy-rows');assert.equal(evidence.observedRecordCount,11);assert.equal(evidence.observedVacancyCount,11)
 assert.equal(evidence.companyGlobalTotal,null);assert.equal(evidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,11)
})
test('original absolute posting and expiry enforce the source clock independently of profile bytes',()=>{
 assert.throws(()=>readEvonikRole(packetText(packet('R52507')),row('R52507'),'2026-11-01T00:00:00Z'),authority)
 assert.throws(()=>readEvonikRole(packetText(packet('R52507')),row('R52507'),'2027-01-01T00:00:00Z'),authority)
})
test('opening consumes at most45seconds and cannot borrow reserved closing time',async()=>{
 const own=Object.getOwnPropertyDescriptor(performance,'now');let clock=0,reads=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>clock})
 const reader=createEvonikOriginalReader({fetchImpl:async url=>{reads++;return responseAt(url,'Original body')}})
 clock=45001
 try{await assert.rejects(reader.read(script.CAREERS_URL),error=>authority(error)&&/reserved closing time/.test(error.message));assert.equal(reads,0)}finally{reader.close();if(own)Object.defineProperty(performance,'now',own);else delete performance.now}
})
test('registered Evonik selects its native entry without the generic Workday backfill route',()=>{
 assert(provider().modulePath.endsWith('nativeCriteria20261114.js'));assert.equal(provider().backfillMode,null)
 assert(provider().sourceDirectory.endsWith('evonik.workday'))
})
test('registered native contract failure never launches poisoned generic fallback reads',async()=>{
 const io=createEvonikReplay((bytes,item)=>item.requestedUrl===packet('R52507').requestedUrl?nativeMutation('R52507',value=>value.jobPostingInfo.jobDescription+='<p>Unreviewed criterion.</p>'):undefined)
 let physical=0
 await assert.rejects(()=>withEvonikReplayClock(()=>createCatalogScraper(provider()).run({now:()=>NOW,fetchImpl:async(url,init)=>{
  physical++;assert(physical<=5,'Poison: undeclared generic fallback request');return io.fetchImpl(url,init)
 }})),authority)
 assert.equal(physical,5);assert.equal(io.calls.length,5)
 assert.equal(io.calls.at(-1).url,packet('R52507').requestedUrl)
})
test('both source deadline aliases retain the stricter caller reduction',()=>{
 const reader=createEvonikOriginalReader({timeoutMs:90000,sourceTimeoutMs:1000})
 try{assert.equal(reader.limits.sourceTimeoutMs,1000)}finally{reader.close()}
})
test('concurrent original-reader calls cannot pass a pending pacing/read reservation',async()=>{
 await withEvonikReplayClock(async()=>{
  let physical=0
  const reader=createEvonikOriginalReader({maxRequests:26,fetchImpl:async()=>{physical++;return new Promise(()=>{})}})
  const pending=Array.from({length:3},()=>reader.read(script.CAREERS_URL).catch(error=>error))
  try{await new Promise(done=>setTimeout(done,25));assert.equal(physical,1)}finally{reader.close();await Promise.all(pending)}
 })
})
for(const[label,change]of [
 ['India closing order',(bytes,item,count)=>item.method==='POST'&&JSON.parse(item.requestBody).appliedFacets.Country&&count===2?JSON.stringify({...JSON.parse(bytes),jobPostings:JSON.parse(bytes).jobPostings.reverse()}):undefined],
 ['global closing count',(bytes,item,count)=>item.method==='POST'&&!JSON.parse(item.requestBody).appliedFacets.Country&&count===2?JSON.stringify({...JSON.parse(bytes),total:340}):undefined],
 ['native closing original relative display',(bytes,item,count)=>item.requestedUrl===packet('R52507').requestedUrl&&count===2?nativeMutation('R52507',value=>value.jobPostingInfo.postedOn='Posted 3 Days Ago'):undefined],
 ['native closing extra criteria',(bytes,item,count)=>item.requestedUrl===packet('R52507').requestedUrl&&count===2?nativeMutation('R52507',value=>value.jobPostingInfo.jobDescription+='<p>New mandatory certification.</p>'):undefined],
 ['public closing full criteria',(bytes,item,count)=>item.requestedUrl===packet('R52507','HTML').requestedUrl&&count===2?mutateSchema(bytes.toString(),value=>value.description+=' Mandatory additional criterion.'):undefined],
 ['corporate closing raw carrier',(bytes,item,count)=>item.requestedUrl===script.CAREERS_URL&&count===2?Buffer.concat([bytes,Buffer.from(' ')]):undefined],
 ['paired API and public closure notices',(bytes,item)=>item.requestedUrl===packet('R52507').requestedUrl?nativeMutation('R52507',value=>value.jobPostingInfo.jobDescription+='<p>This position is closed.</p>'):item.requestedUrl===packet('R52507','HTML').requestedUrl?mutateSchema(bytes.toString(),value=>value.description+=' This position is closed.'):undefined],
])test('actual registered route fails closed on '+label,async()=>{
 const io=createEvonikReplay(change)
 await assert.rejects(()=>withEvonikReplayClock(()=>createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl,now:()=>NOW})),error=>{assert(authority(error));assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false);return true})
 assert(io.calls.length<=48)
})
test('registered route preserves complete differently ordered nonselected facets and all ten output roles',async()=>{
 const {jobs}=await registeredRead((bytes,item,count)=>{
  if(item.method==='POST'&&JSON.parse(item.requestBody).appliedFacets.Country&&count===2){const data=JSON.parse(bytes);data.facets[1].values.reverse();return JSON.stringify(data)}
 })
 assertEvonikCurrentJobs(jobs,fixture)
 const audit=jobs.nativeCollectionEvidence
 assert.notDeepEqual(audit.nativeOpeningIndiaListing.facets[1].values,audit.nativeClosingIndiaListing.facets[1].values)
 assert.deepEqual(audit.nativeClosingIndiaListing.facets[1].values,[...audit.nativeOpeningIndiaListing.facets[1].values].reverse())
})

const responseAt=(url,body,options={})=>{const response=new Response(body,{status:options.status??200,headers:{'content-type':options.mime??'text/html'}});Object.defineProperty(response,'url',{value:options.finalUrl??url,configurable:true});if(options.redirected!==undefined)Object.defineProperty(response,'redirected',{value:options.redirected});return response}
test('original anonymous identity, exact POST body and unchanged90s/15s/48/4MB/24MB ceilings are retained',async()=>{
 const {calls}=await registeredRead()
 for(const {url,init}of calls){
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.headers['User-Agent'],'Mozilla/5.0 (compatible; Jobverify careers inventory check)')
  assert.deepEqual(Object.keys(init.headers).sort(),(init.body?['Accept','Content-Type','User-Agent']:['Accept','User-Agent']).sort())
  assert(!url.endsWith('/apply'));assert(!url.includes('R52151'));assert(!url.includes('canonical'))
 }
 const reader=createEvonikOriginalReader()
 try{assert.deepEqual(reader.limits,{sourceTimeoutMs:90000,requestTimeoutMs:15000,maxRequests:48,maxEntityBytes:4000000,maxTotalBytes:24000000})}finally{reader.close()}
})
for(const[name,value]of [['maxJobs',1],['fetchText',async()=>'<h1>Preview</h1>'],['fetchJson',async()=>({})],['fetchPage',async()=>({body:'Preview'})],['timeoutMs',90001],['requestTimeoutMs',15001],['maxRequests',49],['maxEntityBytes',4000001],['maxTotalBytes',24000001]])test('pre-I/O source contract rejects '+name,async()=>{
 let reads=0;await assert.rejects(()=>script.run({[name]:value,fetchImpl:async()=>{reads++}}),authority);assert.equal(reads,0)
})
for(const mime of ['text/html; charset=windows-1252','text/html; charset=utf-8; charset=utf-8','text/html; charset=utf-8"','text/html; charset="utf-8','text/html; charset=utf-16','application/json'])test('original HTML MIME fails closed on '+mime,async()=>{
 const io=createEvonikReplay(),reader=createEvonikOriginalReader({fetchImpl:async(url,init)=>{const value=await io.fetchImpl(url,init);value.headers.set('content-type',mime);return value}})
 try{await assert.rejects(reader.read(script.CAREERS_URL),authority);assert.equal(io.calls.length,1)}finally{reader.close()}
})
for(const[label,body]of [['BOM',Buffer.from([239,187,191,65])],['invalidUTF8',Buffer.from([195,40])]])test('original '+label+' bytes are retained then rejected before parsing',async()=>{
 const reader=createEvonikOriginalReader({fetchImpl:async url=>responseAt(url,body)})
 try{await assert.rejects(reader.read(script.CAREERS_URL),authority);assert.equal(reader.stats().receipts[0].bytes,body.length);assert.equal(reader.stats().receipts[0].bodyComplete,true)}finally{reader.close()}
})
for(const options of [{redirected:true},{redirected:undefined,finalUrl:'https://other.example/'}])test('original redirect/final URL authority fails after one bounded observation',async()=>{
 const io=createEvonikReplay(),reader=createEvonikOriginalReader({fetchImpl:async(url,init)=>{const value=await io.fetchImpl(url,init);if(options.redirected)Object.defineProperty(value,'redirected',{value:true});else Object.defineProperty(value,'url',{value:options.finalUrl});return value}})
 try{await assert.rejects(reader.read(script.CAREERS_URL),authority);assert.equal(io.calls.length,1)}finally{reader.close()}
})
test('HTTP403 preserves primary status, original entity and cleanup hold without retry',async()=>{
 let reads=0;const body='Original public denial'
 await assert.rejects(()=>script.run({fetchImpl:async url=>{reads++;return responseAt(url,body,{status:403})}}),error=>{
  assert.equal(error.status,403);assert(authority(error));assert.equal(error.recruitmentObservations.receipts.length,1)
  assert.equal(Buffer.from(error.recruitmentObservations.receipts[0].bodyBase64,'base64').toString(),body);return true
 });assert.equal(reads,1)
})
test('HTTP403 remains primary when its bounded body cannot finish',async()=>{
 let cancelled=0
 await assert.rejects(()=>script.run({requestTimeoutMs:15,fetchImpl:async url=>responseAt(url,new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled++}}),{status:403})}),error=>{
  assert.equal(error.status,403);assert(authority(error));assert.equal(error.responseBodyError.name,'TimeoutError');assert.equal(error.recruitmentObservations.receipts[0].bodyComplete,false);return true
 });assert.equal(cancelled,1)
})
test('caller pre-abort is exact and launches zero reads',async()=>{
 const controller=new AbortController(),reason=Symbol('opaque-preabort');controller.abort(reason);let reads=0
 await assert.rejects(()=>script.run({signal:controller.signal,fetchImpl:async()=>{reads++}}),error=>error===reason);assert.equal(reads,0)
})
test('pending original headers preserve exact caller abort and dispose a late body',async()=>{
 const controller=new AbortController(),reason=Symbol('opaque-header'),calls=[];let resolve,cancelled=0
 const work=script.run({signal:controller.signal,fetchImpl:async(url,init)=>{calls.push({url,init});return new Promise(done=>resolve=done)}})
 await new Promise(done=>setImmediate(done));controller.abort(reason);await assert.rejects(work,error=>error===reason)
 resolve(responseAt(script.CAREERS_URL,new ReadableStream({cancel(){cancelled++}})))
 await new Promise(done=>setImmediate(done));assert.equal(calls.length,1);assert.equal(cancelled,1);assert.equal(calls[0].init.signal.reason,reason)
})
test('pending original body cancellation is exact and forbids continuation',async()=>{
 const controller=new AbortController(),reason=Symbol('opaque-body');let cancelled=0,reads=0
 const work=script.run({signal:controller.signal,fetchImpl:async url=>{reads++;return responseAt(url,new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled++}}))}})
 await new Promise(done=>setImmediate(done));controller.abort(reason);await assert.rejects(work,error=>error===reason);assert.equal(cancelled,1);assert.equal(reads,1)
})
test('opaque abort during the48th original read cannot return jobs or schedule another read',async()=>{
 const controller=new AbortController(),reason=Symbol('opaque-last-read'),io=createEvonikReplay((_bytes,_packet,_count,_call,calls)=>{if(calls.length===48)controller.abort(reason)})
 await assert.rejects(()=>withEvonikReplayClock(()=>script.run({signal:controller.signal,fetchImpl:io.fetchImpl,now:()=>NOW})),error=>error===reason);assert.equal(io.calls.length,48)
})
test('original request timeout is15s and disposes late headers under the unchanged source bound',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let resolve,cancelled=0,reads=0
 const reader=createEvonikOriginalReader({fetchImpl:async()=>{reads++;return new Promise(done=>resolve=done)}})
 try{const work=reader.read(script.CAREERS_URL);await new Promise(done=>setImmediate(done));t.mock.timers.tick(15000);await assert.rejects(work,error=>error.name==='TimeoutError');assert.equal(reader.stats().receipts[0].requestTimeoutMs,15000);resolve(responseAt(script.CAREERS_URL,new ReadableStream({cancel(){cancelled++}})));await new Promise(done=>setImmediate(done));assert.equal(reads,1);assert.equal(cancelled,1)}finally{reader.close()}
})
test('closing time and byte/read reserves reject insufficient acquisition without partial output',async()=>{
 for(const options of [{maxRequests:47},{maxTotalBytes:9437185}]){
  const io=createEvonikReplay();await assert.rejects(()=>withEvonikReplayClock(()=>script.run({...options,fetchImpl:io.fetchImpl,now:()=>NOW})),authority);assert(io.calls.length<24)
 }
})
test('intrinsic typed-array accounting ignores shadowed length/offset/buffer getters',async()=>{
 let getters=0;const bytes=Buffer.from(fixture.packets[0].bodyBase64,'base64'),chunk=new Uint8Array(bytes)
 for(const key of ['byteLength','byteOffset','buffer'])Object.defineProperty(chunk,key,{get(){getters++;throw Error('Shadow getter must not be called')}})
 const reader=createEvonikOriginalReader({fetchImpl:async url=>responseAt(url,new ReadableStream({start(sink){sink.enqueue(chunk);sink.close()}}))})
 try{const page=await reader.read(script.CAREERS_URL);assert(page.bytes.equals(bytes));assert.equal(getters,0);assert.equal(reader.stats().decodedBytes,bytes.length)}finally{reader.close()}
})
for(const[kind,size,url,body,mime]of [
 ['HTML',524289,script.CAREERS_URL,null,'text/html'],
 ['JSON',262145,'https://evonik.wd3.myworkdayjobs.com/wday/cxs/evonik/External_Careers/jobs','{"appliedFacets":{},"limit":20,"offset":0,"searchText":""}','application/json'],
])test(kind+' stream enforces its tighter per-kind bound before buffering oversized original entity',async()=>{
 const reader=createEvonikOriginalReader({fetchImpl:async requested=>responseAt(requested,Buffer.alloc(size,32),{mime})})
 try{await assert.rejects(reader.read(url,body),authority);assert.equal(reader.stats().receipts[0].bodyComplete,false)}finally{reader.close()}
})
test('unknown non-byte stream chunks fail with held inventory',async()=>{
 const reader=createEvonikOriginalReader({fetchImpl:async url=>responseAt(url,new ReadableStream({start(sink){sink.enqueue('not original bytes');sink.close()}}))})
 try{await assert.rejects(reader.read(script.CAREERS_URL),authority)}finally{reader.close()}
})
test('the source always keeps500ms per-origin pacing even when unrelated old delay options are zero',async()=>{
 const starts=[],io=createEvonikReplay(),reader=createEvonikOriginalReader({minIntervalMs:0,requestIntervalMs:0,fetchImpl:async(url,init)=>{starts.push(performance.now());return io.fetchImpl(url,init)}})
 try{await reader.read(script.CAREERS_URL);await reader.read(profile.seed.requestedUrl);assert(starts[1]-starts[0]>=500)}finally{reader.close()}
})
