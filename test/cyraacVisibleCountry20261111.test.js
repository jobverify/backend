import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {extractJobCards,readNativeRole} from '../scraper/cyraac/nativeRole.js'
import {createCyraacScraper} from '../scraper/cyraac/native.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/cyraac-current-header-20261111.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const ownURL='https://cyraacs.com/job-description-technical-architect/'
const listing=extractJobCards(fixture.packets[0].bodyText).find(row=>row.sourceUrl===ownURL)
const opening=fixture.packets[1],closing=fixture.packets[2],clock=closing.completedAt

test('CYRAACS acquired current component packets retain exact URLs, bytes and a genuinely declared own role',()=>{
 assert.equal(fixture.fullCollectionTransaction,false)
 assert.equal(listing.title,'Technical Architect')
 assert.equal(opening.requestedURL,ownURL);assert.equal(closing.requestedURL,ownURL)
 for(const packet of fixture.packets){assert.equal(sha(packet.bodyText),packet.bodySHA256);assert.equal(Buffer.byteLength(packet.bodyText),packet.bodyBytes);assert.equal(packet.status,200)}
 assert.ok(opening.bodyText.includes('<span class="elementor-icon-list-text">Bangalor/ India/Full-time</span>'))
 assert.notEqual(opening.bodySHA256,closing.bodySHA256)
})

test('CYRAACS current title-bound own header supplies literal India without JobPosting fabrication',()=>{
 const job=readNativeRole(listing,opening.bodyText,clock)
 assert.equal(job.nativeSourceRecord.jobPostings.length,0)
 assert.equal(job.country,'India')
})

const header='<span class="elementor-icon-list-text">Bangalor/ India/Full-time</span>'
const title='<h1 class="elementor-heading-title elementor-size-default">Technical Architect</h1>'
const replace=(html,from,to)=>{assert.equal(html.split(from).length,2,'Mutation must bind exactly one actual fragment');const changed=html.replace(from,to);assert.notEqual(changed,html);return changed}
const addLD=(html,value)=>replace(html,'</head>','<script type="application/ld+json">'+value+'</script></head>')
const hold=(html,selected=listing)=>{
 let job
 try{job=readNativeRole(selected,html,clock)}catch(error){assert.equal(error.code,'CYRAAC_NATIVE_PROOF');return}
 assert.notEqual(job.country,'India','A synthetic unqualified own declaration must not supply India')
}

test('CYRAACS header positive preserves complete original text, literal spelling and all partial-proof caveats',()=>{
 const job=readNativeRole(listing,opening.bodyText,clock),oldText=job.nativeSourceRecord.ownRoleText
 assert.equal(job.country,'India');assert.equal(job.city,null);assert.equal(job.state,null)
 assert.equal(job.location,'Bangalor/ India');assert.equal(job.employmentType,'Full-time')
 assert.equal(job.remoteStatus,null);assert.equal(job.sourceRemoteStatusUnresolved,true)
 assert.equal(job.sourcePublicationDateUnavailable,true)
 assert.equal(job.postingDate,null);assert.equal(job.postedAt,null);assert.equal(job.closingDate,null);assert.equal(job.firstEverPublication,null)
 assert.equal(job.legalEmployer,null);assert.equal(job.nativeHiringOrganization,null)
 assert.equal(job.sourceRawNativeHTML,opening.bodyText);assert.equal(job.sourceRawNativeHTMLSHA256,opening.bodySHA256)
 assert.equal(job.sourceDescription,oldText);assert.equal(job.jobDescription,oldText)
 assert.equal(job.nativeSourceRecord.ownHeaderCountry.rawHTML,header)
 assert.equal(job.nativeSourceRecord.ownHeaderCountry.originalText,'Bangalor/ India/Full-time')
 assert.equal(job.nativeSourceRecord.ownHeaderCountry.cityAliasInferred,false)
 assert.deepEqual(job.sourceNativeProofGaps,['native-whole-criteria-container-unverified'])
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailStatus,'partial')
 assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(job.applicationVisited,false);assert.equal(job.activeApplyVerified,false)
 const normalized=normalizeScrapedJob(job,{source:'cyraac',company:'CYRAAC Services Private Limited',companyDomain:'cyraacs.com'})
 assert.equal(normalized.country,'India');assert.equal(normalized.remoteStatus,null)
 assert.equal(normalized.sourceDescription,oldText);assert.equal(normalized.sourceRawNativeHTML,opening.bodyText)
})

