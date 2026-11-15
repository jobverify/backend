import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runCurrentMeetrecord} from './currentNative20261115.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const original=Object.fromEntries(fixture.packets.map(p=>{
 const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256)
 return[p.url,{...p,html:bytes.toString()}]
}))
const CONFIGURED='https://www.outdoo.ai/positions/sr-product-manager',BOARD='https://www.outdoo.ai/career',LEGAL='https://www.outdoo.ai/terms-of-service'
const ROLE='https://www.outdoo.ai/positions/full-stack-developer-005bb',DESIGN='https://www.outdoo.ai/positions/senior-product-designer-6afd7'
function run(change=()=>{},options={}){
 const calls=[],visits=new Map()
 const jobs=runCurrentMeetrecord({...options,fetchImpl:async(url,init)=>{
  calls.push({url,init});const visit=(visits.get(url)||0)+1;visits.set(url,visit)
  assert.ok(original[url],'declared current public URL '+url);const p=structuredClone(original[url]);change(p,url,visit)
  const response=new Response(p.html,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 }})
 return{jobs,calls,visits}
}

test('current original MeetRecord publisher supplies two complete own India roles while five city-only records remain held',async()=>{
 const result=run(),jobs=await result.jobs
 assert.equal(jobs.length,2)
 const dev=jobs.find(j=>j.sourceUrl===ROLE),designer=jobs.find(j=>j.sourceUrl===DESIGN)
 assert.ok(dev);assert.ok(designer)
 assert.match(dev.jobDescription,/1–3 years of experience/)
 assert.match(dev.jobDescription,/Django, Flask, or FastAPI/)
 assert.match(dev.jobDescription,/Docker, Kubernetes/)
 assert.match(dev.jobDescription,/₹8L – ₹10Lakhs/)
 assert.match(designer.jobDescription,/Figma/)
 assert.match(designer.jobDescription,/share success with passionate and supportive engineers/)
 assert.match(designer.jobDescription,/₹20L – ₹30Lakhs • Offers Equity/)
 assert.ok(jobs.every(j=>j.company==='MeetRecord'&&j.country==='India'&&j.city==='Bengaluru'&&j.postingDate===null&&j.closingDate===null&&j.requisitionId===null&&j.sourceDetailComplete===true&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(dev.sourceNativeEmployerProof.legalCompany,'MeetRecord Inc.')
 assert.equal(dev.sourceNativeApplication.email,'careers@outdoo.ai')
 assert.equal(dev.sourceNativeApplication.externalURL,'https://wellfound.com/jobs/3316271-junior-full-stack-developer')
 assert.equal(jobs.nativeCollectionEvidence.openingCards.length,7)
 assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,5)
 assert.equal(jobs.nativeCollectionEvidence.currentFullClosingReconciled,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.ok(result.calls.every(x=>x.init.method==='GET'&&x.init.redirect==='manual'&&x.init.credentials==='omit'&&x.init.cache==='no-store'))
 for(const url of[CONFIGURED,BOARD,LEGAL,ROLE,DESIGN])assert.equal(result.visits.get(url),2)
})

test('own current role card work conditions accompany full criteria and common benefits',async()=>{
 const jobs=await run().jobs,designer=jobs.find(j=>j.sourceUrl===DESIGN)
 assert.match(designer.sourceNativeListingCard.text,/Bengaluru, India Full Time On-site/)
 assert.ok(designer.jobDescription.includes(designer.sourceNativeListingCard.text))
 assert.match(designer.jobDescription,/Health Care Insurance/)
 assert.match(designer.jobDescription,/Each role lists its location/)
 assert.equal(jobs.nativeCollectionEvidence.nativeDeclaredRoleCountLabels[0],'11')
 assert.equal(jobs.nativeCollectionEvidence.nativeDeclaredCountIsInventoryTotal,false)
})

test('actual registered current response may include its exact reviewed SRI-verified conditional analytics beacon',async()=>{
 const variant=fixture.variants.find(p=>p.url===CONFIGURED);assert.ok(variant)
 const body=Buffer.from(variant.bodyBase64,'base64');assert.equal(createHash('sha256').update(body).digest('hex'),variant.bodySHA256)
 const result=run((p,url)=>{if(url===CONFIGURED)p.html=body.toString()})
 assert.equal((await result.jobs).length,2)
 const beacon='https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092'
 assert.equal(result.visits.get(beacon),2)
})

test('conditional analytics injection supplies no recruitment authority and retains exact declarations,bytes and closing',async t=>{
 const variant=Buffer.from(fixture.variants.find(p=>p.url===CONFIGURED).bodyBase64,'base64').toString(),beacon='https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092'
 for(const[mode,change]of[
  ['other-token',h=>h.replace('da42b429b01e423b9ace3d57b9e41766','unreviewed-token')],
  ['other-integrity',h=>h.replace('sha512-UKNk8','sha512-VKNk8')],
  ['other-url',h=>h.replace(beacon,beacon+'-other')],
  ['duplicate',h=>h.replace('</body>',h.match(/<script\b[^>]*src="https:\/\/static\.cloudflareinsights\.com[^>]*><\/script>/)[0]+'</body>')],
 ])await t.test(mode,async()=>{
  const html=change(variant);assert.notEqual(html,variant)
  await assert.rejects(run((p,url)=>{if(url===CONFIGURED)p.html=html}).jobs,/MeetRecord|native/i)
 })
 await t.test('opening-only still freshly closes exact whole bytes',async()=>{
  const result=run((p,url,visit)=>{if(url===CONFIGURED&&visit===1)p.html=variant})
  assert.equal((await result.jobs).length,2);assert.equal(result.visits.get(beacon),2)
 })
 for(const closing of[false,true])await t.test((closing?'closing':'opening')+' changed full analytics program',async()=>{
  await assert.rejects(run((p,url,visit)=>{if(url===CONFIGURED)p.html=variant;if(url===beacon&&(!closing||visit>1))p.html+=';document.querySelector("main").remove();'}).jobs,/MeetRecord|native/i)
 })
})

test('new embedded native context or required controls outside the original JD cannot be omitted',async t=>{
 for(const extra of['<iframe src="https://www.outdoo.ai/additional-requirements"></iframe>','<form><input name="requiredQualification" value="PhD in cryptography" required></form>'])await t.test(extra.slice(0,35),async()=>{
  await assert.rejects(run((p,url)=>{if(url===ROLE)p.html=p.html.replace('</main>',extra+'</main>')}).jobs,/MeetRecord|native/i)
 })
})

test('independent review: all retained author requirements outside the original JD must be qualified',async t=>{
 const marker='Applicants must hold a cryptography doctorate before applying.'
 for(const[name,extra,closingOnly]of[
  ['hidden-microdata','<section itemprop="qualifications" hidden>'+marker+'</section>',false],
  ['aria-hidden-microdata','<section itemprop="qualifications" aria-hidden="true">'+marker+'</section>',false],
  ['inert-microdata','<section itemprop="qualifications" inert>'+marker+'</section>',false],
  ['css-hidden-microdata','<section itemprop="qualifications" style="display:none">'+marker+'</section>',false],
  ['plain-aria-hidden-prose','<p aria-hidden="true">'+marker+'</p>',false],
  ['plain-hidden-prose','<p hidden>'+marker+'</p>',false],
  ['plain-inert-prose','<p inert>'+marker+'</p>',false],
  ['closing-only-aria-hidden-microdata','<section itemprop="qualifications" aria-hidden="true">'+marker+'</section>',true],
 ])await t.test(name,async()=>{
  let changed=false;await assert.rejects(run((p,url,visit)=>{if(url===ROLE&&(!closingOnly||visit>1)){p.html=p.html.replace('</main>',extra+'</main>');changed=true}}).jobs,/MeetRecord|native/i);assert.equal(changed,true)
 })
})

test('ARIA and inert attributes cannot certify visual absence of a current unavailable notice',async t=>{
 for(const attrs of['aria-hidden="true"','inert'])await t.test(attrs,async()=>{
  await assert.rejects(run((p,url)=>{if(url===ROLE)p.html=p.html.replace('</main>','<p '+attrs+'>This position has been filled.</p></main>')}).jobs,/MeetRecord|native/i)
 })
})

const beforeJD=(html,addition)=>{
 const at=html.indexOf('data-cms-field="about-the-meetrecord"');assert.ok(at>0)
 const start=html.lastIndexOf('<div',at);assert.ok(start>0);return html.slice(0,start)+addition+html.slice(start)
}
test('current own employer,country,title,full criteria and exact applications are mandatory',async t=>{
 const cases=[
  ['legal-owner',LEGAL,p=>p.replaceAll('MeetRecord Inc.','Unrelated Inc.')],
  ['configured-original-name',CONFIGURED,p=>p.replaceAll('Outdoo (formerly MeetRecord)','Outdoo (formerly Unrelated Company)')],
  ['card-country',BOARD,p=>p.replaceAll('Bengaluru, India','Bengaluru')],
  ['detail-country',ROLE,p=>p.replaceAll('Bengaluru, India','Bengaluru, United States')],
  ['foreign-alternative',ROLE,p=>p.replace('data-cms-field="location"','data-country="US" data-cms-field="location"')],
  ['title',ROLE,p=>p.replaceAll('Junior Full Stack Developer','Different Position')],
  ['canonical',ROLE,p=>p.replace('href="'+ROLE+'" rel="canonical"','href="https://www.outdoo.ai/positions/other" rel="canonical"')],
  ['teaser-only',ROLE,p=>p.replace(/(<div\b[^>]*data-cms-field="about-the-meetrecord"[^>]*>)[\s\S]*?<\/div>/,'$1<p>Build software with our team.</p></div>')],
  ['missing-current-criterion',ROLE,p=>p.replace('Proficient in Python and web frameworks (Django, Flask, or FastAPI).','')],
  ['new-qualification',ROLE,p=>p.replace('Key Responsibilities','Additional current minimum requirement: a PhD in cryptography. Key Responsibilities')],
  ['new-sibling-qualification',ROLE,p=>beforeJD(p,'<p>An additional current minimum requirement is a PhD in cryptography.</p>')],
  ['hidden-jd',ROLE,p=>p.replace('data-cms-field="about-the-meetrecord"','hidden data-cms-field="about-the-meetrecord"')],
  ['inert-jd',ROLE,p=>p.replace('data-cms-field="about-the-meetrecord"','inert data-cms-field="about-the-meetrecord"')],
  ['css-hidden-jd',ROLE,p=>p.replace('</head>','<style>[data-cms-field="about-the-meetrecord"]{display:none}</style></head>')],
  ['hidden-country',ROLE,p=>p.replace('data-cms-field="location"','hidden data-cms-field="location"')],
  ['new-criterion-field',ROLE,p=>p.replace('data-cms-field="compensation"','data-required-qualification="PhD" data-cms-field="compensation"')],
  ['application-job',ROLE,p=>p.replaceAll('3316271-junior-full-stack-developer','3316272-other-role')],
  ['application-domain',ROLE,p=>p.replaceAll('https://wellfound.com/jobs/3316271','https://unrelated.invalid/jobs/3316271')],
  ['native-email',ROLE,p=>p.replaceAll('careers@outdoo.ai','careers@unrelated.invalid')],
  ['new-schema-criterion',ROLE,p=>p.replace('"@graph":[','"qualifications":"A PhD in cryptography is mandatory.","@graph":[')],
  ['duplicate-json-identity',ROLE,p=>p.replace('"name":"Outdoo AI"','"name":"Unrelated Company","name":"Outdoo AI"')],
  ['schema-context',ROLE,p=>p.replaceAll('"@context":"https://schema.org"','"@context":"https://unrelated.invalid/context"')],
  ['new-active-module',ROLE,p=>p.replace('</body>','<script type="module">document.querySelector("main").remove()</script></body>')],
  ['empty-script-src',ROLE,p=>p.replace('<script type="text/javascript">','<script src="" type="text/javascript">')],
  ['base-declaration',ROLE,p=>p.replace('</head>','<base href="https://unrelated.invalid/"></head>')],
  ['new-event-activation',ROLE,p=>p.replace('<main>','<main onpointerenter="this.hidden=true">')],
  ['common-benefit',BOARD,p=>p.replace('Health Care Insurance','Health Care Insurance requires a salary deduction')],
  ['common-hiring-condition',BOARD,p=>p.replace('Each role lists its location.','Each role lists its location. All employees must travel weekly.')],
  ['unqualified-empty',BOARD,p=>p.replace('id="positions"','id="positions-unavailable"')],
 ]
 for(const[name,url,change]of cases)await t.test(name,async()=>{
  let changed=false;await assert.rejects(run((p,u)=>{if(u===url){const next=change(p.html);assert.notEqual(next,p.html,'actual fixture mutation '+name);p.html=next;changed=true}}).jobs,/MeetRecord|native/i);assert.equal(changed,true)
 })
})

test('active availability contradictions reject at opening and fresh closing while hidden or inert notices retain current positives',async t=>{
 for(const notice of['This position is filled.','This job is not available.','This position is currently unavailable.','This job is now closed.','Applications for this role are currently closed.','We are no longer accepting applications.'])for(const closing of[false,true])await t.test((closing?'closing ':'opening ')+notice,async()=>{
  await assert.rejects(run((p,url,visit)=>{if(url===ROLE&&(!closing||visit>1))p.html=beforeJD(p.html,'<p>'+notice+'</p>')}).jobs,/MeetRecord|native/i)
 })
 for(const notice of['<p hidden>This position is currently unavailable.</p>','<p style="display:none">This job is not available.</p>','<template><p>This position is filled.</p></template>','<noscript>This job is now closed.</noscript>'])await t.test('inactive '+notice.slice(0,35),async()=>{
  assert.equal((await run((p,url)=>{if(url===ROLE)p.html=beforeJD(p.html,notice)}).jobs).length,2)
 })
})

test('independent closing protects role criteria,membership,legal,common context,styles and complete programs',async t=>{
 const style=fixture.packets.find(p=>p.kind==='style').url,program=fixture.packets.find(p=>p.kind==='program').url
 for(const[name,url,change]of[
  ['full-role',ROLE,p=>p.replace('Django, Flask, or FastAPI','Only proprietary web frameworks')],
  ['membership',BOARD,p=>p.replaceAll('/positions/full-stack-developer-005bb','/positions/other')],
  ['legal',LEGAL,p=>p.replaceAll('MeetRecord Inc.','Other Inc.')],
  ['publisher',CONFIGURED,p=>p.replaceAll('Outdoo (formerly MeetRecord)','Different Employer')],
  ['benefit',BOARD,p=>p.replace('Book Budget','No Book Budget')],
  ['style',style,p=>p+' main { display:none !important; }'],
  ['program',program,p=>p+';document.querySelector("main").remove();'],
 ])await t.test(name,async()=>{
  await assert.rejects(run((p,u,visit)=>{if(u===url&&visit>1)p.html=change(p.html)}).jobs,/MeetRecord|native/i)
 })
})

test('native HTTP denial,redirect,response identity and MIME drift fail without advancing queued roles',async t=>{
 for(const mode of['denied','redirect','response-url','mime'])await t.test(mode,async()=>{
  const result=run((p,url)=>{if(url!==DESIGN)return;if(mode==='denied')p.status=403;if(mode==='redirect'){p.status=302;p.headers.location='https://www.outdoo.ai/positions/other'}if(mode==='response-url')p.url='https://www.outdoo.ai/positions/other';if(mode==='mime')p.headers['content-type']='application/json'})
  await assert.rejects(result.jobs,/MeetRecord|native/i)
  assert.equal(result.calls.some(x=>x.url===ROLE),false)
 })
})

test('caller abort reasons remain exact for frozen errors and primitives before and during uncooperative reads',async t=>{
 for(const during of[false,true])for(const reason of[Object.freeze(Error('caller-stop')),'caller-stop'])await t.test((during?'in-flight ':'pre-abort ')+typeof reason,async()=>{
  const controller=new AbortController();if(!during)controller.abort(reason)
  let calls=0;const promise=runCurrentMeetrecord({signal:controller.signal,fetchImpl:()=>{calls++;return new Promise(()=>{})}})
  if(during){await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)}
  await assert.rejects(promise,error=>error===reason)
  assert.equal(calls,during?1:0)
 })
})

test('bounded read settles an uncooperative fetch and disposes a late response',async()=>{
 let resolveFetch,canceled=0
 const started=performance.now(),promise=runCurrentMeetrecord({sourceDeadlineMs:25,fetchImpl:()=>new Promise(resolve=>{resolveFetch=resolve})})
 await assert.rejects(promise,/deadline|timeout|aborted/i)
 assert.ok(performance.now()-started<1000)
 resolveFetch({status:200,url:CONFIGURED,headers:new Headers({'content-type':'text/html'}),body:{cancel(){canceled++;return new Promise(()=>{})},getReader(){throw Error('late body must not be consumed')}}})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(canceled,1)
})

test('stream bounds reject before buffering or starting another read and cancel/release the source body',async()=>{
 let reads=0,canceled=0,released=0
 const body={getReader:()=>({async read(){reads++;return{done:false,value:new Uint8Array(4000001)}},cancel(){canceled++;return new Promise(()=>{})},releaseLock(){released++}}),cancel(){canceled++}}
 await assert.rejects(runCurrentMeetrecord({fetchImpl:async()=>({status:200,url:CONFIGURED,headers:new Headers({'content-type':'text/html'}),body})}),/stream byte bound/)
 assert.equal(reads,1);assert.equal(canceled,1);assert.equal(released,1)
})

test('uncooperative body reads are canceled and released at the source deadline',async()=>{
 let canceled=0,released=0
 const body={getReader:()=>({read:()=>new Promise(()=>{}),cancel(){canceled++;return new Promise(()=>{})},releaseLock(){released++}}),cancel(){canceled++}}
 await assert.rejects(runCurrentMeetrecord({sourceDeadlineMs:25,fetchImpl:async()=>({status:200,url:CONFIGURED,headers:new Headers({'content-type':'text/html'}),body})}),/deadline|timeout|aborted/i)
 assert.equal(canceled,1);assert.equal(released,1)
})
