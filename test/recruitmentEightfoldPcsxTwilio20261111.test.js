import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { decodeHTML,encodeHTML } from 'entities'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { declaredEightfoldPcsxTwilioRecruitment,readEightfoldPcsxTwilioRecruitment } from '../scraper-support/utils/recruitmentEightfoldPcsxTwilio.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-twilio-20261111.json.gz',import.meta.url))))
const fourRoleFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-twilio-four-role-20261111.json.gz',import.meta.url))))
const sixRoleFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-twilio-six-role-20261111.json.gz',import.meta.url))))
const defaultFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-twilio-default-20261111.json.gz',import.meta.url))))
const captures=new Map()
for(const row of fixture.responses){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256);assert.equal(row.contentType,row.headers['content-type']);captures.set(row.phase+':'+row.requestedURL,{...row,html:bytes.toString('utf8')})}
const url=label=>fixture.responses.find(row=>row.label===label).requestedURL
const HOME=url('corporate'),BOARD=url('board'),ENTRY=url('entry'),LAZY=url('roleRenderer'),PAGE0=url('selected0'),PAGE10=url('selected10'),JOB=url('roleAPI1'),ROLE=url('role1')
const config={source:'twilio',companyName:'Twilio',companyCareerPage:HOME}
const page=(phase,url)=>{const row=captures.get(phase+':'+url);return{url:row.finalURL,status:row.status,html:row.html}}
const descriptor=html=>declaredEightfoldPcsxTwilioRecruitment({...page('opening',BOARD),...(html?{html}:{})},config)
const mutateCarrier=(html,id,change)=>{const carrier=html.match(new RegExp('<code\\b[^>]*\\bid="'+id+'"[^>]*>[\\s\\S]*?<\\/code>'))[0],raw=carrier.match(/>([\s\S]*)<\/code>/)[1],value=JSON.parse(decodeHTML(raw));change(value);return html.replace(carrier,carrier.replace(raw,encodeHTML(JSON.stringify(value))))}
const mutatePost=(html,change)=>{const doc=readNativeDocument(html),node=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').find(node=>JSON.parse(node.raw)['@type']==='JobPosting'),value=JSON.parse(node.raw);change(value);return html.replace(node.raw,JSON.stringify(value))}
const nativeRows=fixture.proof.allOpeningNativeRows
const allowed=new Set(fixture.responses.map(row=>row.requestedURL))
for(const row of nativeRows){allowed.add('https://jobs.twilio.com'+row.positionUrl);allowed.add('https://jobs.twilio.com/api/pcsx/position_details?position_id='+row.id+'&domain=twilio.com&hl=en')}
const replay=({budget=22,maxPages=8,maxDetails=3,employer=true,mutate=(_,packet)=>packet,captureMap=captures}={})=>{
  const calls=[],counts=new Map([[HOME,1],[BOARD,1]]),jobs=[],records=[],inventories=[],unresolved=[]
  const initialPage=url=>{const row=captureMap.get('opening:'+url);return{url:row.finalURL,status:row.status,html:row.html}}
  const request=async(url,format)=>{
    assert(calls.length<budget,'Actual closing requests stay within the native budget')
    const count=(counts.get(url)||0)+1;counts.set(url,count);calls.push({url,count,format})
    const row=captureMap.get((count>1?'closing:':'opening:')+url)
    assert(row,'Uncaptured current endpoint; fixtures cannot manufacture a successful default subset: '+url)
    return mutate(url,{...row},count)
  }
  const readPage=async url=>{const row=await request(url,'page');return{url:row.finalURL,status:row.status,html:row.html}}
  const context={config,readPage,readRenderer:readPage,readNativeJson:async url=>{const row=await request(url,'raw-json');return{url:row.finalURL,status:row.status,text:row.html}},
    permit:url=>assert(allowed.has(url)||captureMap.has('opening:'+url),'Only exact declared public endpoints'),matchingEmployer:name=>employer&&name==='Twilio',
    addJob:job=>jobs.push(job),recordRead:row=>records.push(row),inventoryRead:row=>inventories.push(row),unresolved:value=>unresolved.push(value),
    maxPages,maxDetails,remainingRequests:()=>budget-calls.length,now:'2026-11-11T08:00:00.000Z',
    officialBinding:{officialURL:HOME,declaredURL:BOARD,page:initialPage(HOME)},recheckOfficialBinding:binding=>readPage(binding.officialURL)}
  return{jobs,records,inventories,unresolved,calls,context,run:()=>readEightfoldPcsxTwilioRecruitment(declaredEightfoldPcsxTwilioRecruitment(initialPage(BOARD),config),context)}
}

test('current Twilio declaration qualifies only the exact active source/account/carriers and renderer',()=>{
  const value=descriptor();assert.equal(value.kind,'eightfold-pcsx-twilio');assert.equal(value.source,'twilio');assert.equal(value.domain,'twilio.com');assert.equal(value.officialURL,HOME);assert.equal(value.entryURL,ENTRY);assert.equal(value.roleRendererURL,LAZY)
  assert.equal(declaredEightfoldPcsxTwilioRecruitment(page('opening',BOARD),{...config,source:'sendgrid'}),null)
  assert.equal(declaredEightfoldPcsxTwilioRecruitment(page('opening',HOME),config),null)
})

test('three real complete Twilio roles survive coherent native page2 and every closing proof without invented dates or mode',async()=>{
  const r=replay();await r.run();assert.deepEqual(r.jobs.map(job=>Number(job.id)),fixture.proof.roles.map(role=>role.roleID));assert.equal(r.calls.length,22)
  assert.equal(r.records.length,14);assert.equal(new Set(r.records.map(row=>row.id)).size,14)
  assert(r.calls.some(call=>call.url===PAGE10));assert(!r.calls.some(call=>call.url.includes('/overrides')))
  for(const job of r.jobs){
    const raw=job.record.originalNativeRole;assert(job.description.startsWith(raw.jobDescription+'\n'));assert.equal(job.employer.name,'Twilio');assert.equal(job.location,'Remote - India');assert.equal(job.country,'India')
    for(const perk of raw.positionExtraDetails.perks){assert(decodeHTML(job.description).includes(perk.title));assert(job.description.includes(perk.description))}
    assert.equal(job.posted,null);assert.equal(job.closing,null);assert.equal(job.remoteStatus,null);assert.equal(job.legalEmployer,null);assert.equal(job.sourcePublicationDateUnavailable,true);assert.equal(job.sourceRemoteStatusUnresolved,true)
    assert.equal(job.record.originalDateEvidence.nativePostedTs,0);assert.equal(job.record.firstEverPublication,null)
    assert.equal(job.record.nativeClosingContext.everySelectedRoleRechecked,true);assert.equal(job.record.nativeClosingContext.everySelectedListingPageRechecked,true);assert.equal(job.record.nativeClosingContext.currentPublisherHandoffRechecked,true)
    assert.equal(job.record.sourceScopeComplete,false);assert.equal(job.record.lifecycleCleanupAllowed,false);assert.equal(job.record.nativeListingEvidence.listingComplete,false)
    assert.equal(job.record.nativeListingEvidence.originalOpeningPages.length,2);assert.equal(job.record.nativeListingEvidence.originalClosingPages.length,2)
    assert.equal(job.record.originalPublishedRole.jobLocation.address.addressCountry.name,'IN')
    assert.deepEqual(job.record.originalPublishedRole.applicantLocationRequirements,[{'@type':'Country',name:'IN'}])
    assert.equal(job.record.originalPublishedRole.jobLocationType,'TELECOMMUTE')
  }
  const lastOpen=Math.max(...r.calls.map((call,i)=>call.count===1&&/position_details|\/careers\/job\//.test(call.url)?i:-1)),firstClose=r.calls.findIndex(call=>call.count===2&&/position_details/.test(call.url));assert(firstClose>lastOpen)
  assert(r.unresolved.some(value=>/partial|scope/.test(value)))
})

test('current whole native description is independently bound to actual active browser output',()=>{
  const proof=fixture.browserProof,bytes=Buffer.from(proof.renderedHTMLBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),proof.renderedHTMLSHA256)
  const rendered=readNativeDocument(bytes.toString('utf8')),nodes=rendered.nodes(node=>node.attrs.id==='job-description-container');assert.equal(nodes.length,1)
  const packet=captures.get('opening:'+proof.nativeAPIURL);assert.equal(packet.bodySHA256,proof.nativeAPISHA256)
  const native=readNativeDocument(JSON.parse(packet.html).data.jobDescription);assert.equal(rendered.text(nodes[0]),native.text(native.nodes(node=>node.tag==='root')[0]))
})

for(const[name,change]of[
  ['inactive renderer',html=>html.replace('src="/gen/js/pcsxPwa.','hidden src="/gen/js/pcsxPwa.')],
  ['nomodule renderer',html=>html.replace('src="/gen/js/pcsxPwa.','nomodule src="/gen/js/pcsxPwa.')],
  ['foreign account',html=>mutateCarrier(html,'pcsx-data',value=>{value.domain='foreign.example'})],
  ['foreign branding',html=>mutateCarrier(html,'branding-data',value=>{value.domain='foreign.example'})],
  ['new current override branch',html=>mutateCarrier(html,'pcsx-data',value=>{value.configs.pcsxConfig.overrides=['position']})],
  ['changed company condition',html=>mutateCarrier(html,'pcsx-data',value=>{value.configs.pcsxConfig.positionDetailsConfig.sectionsConfig.perks.items[0].description+=' A new mandatory condition.'})],
  ['CSS-hidden active mount',html=>html.replace('</head>','<style>#pcsx{display:none!important}</style></head>')],
  ['hidden account carrier ancestor',html=>html.replace('<code id="pcsx-data"','<div hidden><code id="pcsx-data"').replace('</code>','</code></div>')],
])test('descriptor withholds '+name,()=>{const original=page('opening',BOARD).html,changed=change(original);assert.notEqual(changed,original);assert.throws(()=>descriptor(changed),/Twilio|Eightfold|renderer|config|mount|carrier|mode|account|ancestor/i)})

for(const[name,target,change]of[
  ['own foreign employer',ROLE,value=>{value.hiringOrganization.name='Foreign Employer'}],
  ['own foreign account',ROLE,value=>{value.hiringOrganization.sameAs='foreign.example'}],
  ['own country disagreement',ROLE,value=>{value.jobLocation.address.addressCountry.name='US'}],
  ['contradictory country object',ROLE,value=>{value.jobLocation.address.addressCountry.identifier='US'}],
  ['contradictory applicant country',ROLE,value=>{value.applicantLocationRequirements[0].name='US'}],
  ['contradictory applicant country object',ROLE,value=>{value.applicantLocationRequirements[0].identifier='US'}],
  ['new own criterion',ROLE,value=>{value.qualifications='A new mandatory certification.'}],
  ['own full criterion changed',ROLE,value=>{value.description+=' A new mandatory certification.'}],
  ['own nonremote label contradiction',ROLE,value=>{value.jobLocationType='ON_SITE'}],
])test('own published proof withholds '+name,async()=>{const r=replay({mutate:(url,packet)=>url===target?{...packet,html:mutatePost(packet.html,change)}:packet});await assert.rejects(r.run(),/Twilio|country|employer|criteria|account|mode|location/i);assert.equal(r.jobs.length,0)})

for(const[name,target,change]of[
  ['native country label',JOB,value=>{value.data.location='Boston, United States'}],
  ['native country code',JOB,value=>{value.data.standardizedLocations=['US']}],
  ['native mixed geography',JOB,value=>{value.data.locations.push('Boston, United States');value.data.standardizedLocations.push('US')}],
  ['blank full criteria',JOB,value=>{value.data.jobDescription=''}],
  ['native full punctuation change',JOB,value=>{value.data.jobDescription=value.data.jobDescription.replace('Twilio','TWILIO')}],
  ['new full native field',JOB,value=>{value.data.mandatoryQualification='A new mandatory certification.'}],
  ['changed company condition',JOB,value=>{value.data.positionExtraDetails.perks[0].description+=' Mandatory certification.'}],
  ['new supplemental content',JOB,value=>{value.data.positionExtraDetails.customContent=[{description:'A new mandatory condition.'}]}],
  ['foreign apply URL',JOB,value=>{value.data.positionUserActions.applyAction.url='https://foreign.example/apply'}],
  ['closed role',JOB,value=>{value.data.positionUserActions.applyAction.status='blocked'}],
  ['fallback metadata',JOB,value=>{value.metadata={isFallback:true}}],
  ['duplicate native page ID',PAGE10,value=>{value.data.positions[0]=JSON.parse(captures.get('opening:'+PAGE0).html).data.positions[0]}],
  ['ignored native page offset',PAGE10,value=>{value.data.positions=JSON.parse(captures.get('opening:'+PAGE0).html).data.positions}],
  ['inconsistent native count',PAGE10,value=>{value.data.count++}],
])test('native proof withholds '+name,async()=>{const r=replay({mutate:(url,packet)=>{if(url!==target)return packet;const value=JSON.parse(packet.html);change(value);return{...packet,html:JSON.stringify(value)}}});await assert.rejects(r.run(),/Twilio|country|native|criteria|scope|page|field|offset|count|action|metadata/i);assert.equal(r.jobs.length,0)})

for(const[name,target,change]of[
  ['selected role missing across both native pages',PAGE0,html=>{const value=JSON.parse(html);value.data.positions[0]={...value.data.positions[0],id:999,positionUrl:'/careers/job/999'};return JSON.stringify(value)}],
  ['selected native field changes',PAGE0,html=>{const value=JSON.parse(html);value.data.positions[0].postedTs++;return JSON.stringify(value)}],
  ['own role criteria',JOB,html=>{const value=JSON.parse(html);value.data.jobDescription+='<p>New mandatory condition.</p>';return JSON.stringify(value)}],
  ['own schema country',ROLE,html=>mutatePost(html,value=>{value.jobLocation.address.addressCountry.name='US'})],
  ['corporate handoff',HOME,html=>html.replaceAll(BOARD,'https://foreign.example/careers')],
  ['native carrier',BOARD,html=>mutateCarrier(html,'pcsx-data',value=>{value.domain='foreign.example'})],
  ['entry renderer',ENTRY,html=>html+'\n// changed'],
  ['full renderer',LAZY,html=>html+'\n// changed'],
])test('closing '+name+' withholds every staged role',async()=>{const r=replay({mutate:(url,packet,count)=>url===target&&count===2?{...packet,html:change(packet.html)}:packet});await assert.rejects(r.run(),/Twilio|closing|country|criteria|account|carrier|renderer|handoff|fields/i);assert.equal(r.jobs.length,0)})

test('duplicate raw native role identity cannot be erased before validation',async()=>{const r=replay({mutate:(url,packet)=>url===JOB?{...packet,html:packet.html.replace(/"id":\s*1099556746356/,'"id":999,"\\u0069d":1099556746356')}:packet});await assert.rejects(r.run(),/duplicate/i);assert.equal(r.jobs.length,0)})
test('unknown native employer never acquires original Twilio authority',async()=>{const r=replay({employer:false});await assert.rejects(r.run(),/employer|binding/i);assert.equal(r.jobs.length,0)})
test('insufficient reserve retains real inventory without a fabricated empty success',async()=>{const r=replay({budget:13});await r.run();assert.equal(r.jobs.length,0);assert.equal(r.records.length,14);assert(r.unresolved.some(value=>/budget|reserve/.test(value)));assert(r.inventories.every(row=>row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false))})
test('one-page configured bound is honored with partial source scope',async()=>{const r=replay({maxPages:1,maxDetails:1,budget:12});await r.run();assert.equal(r.jobs.length,1);assert.equal(r.calls.length,12);assert.equal(r.records.length,10);assert(!r.calls.some(call=>call.url===PAGE10));assert(r.unresolved.some(value=>/partial|scope|pagination/.test(value)))})
test('normal request defaults attempt a real fourth role instead of capping at the three fixture-proved roles',async()=>{const r=replay({budget:46,maxDetails:20});await assert.rejects(r.run(),/Uncaptured current endpoint/);const fourth=nativeRows[3];assert(r.calls.some(call=>call.url.includes('position_id='+fourth.id)));assert.equal(r.jobs.length,0)})

test('a controlled move of genuine selected rows between closing native pages retains full selected proof and raw page drift',async()=>{
  const packets=new Map([PAGE0,PAGE10].map(url=>[url,JSON.parse(captures.get('closing:'+url).html)]))
  const first=packets.get(PAGE0).data.positions,last=packets.get(PAGE10).data.positions
  ;[first[0],last[0]]=[last[0],first[0]]
  const r=replay({mutate:(url,packet,count)=>count===2&&packets.has(url)?{...packet,html:JSON.stringify(packets.get(url))}:packet})
  await r.run();assert.equal(r.jobs.length,3);assert.equal(r.records.length,14)
  for(const job of r.jobs){assert.equal(job.record.nativeListingEvidence.unselectedInventoryDrift.orderChanged,true);assert.equal(job.record.sourceScopeComplete,false);assert.equal(job.record.lifecycleCleanupAllowed,false)}
  assert(JSON.parse(r.jobs[0].record.nativeListingEvidence.originalClosingPages[1].rawJSON).data.positions.some(row=>String(row.id)===r.jobs[0].id))
})
for(const field of ['name','workLocationOption','creationTs','solrScore','efcustomTextDepartmentObject'])test('every selected closing listing field stays exact: '+field,async()=>{
  const r=replay({mutate:(url,packet,count)=>{if(url!==PAGE0||count!==2)return packet;const value=JSON.parse(packet.html),row=value.data.positions[0];row[field]=typeof row[field]==='number'?row[field]+1:typeof row[field]==='string'?row[field]+' changed':['changed'];return{...packet,html:JSON.stringify(value)}}})
  await assert.rejects(r.run(),/closing selected|native country/i);assert.equal(r.jobs.length,0)
})
test('a city-only remote label stays an unresolved observation while the next genuinely qualified role succeeds',async()=>{
  const r=replay({budget:14,maxDetails:1,mutate:(url,packet)=>{
    if(url!==PAGE0&&url!==PAGE10)return packet
    const value=JSON.parse(packet.html),row=value.data.positions.find(row=>row.id===1099556746356)
    if(row)row.locations=['Remote - Hyderabad']
    return{...packet,html:JSON.stringify(value)}
  }})
  await r.run();assert.equal(r.jobs.length,1);assert.equal(r.jobs[0].id,'1099556883308');assert(r.unresolved.some(value=>/country-scope-unresolved/.test(value)));assert.deepEqual(r.records.find(row=>row.id===1099556746356).locations,['Remote - Hyderabad'])
})

const fourRoleMap=()=>new Map(fourRoleFixture.responses.map(row=>{const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256);assert.equal(row.contentType,row.headers['content-type']);return[row.phase+':'+row.requestedURL,{...row,html:bytes.toString('utf8')}]}))
const HR_JOB='https://jobs.twilio.com/api/pcsx/position_details?position_id=1099556432090&domain=twilio.com&hl=en',HR_ROLE='https://jobs.twilio.com/careers/job/1099556432090'
test('actual HR Partner keeps its country-level native header, separate Bengaluru address and exact five-state restriction through all closing checks',async()=>{
  const r=replay({captureMap:fourRoleMap(),budget:26,maxDetails:4});await r.run();assert.equal(r.jobs.length,4);assert.equal(r.calls.length,26)
  const hr=r.jobs.find(job=>job.id==='1099556432090');assert.equal(hr.location,'Remote - India');assert.equal(hr.country,'India');assert.equal(hr.remoteStatus,null)
  assert.equal(hr.record.originalPublishedRole.jobLocation.length,2)
  assert.deepEqual(hr.record.nativeLocationRepresentations.additionalOwnSchemaLocations,[fourRoleFixture.proof.additionalOwnSchemaAddress])
  assert.equal(hr.record.nativeLocationRepresentations.additionalAddressRelationshipToRemoteEligibility,'unqualified')
  assert.equal(hr.record.nativeLocationRepresentations.allLocationRepresentationsIdentical,false)
  assert.equal(hr.record.nativeLocationRepresentations.allIndiaEligibilityVerified,false)
  const doc=readNativeDocument(hr.description);assert(doc.text(doc.nodes(node=>node.tag==='root')[0]).includes(fourRoleFixture.proof.exactStateRestriction))
  assert(hr.description.startsWith(hr.record.originalNativeRole.jobDescription+'\n'));assert.equal(hr.record.sourceScopeComplete,false);assert.equal(hr.record.lifecycleCleanupAllowed,false)
})
for(const[name,change]of[
  ['additional foreign country',post=>{post.jobLocation[1].address.addressCountry.name='US'}],
  ['additional contradictory country object',post=>{post.jobLocation[1].address.addressCountry.identifier='US'}],
  ['unknown additional city',post=>{post.jobLocation[1].address.addressLocality='Mumbai'}],
  ['unknown additional region',post=>{post.jobLocation[1].address.addressRegion='MH,IN'}],
  ['third authored address',post=>{post.jobLocation.push(structuredClone(post.jobLocation[1]))}],
  ['missing country-level own address',post=>{post.jobLocation.shift()}],
])test('HR same-country variant still holds '+name,async()=>{
  const r=replay({captureMap:fourRoleMap(),budget:26,maxDetails:4,mutate:(url,packet)=>url===HR_ROLE?{...packet,html:mutatePost(packet.html,change)}:packet})
  await assert.rejects(r.run(),/Twilio|country|address|location/i);assert.equal(r.jobs.length,0)
})
test('the complete published five-state eligibility criterion cannot be erased from the native HR primary description',async()=>{
  const r=replay({captureMap:fourRoleMap(),budget:26,maxDetails:4,mutate:(url,packet)=>{
    if(url!==HR_JOB)return packet
    const value=JSON.parse(packet.html),before=value.data.jobDescription;value.data.jobDescription=before.replace('Karnataka','Kerala');assert.notEqual(value.data.jobDescription,before);return{...packet,html:JSON.stringify(value)}
  }})
  await assert.rejects(r.run(),/complete native\/published criteria differ/);assert.equal(r.jobs.length,0)
})

const sixRoleMap=()=>new Map(sixRoleFixture.responses.map(row=>{const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256);assert.equal(row.contentType,row.headers['content-type']);return[row.phase+':'+row.requestedURL,{...row,html:bytes.toString('utf8')}]}))
const APPS_JOB='https://jobs.twilio.com/api/pcsx/position_details?position_id=1099552854135&domain=twilio.com&hl=en',APPS_ROLE='https://jobs.twilio.com/careers/job/1099552854135'