test('CYRAACS actual opening and closing preserve the same qualified native header model despite raw CF differences',()=>{
 const first=readNativeRole(listing,opening.bodyText,clock),last=readNativeRole(listing,closing.bodyText,clock)
 assert.equal(first.country,'India');assert.equal(last.country,'India')
 assert.deepEqual(first.nativeSourceRecord,last.nativeSourceRecord)
 assert.notEqual(first.sourceRawNativeHTMLSHA256,last.sourceRawNativeHTMLSHA256)
})

const modifications=[
 ['wrong own URL',html=>html,()=>({...listing,sourceUrl:'https://cyraacs.com/other-role/'})],
 ['wrong selected title',html=>html,()=>({...listing,title:'Different Architect'})],
 ['wrong native listing URL',html=>html,()=>({...listing,sourceNativeListingRecord:{...listing.sourceNativeListingRecord,sourceURL:'https://cyraacs.com/other-role/'}})],
 ['missing canonical',html=>replace(html,'<link rel="canonical" href="'+ownURL+'" />','')],
 ['foreign canonical',html=>replace(html,'<link rel="canonical" href="'+ownURL+'" />','<link rel="canonical" href="https://foreign.example/role/" />')],
 ['duplicate canonical',html=>replace(html,'</head>','<link rel="canonical" href="'+ownURL+'" /></head>')],
 ['duplicated h1',html=>replace(html,title,title+title)],
 ['duplicate header',html=>replace(html,header,header+header)],
 ['hidden duplicate header',html=>replace(html,header,header+'<div hidden>'+header+'</div>')],
 ['template duplicate header',html=>replace(html,header,header+'<template>'+header+'</template>')],
 ['missing header',html=>replace(html,header,'')],
 ['foreign country',html=>replace(html,header,header.replace('India','United States'))],
 ['country code without literal India',html=>replace(html,header,header.replace('India','IN'))],
 ['city-only tuple',html=>replace(html,header,header.replace(' India/',' '))],
 ['different employment',html=>replace(html,header,header.replace('Full-time','Contract'))],
 ['footer country only',html=>replace(replace(html,header,''),'</body>','<footer>'+header+'</footer></body>')],
 ['header disconnected from title',html=>replace(html,'data-id="db49edc"','data-id="unreviewed"')],
 ['hidden header',html=>replace(html,header,header.replace('<span ','<span hidden '))],
 ['inert header',html=>replace(html,header,header.replace('<span ','<span inert '))],
 ['hidden title',html=>replace(html,title,title.replace('<h1 ','<h1 hidden '))],
 ['CSS-hidden header',html=>replace(html,'</head>','<style>.elementor-icon-list-text{display:none!important}</style></head>')],
 ['CSS-hidden common ancestor',html=>replace(html,'</head>','<style>[data-id="db49edc"]{visibility:hidden}</style></head>')],
 ['template header',html=>replace(html,header,'<template>'+header+'</template>')],
 ['SVG header',html=>replace(html,header,'<svg>'+header+'</svg>')],
 ['MathML header',html=>replace(html,header,'<math>'+header+'</math>')],
 ['duplicate header class attribute',html=>replace(html,header,header.replace('<span ','<span class="elementor-icon-list-text" '))],
 ['invalid JSON-LD',html=>addLD(html,'{"@type":')],
 ['duplicate type erases JobPosting',html=>addLD(html,'{"@type":"JobPosting","@type":"WebPage","url":"'+ownURL+'"}')],
 ['escaped duplicate identity',html=>addLD(html,'{"@type":"JobPosting","\\u0040type":"WebPage"}')],
 ['unmatched foreign JobPosting',html=>addLD(html,JSON.stringify({'@type':'JobPosting',title:'Other role',url:'https://cyraacs.com/other-role/',jobLocation:{address:{addressCountry:'US'}}}))],
 ['hidden relevant JobPosting',html=>replace(html,'</head>','<div hidden><script type="application/ld+json">{"@type":"JobPosting"}</script></div></head>')],
 ['own schema with unsupported country',html=>addLD(html,JSON.stringify({'@type':'JobPosting',title:listing.title,url:ownURL,hiringOrganization:{name:'CyRAACS'},jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'unqualified'}}}))],
]
for(const [name,edit,selected]of modifications)test('CYRAACS new header path holds '+name,()=>{
 const html=edit(opening.bodyText)
 if(!selected)assert.notEqual(html,opening.bodyText)
 hold(html,selected?.())
})

