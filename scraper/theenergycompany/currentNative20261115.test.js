import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(p=>{const b=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(b).digest('hex'),p.bodySHA256);return[p.requestedURL,{...p,html:b.toString()}]}))
const ROOT='https://www.energycompany.in/',HOME='https://energycompany.in/',BOARD=HOME+'we-are-hiring'
const titles=['Head of Finance','Head of Manufacturing','Embedded Software Engineer','Power Electronics Engineer','Service Engineer']
const application=title=>HOME+'contact-us?interest=Jobs&role='+encodeURIComponent(title)
function execute(change=()=>{},options={}){
  const calls=[],visits=new Map(),read=async value=>{const url=String(value),visit=(visits.get(url)||0)+1;visits.set(url,visit);const p=structuredClone(packets.get(url));assert.ok(p,'Only actual published current public URL '+url);change(p,url,visit);return{url,p}}
  const jobs=run({now:()=>fixture.capturedAt,...options,fetchPage:async value=>{const{url,p}=await read(value);calls.push({url,legacy:true});return{...p,url:p.url}},fetchImpl:async(value,init)=>{const{url,p}=await read(value);calls.push({url,init});const response=new Response(p.html,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response}})
  return{jobs,calls}
}
test('The ENERGY COMPANY current own publication preserves all five complete native accordion roles and exact role application identities',async()=>{
  const result=execute(),jobs=await result.jobs
  assert.deepEqual(jobs.map(j=>j.title),titles)
  for(const job of jobs){
    assert.equal(job.company,'The ENERGY COMPANY');assert.equal(job.country,'India');assert.equal(job.city,'Bengaluru')
    assert.equal(job.applyUrl,application(job.title));assert.equal(job.jobId,job.applyUrl);assert.equal(job.sourceNativeIdentifier,null)
    assert.equal(job.postingDate,null);assert.equal(job.sourcePostedDateRaw,'October 2026');assert.equal(job.postingDatePrecision,'month')
    assert.equal(job.sourcePostedMonth,'2026-10');assert.equal(job.firstEverPostedAt,null);assert.equal(job.closingDate,null)
    assert.equal(job.sourceNativeResponsibilities.length,6);assert.equal(job.sourceNativeQualifications.length,4)
    for(const item of [...job.sourceNativeResponsibilities,...job.sourceNativeQualifications])assert.ok(job.jobDescription.includes(item))
    for(const text of ['Cross-disciplinary by default','Hardware and software engineers sit together.','How hiring works.','A real problem close to the work you would do here.','A conversation with the founders, then an offer if it is a fit.'])assert.ok(job.jobDescription.includes(text),'Common authored hiring conditions retained: '+text)
    assert.ok(job.jobDescription.includes(job.sourceNativeCommonHiringContext))
    assert.ok(job.jobDescription.length>=600);assert.equal(job.sourceDetailComplete,true)
    assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
    assert.equal(job.sourceNativeCountryProof.currentBoardCountry,'Bengaluru, India');assert.equal(job.sourceNativeCountryProof.roleScope,'5 positions. All in Bengaluru.')
  }
  assert.match(jobs[0].jobDescription,/Chartered Accountant or equivalent/)
  assert.match(jobs[4].jobDescription,/Willing to travel to customer sites/)
  const evidence=readInventoryEvidence(jobs);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.lifecycleCleanupAllowed,false)
  assert.equal(readSourceObservationEvidence(jobs,'theenergycompany').observedRecordCount,5)
  assert.ok(result.calls.filter(r=>r.url===BOARD).length>=2);assert.ok(result.calls.filter(r=>r.url===application(titles[0])).length>=2)
  assert.ok(result.calls.every(r=>r.init?.method==='GET'&&r.init.redirect==='manual'&&r.init.credentials==='omit'))
})
test('The ENERGY COMPANY cannot omit common authored hiring conditions hidden by a current stylesheet class',async t=>{
  for(const closingOnly of[false,true])await t.test(closingOnly?'closing':'opening',async()=>{
    await assert.rejects(execute((p,url,visit)=>{
      if(url===BOARD&&(!closingOnly||visit>1)){
        const next=p.html.replace('class="t-steps t-c4"','class="t-steps t-c4 w-hidden"')
        assert.notEqual(next,p.html,'Mutation hits actual common hiring steps');p.html=next
      }
    }).jobs,/ENERGY COMPANY/i)
  })
})