test('actual six-role interval preserves literal state angles and the complete published plain-text tail instead of reparsing it as HTML',async()=>{
  const map=sixRoleMap(),packet=map.get('opening:'+APPS_ROLE),doc=readNativeDocument(packet.html),post=JSON.parse(doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').find(node=>JSON.parse(node.raw)['@type']==='JobPosting').raw)
  assert(post.description.includes(sixRoleFixture.proof.exactLiteralStateRestriction));assert(post.description.includes('Travel'));assert(post.description.includes('What We Offer'))
  const incorrectlyParsed=readNativeDocument(post.description);assert(incorrectlyParsed.text(incorrectlyParsed.nodes(node=>node.tag==='root')[0]).length<post.description.length-400,'Acquired packet reproduces the actual HTML-parser truncation')
  const r=replay({captureMap:map,budget:34,maxDetails:6});await r.run();assert.deepEqual(r.jobs.map(job=>Number(job.id)),sixRoleFixture.proof.roles.map(role=>role.roleID));assert.equal(r.calls.length,34)
  const apps=r.jobs.find(job=>job.id==='1099552854135');assert.equal(apps.record.originalPublishedRole.description,post.description)
  assert(apps.description.startsWith(apps.record.originalNativeRole.jobDescription+'\n'));assert(apps.description.includes('India &lt;Karnataka, Tamil Nadu, Telangana State, Maharashtra and New Delhi&gt;.'))
  assert(apps.description.includes('We prioritize connection'));assert(apps.description.includes('What We Offer'))
  for(const perk of apps.record.originalNativeRole.positionExtraDetails.perks){assert(decodeHTML(apps.description).includes(perk.title));assert(apps.description.includes(perk.description))}
  for(const job of r.jobs){assert.equal(job.location,'Remote - India');assert.equal(job.country,'India');assert.equal(job.posted,null);assert.equal(job.remoteStatus,null);assert.equal(job.record.lifecycleCleanupAllowed,false);assert.equal(job.record.nativeClosingContext.everySelectedRoleRechecked,true)}
})
for(const[name,change]of[
  ['a changed literal state',post=>{post.description=post.description.replace('India <Karnataka','India <Kerala')}],
  ['changed angle punctuation',post=>{post.description=post.description.replace('India <Karnataka','India [Karnataka')}],
  ['markup-bearing published description',post=>{post.description='<p>'+post.description+'</p>'}],
  ['a missing authored tail',post=>{post.description=post.description.slice(0,post.description.indexOf('Travel'))}],
])test('published plain-text equality holds '+name,async()=>{
  const r=replay({captureMap:sixRoleMap(),budget:34,maxDetails:6,mutate:(url,packet)=>url===APPS_ROLE?{...packet,html:mutatePost(packet.html,post=>{const before=post.description;change(post);assert.notEqual(post.description,before)})}:packet})
  await assert.rejects(r.run(),/complete native\/published criteria differ/);assert.equal(r.jobs.length,0)
})
test('six-role closing cannot change the native literal state restriction after all opening proofs',async()=>{
  const r=replay({captureMap:sixRoleMap(),budget:34,maxDetails:6,mutate:(url,packet,count)=>{if(url!==APPS_JOB||count!==2)return packet;const value=JSON.parse(packet.html);value.data.jobDescription=value.data.jobDescription.replace('India &lt;Karnataka','India &lt;Kerala');return{...packet,html:JSON.stringify(value)}}})
  await assert.rejects(r.run(),/criteria differ|closing own role/);assert.equal(r.jobs.length,0)
})

test('actual uncapped normal defaults close all nine selected roles and both native pages within the genuine46-native/48-total allowance',async()=>{
  const map=new Map(defaultFixture.responses.map(row=>{const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256);assert.equal(row.contentType,row.headers['content-type']);return[row.phase+':'+row.requestedURL,{...row,html:bytes.toString('utf8')}]}))
  const r=replay({captureMap:map,budget:46});delete r.context.maxPages;delete r.context.maxDetails
  await r.run();assert.equal(r.calls.length,46);assert.equal(defaultFixture.responses.length,48);assert.equal(r.jobs.length,9);assert.equal(r.records.length,14)
  assert.deepEqual(r.jobs.map(job=>Number(job.id)),defaultFixture.proof.roles.map(role=>role.roleID));assert.equal(new Set(r.records.map(row=>row.id)).size,14)
  assert.equal(r.calls.filter(call=>call.url===PAGE0).length,2);assert.equal(r.calls.filter(call=>call.url===PAGE10).length,2);assert(!r.calls.some(call=>call.url.includes('/overrides')))
  const lastOwnOpen=Math.max(...r.calls.map((call,index)=>call.count===1&&/position_details|\/careers\/job\//.test(call.url)?index:-1)),firstOwnClose=r.calls.findIndex(call=>call.count===2&&/position_details/.test(call.url));assert(firstOwnClose>lastOwnOpen)
  for(const job of r.jobs){
    const raw=JSON.parse(map.get('opening:https://jobs.twilio.com/api/pcsx/position_details?position_id='+job.id+'&domain=twilio.com&hl=en').html).data
    assert.deepEqual(job.record.originalNativeRole,raw);assert(job.description.startsWith(raw.jobDescription+'\n'));assert.equal(raw.positionExtraDetails.perks.length,4)
    for(const perk of raw.positionExtraDetails.perks){assert(decodeHTML(job.description).includes(perk.title));assert(job.description.includes(perk.description))}
    assert.equal(job.employer.name,'Twilio');assert.equal(job.country,'India');assert.equal(job.location,'Remote - India');assert.equal(job.posted,null);assert.equal(job.closing,null);assert.equal(job.remoteStatus,null);assert.equal(job.legalEmployer,null)
    assert.equal(job.sourcePublicationDateUnavailable,true);assert.equal(job.sourceRemoteStatusUnresolved,true);assert.equal(job.record.firstEverPublication,null);assert.equal(job.record.nativeLocationRepresentations.allIndiaEligibilityVerified,false)
    assert.equal(job.record.nativeListingEvidence.originalOpeningPages.length,2);assert.equal(job.record.nativeListingEvidence.originalClosingPages.length,2);assert.equal(job.record.nativeListingEvidence.listingComplete,false)
    assert.equal(job.record.sourceScopeComplete,false);assert.equal(job.record.lifecycleCleanupAllowed,false)
    for(const key of ['everySelectedRoleRechecked','everySelectedListingPageRechecked','currentPublisherHandoffRechecked','nativeBoardRechecked','renderersRechecked'])assert.equal(job.record.nativeClosingContext[key],true)
  }
  assert.equal(r.jobs.find(job=>job.id==='1099552854135').record.originalPublishedRole.description.includes('India <Karnataka, Tamil Nadu, Telangana State, Maharashtra and New Delhi>.'),true)
  assert(r.unresolved.includes('native-twilio-detail-budget-closing-reserve'))
})

for(const[name,change]of[
  ['SVG namespace',tag=>'<svg>'+tag+'</svg>'],
  ['MathML namespace',tag=>'<math>'+tag+'</math>'],
  ['empty src attribute',tag=>tag.replace('<script','<script src=""')],
  ['external src attribute',tag=>tag.replace('<script','<script src="https://unqualified.example/schema.json"')],
])test('published carrier withholds '+name,async()=>{
  const r=replay({captureMap:fourRoleMap(),budget:26,maxDetails:4,mutate:(url,packet)=>{
    if(url!==ROLE)return packet
    let altered=0
    const html=packet.html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,tag=>{
      const value=JSON.parse(tag.match(/>([\s\S]*)<\/script>/i)[1]);if(value['@type']!=='JobPosting')return tag
      altered++;return change(tag)
    })
    assert.equal(altered,1,'Mutate the unique actual own-role carrier');assert.notEqual(html,packet.html);return{...packet,html}
  }})
  await assert.rejects(r.run(),/published role unavailable|carrier|namespace|inline/i);assert.equal(r.jobs.length,0)
})