for(const key of ['@type','\\u0040type'])test('CYRAACS single original LD carrier cannot erase JobPosting using duplicate '+key,()=>{
 const html=replace(opening.bodyText,'"@type":["Person","Organization"]','"@type":"JobPosting","'+key+'":["Person","Organization"]')
 assert.equal((html.match(/type="application\/ld\+json"/g)||[]).length,1)
 hold(html)
})
test('CYRAACS raw inert noscript LD cannot be ignored to prove JobPosting absence',()=>{
 const html=replace(opening.bodyText,'</body>','<noscript><script type="application/ld+json">{"@type":"JobPosting","title":"Other country"}</script></noscript></body>')
 hold(html)
})

test('CYRAACS contradictory active document title cannot borrow the matching body h1',()=>{
 hold(replace(opening.bodyText,'<title>Technical Architect</title>','<title>Other role at Other employer</title>'))
})
const insertCriteria=(html,addition)=>{
 const marker='data-id="0b45422"';assert.equal(html.split(marker).length,2)
 const at=html.indexOf('>',html.indexOf(marker))+1
 const changed=html.slice(0,at)+addition+html.slice(at);assert.notEqual(changed,html);return changed
}
for(const paragraph of ['<p>Work country: United States.</p>','<p>Work location: London, United Kingdom.</p>'])test('CYRAACS reviewed criteria context holds '+paragraph,()=>{
 hold(insertCriteria(opening.bodyText,paragraph))
})
test('CYRAACS explicit new work metadata outside the original criteria widget also holds',()=>{
 hold(replace(opening.bodyText,'</body>','<p>Work country: United States.</p></body>'))
})

// Explicitly simulated four-read cycle, never a fourth actual packet or a live
// collection. Only this test's one-card index/closing is derived; own bodies and
// headers are the acquired current originals before each named mutation.
let simulatedIndex=fixture.packets[0].bodyText
for(const url of new Set(extractJobCards(simulatedIndex).map(row=>row.sourceUrl).filter(url=>url!==ownURL)))simulatedIndex=simulatedIndex.split(url).join('https://cyraacs.com/careers/')
assert.equal(extractJobCards(simulatedIndex).length,1)
const playCurrentCycle=async(edit=()=>{},options={})=>{
 const sequence=[{...fixture.packets[0],bodyText:simulatedIndex},opening,closing,{...fixture.packets[0],bodyText:simulatedIndex}],calls=[]
 let harnessError
 const fetchImpl=async(url,init)=>{
  try{
   const packet=sequence[calls.length],number=calls.length
   assert.ok(packet,'No unretained simulated request permitted');assert.equal(url,packet.requestedURL)
   assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
   const current={...packet,headers:new Headers(packet.headerEntries??packet.headers)}
   edit(current,number);calls.push({url,number,bodySHA256:sha(current.bodyText)})
   const response=new Response(current.bodyText,{status:current.status,headers:current.headers});Object.defineProperty(response,'url',{value:current.finalURL});return response
  }catch(error){harnessError=error;throw error}
 }
 let jobs,error
 try{jobs=await createCyraacScraper().run({fetchImpl,minIntervalMs:0,now:clock,...options})}catch(caught){error=caught}
 if(harnessError)throw harnessError
 return{jobs:jobs||[],error,calls,observations:jobs?.[Symbol.for('jobverify.verified-recruitment-observations')]??error?.recruitmentObservations}
}
test('CYRAACS simulated current four-read cycle requires original safe transport on every selected channel',async()=>{
 const {jobs,error,calls}=await playCurrentCycle();assert.ifError(error)
 assert.equal(calls.length,4);assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].nativeRoleClosingReconciled,true)
 for(const channel of ['openingIndex','openingOwn','closingOwn','closingIndex']){
  const proof=jobs[0].sourceNativeHeaderTransport[channel]
  assert.equal(proof.httpMetadataVerified,true);assert.equal(proof.qualified,true)
  assert.equal(proof.headers['content-type'],'text/html; charset=utf-8')
 }
})
const unsafeHeaders=[
 ['non-UTF8 charset',headers=>headers.set('content-type','text/html; charset=windows-1252')],
 ['ambiguous charset',headers=>headers.set('content-type','text/html; charset=utf-8; charset=utf-16le')],
 ['Refresh',headers=>headers.set('refresh','0;url=https://other-employer.example/careers')],
 ['attachment',headers=>headers.set('content-disposition','attachment; filename=jobs.html')],
 ['declared challenge',headers=>headers.set('cf-mitigated','challenge')],
]
for(const [name,mutate]of unsafeHeaders)for(const number of [0,1,2,3])test('CYRAACS header transport holds '+name+' on selected channel'+number,async()=>{
 let mutations=0
 const {jobs,error}=await playCurrentCycle((packet,at)=>{if(at===number){mutate(packet.headers);mutations++}})
 assert.ifError(error);assert.equal(mutations,1);assert.equal(jobs.filter(job=>job.country==='India').length,0)
})