test('The ENERGY COMPANY scoped country and complete authored criteria cannot be supplied by a changed, hidden or inert role',async t=>{
  for(const[name,change]of[
    ['foreign-board-country',h=>h.replace('Bengaluru, India','Bengaluru, Nepal')],
    ['missing-board-country',h=>h.replace('Bengaluru, India','Bengaluru')],
    ['different-role-scope',h=>h.replace('5 positions. All in Bengaluru.','5 positions. Some in London.')],
    ['foreign-role-city',h=>h.replace('Bengaluru · Full-time','Kathmandu · Full-time')],
    ['changed-native-title',h=>h.replace('>Head of Finance</strong>','>Other Finance Manager</strong>')],
    ['wrong-application-role',h=>h.replace('role=Head%20of%20Finance','role=Other%20Manager')],
    ['duplicate-application-role',h=>h.replace('role=Head%20of%20Finance','role=Head%20of%20Finance&amp;role=Other')],
    ['foreign-application',h=>h.replace('href="/contact-us?interest=Jobs&amp;role=Head%20of%20Finance"','href="https://other.invalid/contact-us?interest=Jobs&amp;role=Head%20of%20Finance"')],
    ['hidden-role',h=>h.replace('<details class="t-role">','<details hidden class="t-role">')],
    ['inert-role',h=>h.replace('<details class="t-role">','<details inert class="t-role">')],
    ['hidden-criteria',h=>h.replace('<div class="t-role-body">','<div hidden class="t-role-body">')],
    ['unreviewed-hiding-style',h=>h.replace('<div class="t-role-body">','<div style="filter:opacity(0)" class="t-role-body">')],
    ['extra-qualification',h=>h.replace('<div class="t-role-body">','<div class="t-role-body"><p>Additional requirement: a PhD in cryptography.</p>')],
    ['extra-hidden-qualification',h=>h.replace('<div class="t-role-body">','<div class="t-role-body"><p hidden>Additional requirement: a PhD in cryptography.</p>')],
    ['empty-qualification',h=>h.replace('Comfortable working directly with founders and investors','')],
    ['new-native-schema-criteria',h=>h.replace('</head>','<script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","qualifications":"A PhD in cryptography."}</script></head>')],
    ['duplicate-native-schema-country',h=>h.replace('</head>','<script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","addressCountry":"IN","addressCountry":"NP"}</script></head>')],
  ])await t.test(name,async()=>{await assert.rejects(execute((p,url)=>{if(url===BOARD){const next=change(p.html);assert.notEqual(next,p.html,'Mutation hits actual fixture');p.html=next}}).jobs,/ENERGY COMPANY/i)})
})
test('The ENERGY COMPANY publisher, own application and reviewed visibility remain bound through the closing read',async t=>{
  for(const mode of['publisher','application-form','application-jobs-option','application-message-field','application-controller','inactive-application-controller','application-submit-disabled','application-hidden','style','closing-criteria','closing-country','closing-application'])await t.test(mode,async()=>{
    await assert.rejects(execute((p,url,visit)=>{
      if(mode==='publisher'&&url===HOME)p.html=p.html.replace('The Intelligent Storage Layer | The Energy Company','Other Company')
      if(mode==='style'&&url.includes('.css'))p.html+='body{display:none}'
      if(mode==='closing-criteria'&&url===BOARD&&visit>1)p.html=p.html.replace('Comfortable working directly with founders and investors','Must hold an additional PhD in cryptography')
      if(mode==='closing-country'&&url===BOARD&&visit>1)p.html=p.html.replace('Bengaluru, India','Bengaluru, Nepal')
      if(url===application(titles[0])){
        if(mode==='application-form')p.html=p.html.replace('data-t-form="contact"','data-t-form="other"')
        if(mode==='application-jobs-option')p.html=p.html.replace('<option value="Jobs">Jobs</option>','<option value="Other">Other</option>')
        if(mode==='application-message-field')p.html=p.html.replace('id="contact-msg"','id="unrelated-msg"')
        if(mode==='application-controller'||mode==='closing-application'&&visit>1)p.html=p.html.replace('I would like to apply for the ','I would like to buy ')
        if(mode==='inactive-application-controller')p.html=p.html.replace(/<script>(\(function\(\)\{var r=new URLSearchParams[\s\S]*?)<\/script>/,'<script src="">$1</script>')
        if(mode==='application-submit-disabled')p.html=p.html.replace('type="submit"','type="submit" disabled')
        if(mode==='application-hidden')p.html=p.html.replace('class="t-form"','hidden class="t-form"')
      }
    }).jobs,/ENERGY COMPANY/i)
  })
})
test('The ENERGY COMPANY rejects current unavailable notices on opening and closing board/application reads',async t=>{
  for(const url of[BOARD,application(titles[0])])for(const phase of['opening','closing'])await t.test(url+' '+phase,async()=>{
    await assert.rejects(execute((p,value,visit)=>{if(value===url&&(phase==='opening'?visit===1:visit>1))p.html=p.html.replace('<main id="main">','<main id="main"><p>This position is currently unavailable.</p>')}).jobs,/unavailable|closed|filled/i)
  })
})
test('The ENERGY COMPANY current application legal publisher cannot contradict its independently bound own board',async()=>{
  await assert.rejects(execute((p,url)=>{if(url===application(titles[0])){
    const before=p.html;p.html=p.html.replace('The Energy Company and Flexi product names are trademarks of Encrate Private Limited.','The Energy Company and Flexi product names are trademarks of Other Company.');assert.notEqual(before,p.html)
  }}).jobs,/publisher|employer|ENERGY COMPANY/i)
})
test('The ENERGY COMPANY cannot omit a new published mandatory requirement outside the original main or form',async t=>{
  for(const url of[BOARD,application(titles[0])])for(const phase of['opening','closing'])await t.test(url+' '+phase,async()=>{
    await assert.rejects(execute((p,value,visit)=>{if(value===url&&(phase==='opening'?visit===1:visit>1))p.html=p.html.replace('<main id="main">','<section><h2>Additional mandatory qualifications</h2><p>All applicants must hold a PhD in cryptography.</p></section><main id="main">')}).jobs,/ENERGY COMPANY/i)
  })
})
test('The ENERGY COMPANY does not promote hidden or inert unavailable examples into current status',async t=>{
  for(const url of[BOARD,application(titles[0])])for(const notice of['<p hidden>This job is now filled.</p>','<template><p>This job is now filled.</p></template>'])await t.test(url+' '+notice,async()=>{
    assert.equal((await execute((p,value)=>{if(value===url)p.html=p.html.replace('<main id="main">','<main id="main">'+notice)}).jobs).length,5)
  })
})
test('The ENERGY COMPANY denial and uncertified empty listing remain unresolved',async t=>{
  for(const mode of['denial','empty'])await t.test(mode,async()=>{await assert.rejects(execute((p,url)=>{if(url===BOARD){if(mode==='denial')p.status=403;else p.html=p.html.replace(/<details class="t-role">[\s\S]*?<\/details>/g,'')}}).jobs,/ENERGY COMPANY/i)})
})
test('The ENERGY COMPANY bounded HTTP read settles on uncooperative fetch/body, cancels oversized streams and preserves caller abort reasons',async t=>{
  for(const mode of['fetch','body'])await t.test('deadline '+mode,async()=>{let canceled=false;const started=Date.now();await assert.rejects(run({sourceDeadlineMs:40,fetchImpl:async()=>mode==='fetch'?new Promise(()=>{}):{status:200,url:ROOT,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{canceled=true},releaseLock:()=>{}})}}}),/deadline/i);assert.ok(Date.now()-started<1000);if(mode==='body')assert.equal(canceled,true)})
  await t.test('stream bound',async()=>{let reads=0,canceled=false;await assert.rejects(run({fetchImpl:async()=>({status:200,url:ROOT,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:async()=>{reads++;return{done:false,value:new Uint8Array(4000001)}},cancel:async()=>{canceled=true},releaseLock:()=>{}})}})}),/byte bound/i);assert.equal(reads,1);assert.equal(canceled,true)})
  for(const phase of['pre-aborted','fetch','body'])for(const reason of[Object.freeze(new Error('caller-stop')),'caller-stop'])await t.test(phase+' '+typeof reason,async()=>{
    const c=new AbortController();let reads=0,canceled=false;if(phase==='pre-aborted')c.abort(reason)
    await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{reads++;if(phase==='fetch'){queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})}return{status:200,url:ROOT,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>{queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})},cancel:async()=>{canceled=true},releaseLock:()=>{}})}}}}),error=>{assert.strictEqual(error,reason);return true})
    assert.equal(reads,phase==='pre-aborted'?0:1);if(phase==='body')assert.equal(canceled,true)
  })
})
