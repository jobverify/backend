import assert from'node:assert/strict';import test from'node:test';import{readFileSync}from'node:fs';import{gunzipSync}from'node:zlib'
import{run}from'./script.js';import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{readInventory,readAdvert,parsePublishedPostCriteria,VACANCIES}from'./advertisements.js';import{readPublishedPdf}from'../cdot/pdfDocument.js'
globalThis.fetch=async()=>{throw Error('OFFLINE ARCI native fixture network tripwire')}
const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
async function replay(change=()=>{},options={}){const pages=new Map(packets.flatMap(row=>[[row.requestedUrl,row],[row.url,row]])),calls=[],visits=new Map();let audit;const jobs=await run({...options,fetchPage:async(url,request)=>{const page=structuredClone(pages.get(url));assert.ok(page,'declared native URL '+url);calls.push(url);const visit=(visits.get(url)||0)+1;visits.set(url,visit);change(page,{url,visit,pages,calls});return page},onAudit:value=>{audit=value}});return{jobs,audit,calls}}
test('ARCI extracts all seven full native public post criteria and only explicitly bound India offices',async()=>{const{jobs,audit,calls}=await replay();assert.equal(audit.observedDetails.length,7);assert.equal(audit.candidatePostTypes,7);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceNativePostCode,'AA001');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,null);assert.equal(jobs[0].sourceNativeNumberOfPosts,6);assert.equal(jobs[0].sourceNativeIndiaPositions,6);assert.equal(jobs[0].postingDate,'2026-10-22');assert.equal(jobs[0].closingDate,'2026-11-21');assert.equal(jobs[0].sourcePostingDatePrecision,'date-only');assert.equal(jobs[0].requisitionId,null);assert.ok(jobs[0].jobDescription.includes('ASSISTANT'));assert.ok(jobs[0].jobDescription.includes('Computer'));assert.ok(audit.observedDetails.every(row=>row.jobDescription.length>1500));assert.equal(audit.observedDetails.filter(row=>row.sourceCountryScopeUnresolved).length,6);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(audit.currentPublishedPdfDocuments.length,3);assert.ok(!calls.some(url=>/\/member\/|application|Instructions/.test(url)));assert.ok(calls.findLastIndex(url=>url.includes('/organization/locations-'))>calls.findLastIndex(url=>/\.pdf$/.test(url)))})
test('ARCI retains each role own criteria and selection rather than borrowing other posts qualifications',async()=>{const{jobs,audit}=await replay();const assistant=jobs[0];assert.ok(assistant.jobDescription.includes('AA001'));assert.ok(assistant.jobDescription.includes('6 of 7')===false);assert.ok(!assistant.sourceNativeOwnPostMain.includes('SB001'));assert.ok(!assistant.sourceNativeOwnPostMain.includes('Driver'));const scientist=audit.observedDetails.find(row=>row.sourceNativePostCode==='SB001');assert.ok(scientist.sourceNativeOwnSelection.includes('SB001'));assert.ok(!scientist.sourceNativeOwnSelection.includes('DA001'))})
test('ARCI institutional India and nationality cannot replace missing role-bound office countries',async()=>{const{jobs,audit}=await replay((page,{url})=>{if(url.includes('/organization/locations-'))page.html=page.html.replaceAll(', India.',', Unresolvedland.')});assert.equal(jobs.length,0);assert.equal(audit.observedDetails.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('ARCI preserves one independently proven India workplace when another office is unknown',async()=>{let changed=0;const{jobs}=await replay((page,{url})=>{if(url.includes('/organization/locations-')){const before=page.html;page.html=page.html.replaceAll('Haryana, India.','Haryana, Unresolvedland.');assert.notEqual(page.html,before);changed++}});assert.equal(changed,3);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceNativeIndiaPositions,5);assert.equal(jobs[0].city,'Hyderabad');assert.equal(jobs[0].sourceNativeOtherWorksitesUnresolved,true)})
test('ARCI first public denial stops without browser or member-session fallback',async()=>{let calls=0;await assert.rejects(run({fetchPage:async url=>{calls++;return{status:403,url,html:'Denied'}}}),/403|denied/i);assert.equal(calls,1)})
test('ARCI ignoring reader observes caller cancellation reason',async()=>{const controller=new AbortController(),reason={stop:'arci'};const task=run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})});setTimeout(()=>controller.abort(reason),10);await assert.rejects(Promise.race([task,new Promise((_,reject)=>setTimeout(()=>reject(Error('did not settle')),300))]),error=>error===reason)})

test('ARCI preserves every explicit country alternative within an office address',async()=>{
 const {jobs,audit}=await replay((page,{url})=>{if(url.includes('/organization/locations-')){const before=page.html;page.html=page.html.replaceAll('Telangana, India.','Telangana, United States, India.').replaceAll('Haryana, India.','Haryana, United States, India.');assert.notEqual(page.html,before)}})
 assert.equal(jobs.length,0)
 assert.deepEqual(audit.finalWorksites.Hyderabad.nativeCountryAlternatives,['United States','India'])
 assert.equal(audit.observedDetails.length,7)
})