const history=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/cyraac-historical-collection-20261111.json.gz',import.meta.url))))
const replayCollection=async(edit=()=>{},options={})=>{
 const calls=[];let fixtureFailure
 const fetchText=async(url)=>{
  const packet=history.packets[calls.length]
  try{assert.ok(packet,'No unretained historical request is permitted');assert.equal(url,packet.requestedURL);assert.equal(sha(packet.bodyText),packet.bodySHA256)}
  catch(error){fixtureFailure=error;throw error}
  const observation={...packet,bodyText:packet.bodyText};calls.push({url,phase:packet.phase})
  const changed=edit(observation,calls.length-1)
  if(changed instanceof Error)throw changed
  return observation.bodyText
 }
 let jobs
 try{jobs=await createCyraacScraper().run({fetchText,minIntervalMs:0,now:history.collectionClock,...options})}
 catch(error){if(fixtureFailure)throw fixtureFailure;assert.equal(error.source,'cyraac');assert.equal(error.status,403);return{jobs:[],calls,observations:error.recruitmentObservations,error}}
 if(fixtureFailure)throw fixtureFailure
 return{jobs,calls,observations:jobs[Symbol.for('jobverify.verified-recruitment-observations')]}
}

test('CYRAACS historical30 text hook retains native evidence but cannot qualify missing HTTP metadata',async()=>{
 const {jobs,calls,observations}=await replayCollection()
 assert.equal(calls.length,30);assert.equal(jobs.length,13)
 assert.equal(jobs.filter(job=>job.country==='India').length,0)
 const held=observations.heldNativeRows.find(row=>row.id==='job-description-technical-architect')
 assert.ok(held);assert.equal(held.phase,'header-country-transport-gate')
 assert.equal(held.opening.nativeRecord.ownHeaderCountry.country,'India')
 assert.equal(held.opening.nativeRecord.ownRoleText,held.closing.nativeRecord.ownRoleText)
 assert.deepEqual(held.opening.nativeRecord,held.closing.nativeRecord)
 assert.equal(held.transport.openingOwn.httpMetadataVerified,false)
 assert.equal(calls.slice(1,15).every(call=>call.phase==='opening-role'),true)
 assert.equal(calls.slice(15,29).every(call=>call.phase==='closing-role'),true)
})

for(const phase of ['opening-role','closing-role','closing-index'])test('CYRAACS no header positive escapes an incomplete '+phase,async()=>{
 const {jobs,observations}=await replayCollection(packet=>packet.phase===phase?Object.assign(Error('Synthetic bounded denial'),{status:403}):undefined)
 assert.ok(jobs.every(job=>job.sourceUrl!==ownURL))
 assert.equal(observations.lifecycleCleanupAllowed,false)
})

for(const field of ['header','criteria','application','listing'])test('CYRAACS changed selected simulated closing '+field+' withholds header positive',async()=>{
 let mutations=0
 const {jobs,error}=await playCurrentCycle((packet,number)=>{
  if(number===2&&field!=='listing'){
   packet.bodyText=field==='header'?replace(packet.bodyText,header,header.replace('India','United States')):
    field==='criteria'?replace(packet.bodyText,'</body>','<p>New mandatory qualification</p></body>'):
     replace(packet.bodyText,'https://forms.jumpp.tech/cyraacs-job-application-form-EKJ93','https://forms.jumpp.tech/different-application')
   mutations++
  }
  if(number===3&&field==='listing'){
   assert.ok(packet.bodyText.includes('Technical Architect'));packet.bodyText=packet.bodyText.replaceAll('Technical Architect','Changed Architect');mutations++
  }
 })
 assert.ifError(error);assert.equal(mutations,1);assert.ok(jobs.every(job=>job.sourceUrl!==ownURL))
})