test('ARCI final advertisement membership is checked after every closing public PDF',async()=>{
 const {jobs,audit,calls}=await replay((page,{url,visit})=>{if(url==='https://arci.res.in/careers/vacancies'&&visit===3){const link=page.html.indexOf('/careers/vacancies/recruitment-scientific-technical-administrative-and-support-staff'),start=page.html.lastIndexOf('<div class="career-card ',link);assert.ok(link>start&&start>0);page.html=page.html.slice(0,start)+page.html.slice(start).replace('<div class="career-card ','<div hidden class="career-card ')}})
 assert.equal(jobs.length,0)
 assert.equal(audit.closingInventoryMatches,false)
 assert.ok(audit.failures.some(row=>row.stage==='final-native-inventory'))
 assert.ok(calls.lastIndexOf('https://arci.res.in/careers/vacancies')>calls.findLastIndex(url=>/\.pdf$/.test(url)))
})

test('ARCI malformed public PDF keeps known post candidates without manufacturing complete criteria',async()=>{
 const {jobs,audit}=await replay((page,{url})=>{if(/Rect_1_2026\.pdf$/.test(url)){delete page.bodyBase64;page.html='%PDF-damaged native response'}})
 assert.equal(jobs.length,0)
 assert.equal(audit.observedDetails.length,7)
 assert.equal(audit.observedDetails.filter(row=>!row.sourceDetailComplete).length,6)
 assert.ok(audit.failures.some(row=>row.kind==='native-public-document-criteria-unqualified'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('ARCI stalled observers remain source bounded and pre-aborted callers make no reads',async()=>{
 let reads=0;const controller=new AbortController(),reason=Error('already stopped');controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,fetchPage:()=>{reads++;throw Error('unreachable')}}),error=>error===reason)
 assert.equal(reads,0)
 await assert.rejects(replay(()=>{},{timeoutMs:40,onResponse:()=>new Promise(()=>{})}),/timeout|aborted/i)
})

test('ARCI response-observer failures remain the original failure rather than becoming missing native criteria',async()=>{
 const reason=Error('observer rejected native PDF receipt')
 await assert.rejects(replay(()=>{},{onResponse:packet=>{if(/\.pdf$/.test(packet.url))throw reason}}),error=>error===reason)
})

test('ARCI changed or misplaced native role-table header cannot copy other roles criteria into every description',async()=>{
 const packet=url=>packets.find(row=>row.url===url||row.requestedUrl===url),html=url=>packet(url).html
 const advert=readInventory(html(VACANCIES)).map(row=>readAdvert(html(row.url),row)).find(row=>row.roleRows.length>1)
 const load=url=>readPublishedPdf(Buffer.from(packet(url).bodyBase64,'base64')),main=await load(advert.mainPdf.url),terms=await load(advert.termsPdf.url),baseline=parsePublishedPostCriteria(advert,main,terms)
 for(const row of baseline)assert.equal(baseline.filter(other=>other.sourceNativePostCode!==row.sourceNativePostCode&&row.jobDescription.includes(other.sourceNativeOwnPostMain)).length,0)
 const marker='Sl.\nNo.';assert.ok(main.text.includes(marker))
 const changed=structuredClone(main);changed.text=changed.text.replace(marker,'Serial\nNumber');for(const page of changed.pages)page.text=page.text.replace(marker,'Serial\nNumber')
 assert.throws(()=>parsePublishedPostCriteria(advert,changed,terms),/native.*(?:header|criteria|role table)/i)
 const misplaced=structuredClone(main);misplaced.text=misplaced.text.replace(marker,'Serial\nNumber').replace('Post Code : OB001',marker+'\nPost Code : OB001');assert.ok(misplaced.text.indexOf(marker)>misplaced.text.indexOf('Post Code : SB001'))
 assert.throws(()=>parsePublishedPostCriteria(advert,misplaced,terms),/native.*(?:header|criteria|role table)/i)
})

test('ARCI correctly binds the native merged CWE cell to all three labelled rows without borrowing Driver hours',async()=>{
 const packet=url=>packets.find(row=>row.url===url||row.requestedUrl===url),html=url=>packet(url).html
 const advert=readInventory(html(VACANCIES)).map(row=>readAdvert(html(row.url),row)).find(row=>row.roleRows.length>1),load=url=>readPublishedPdf(Buffer.from(packet(url).bodyBase64,'base64')),main=await load(advert.mainPdf.url),terms=await load(advert.termsPdf.url),roles=parsePublishedPostCriteria(advert,main,terms)
 for(const code of['TA001','AA001','TC001']){const job=roles.find(row=>row.sourceNativePostCode===code);assert.match(job.sourceNativeOwnSchedule,/23\s+rd\s+December 2026/);assert.match(job.sourceNativeOwnSchedule,/0900 to 1200 hours/);assert.ok(job.sourceNativeCompleteSchedule.text.includes('Tentative Schedule'));assert.equal(job.sourceNativeCompleteSchedule.page,16);assert.equal(job.sourceNativeScheduleBinding.sharedCwePostCodes.join(','),'TA001,AA001,TC001')}
 const driver=roles.find(row=>row.sourceNativePostCode==='DA001');assert.match(driver.sourceNativeOwnSchedule,/0900 to 1100 hours/);assert.doesNotMatch(driver.sourceNativeOwnSchedule,/0900 to 1200 hours/)
 const displaced=structuredClone(main),page=displaced.pages.at(-1);let changed=0;for(const item of page.items)if(item.x>=233&&item.x<333&&item.y>=438&&item.y<=555){item.y-=220;changed++}assert.ok(changed>0)
 assert.throws(()=>parsePublishedPostCriteria(advert,displaced,terms),/native.*schedule/i)
})
