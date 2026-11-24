import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {CAREERS,readCurrentHexInventory,inspectCurrentHexRole,runCurrentHex} from './currentPublished20261120.js'
import {constraints} from './currentFacts20261120.js'
import {currentReader} from './currentRead20261120.js'
import {createHexScraper} from './script.js'
import metadata from './catalog.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url)))),text=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8'),at=fixture.observedAt,index=text(fixture.responses[0]),native=readCurrentHexInventory(index,{observedAt:at}),row=native.cards[0],html=text(fixture.responses[1])
const inspect=body=>inspectCurrentHexRole(body,row,{observedAt:at}),inventory=body=>readCurrentHexInventory(body,{observedAt:at}),error=/native|Current|Hex|hex/
function editSchema(body,type,change){
 const targets=[]
 for(const node of document(body).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')){const root=JSON.parse(node.raw);function visit(value){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return}if((Array.isArray(value['@type'])?value['@type']:[value['@type']]).includes(type))targets.push({node,root,value});for(const child of Object.values(value))if(child&&typeof child==='object')visit(child)}visit(root)}
 assert.equal(targets.length,1,'exact genuine schema target');const t=targets[0];change(t.value);const changed=body.replace(t.node.raw,()=>JSON.stringify(t.root).replaceAll('<','\\u003c'));assert.notEqual(changed,body,'control must change genuine bytes');return changed
}
const edit=change=>editSchema(html,'JobPosting',change)
const appendSchema=model=>{const changed=html.replace('</head>',()=>'<script type="application/ld+json">'+JSON.stringify(model).replaceAll('<','\\u003c')+'</script></head>');assert.notEqual(changed,html);return changed}
function insertMain(markup){const changed=html.replace('</main>',()=>markup+'</main>');assert.notEqual(changed,html);return changed}
function replay(change=(r)=>r){
 const calls=[],counts=new Map()
 return{calls,fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.signal.aborted,false);assert.equal(new URL(url).origin,'https://hex.tech');const occurrence=counts.get(url)??0;counts.set(url,occurrence+1);const original=fixture.responses.filter(r=>r.requestedUrl===url)[occurrence];assert.ok(original,'only retained own URL/occurrence');calls.push({url,occurrence});const record=change({...original},calls.length);return Object.defineProperty(new Response(Buffer.from(record.bodyBase64,'base64'),{status:record.status,headers:record.headers}),'url',{value:record.url})}}
}
const withBody=(r,body)=>({...r,bodyBase64:Buffer.from(body).toString('base64')})

test('Current genuine count42 and all84 native roles retain explicit US country and raw publication',()=>{
 assert.equal(native.total,42);assert.equal(native.cards.length,42);assert.equal(fixture.responses.length,86)
 for(const record of fixture.responses.filter(r=>r.url!==CAREERS)){const card=native.cards.find(c=>c.url===record.url);assert.ok(card);const proof=inspectCurrentHexRole(text(record),card,{observedAt:at});assert.deepEqual(proof.countries,['United States']);assert.equal(proof.nativeDates.posted[0].raw,proof.nativeJobPosting.datePosted);assert.equal(proof.nativeApplicationSelector.publicApplicationURL,null);assert.equal(proof.nativeApplicationSelector.activationVerified,false)}
})
test('Ordinary current factory uses all86 original GET Responses and unchanged standard fetched-zero assessor',async()=>{
 const io=replay();let audit;const jobs=await createHexScraper().run({fetchImpl:io.fetchImpl,requestIntervalMs:0,now:at,onAudit:value=>{audit=value}}),assessed=assessSoftFailureAcquisition(metadata,jobs)
 assert.equal(io.calls.length,86);assert.equal(jobs.length,0);assert.equal(audit.observations.length,2);for(const phase of audit.observations)assert.equal(phase.roles.length,42)
 assert.equal(assessed.zeroJobEvidence,'fetched-zero');assert.equal(assessed.runnerOutcome.success,true);assert.equal(readInventoryEvidence(jobs).status,'complete-inventory');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);assert.equal(readSourceObservationEvidence(jobs,'hex').observedVacancyCount,42);assert.equal(readSourceObservationEvidence(jobs,'hex').companyGlobalTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 for(const receipt of audit.originalResponses){const bytes=Buffer.from(receipt.bodyBase64,'base64');assert.equal(receipt.sha256,createHash('sha256').update(bytes).digest('hex'))}assert.equal(audit.nativeProgramsExecuted,false);assert.equal(audit.applicationsSubmitted,false);assert.equal(audit.legalEmployer,null)
})

for(const[name,change]of[
 ['foreign publisher',s=>s.replace('property="og:site_name" content="Hex"','property="og:site_name" content="Other"')],
 ['count and membership disagreement',s=>s.replace('[<!-- -->42<!-- -->]','[<!-- -->41<!-- -->]')],
 ['hidden count owner',s=>{const d=document(s),nodes=d.nodes(n=>n.tag==='h2'&&d.text(n)==='Open roles');assert.equal(nodes.length,1);const original=d.outer(nodes[0]);return s.replace(original,original.replace('<h2','<h2 hidden'))}],
 ['inert whole publisher',s=>s.replace('<body','<body inert')],
 ['foreign canonical',s=>s.replace('</head>','<link rel="canonical" href="https://other.example/careers/"></head>')],
 ['unreviewed base',s=>s.replace('</head>','<base href="https://other.example/"></head>')],
 ['refresh navigation',s=>s.replace('</head>','<meta http-equiv="refresh" content="0;url=https://other.example/"></head>')],
 ['foreign graph publisher',s=>editSchema(s,'WebPage',m=>{m.publisher['@id']='https://other.example/#organization'})],
 ['foreign page name',s=>editSchema(s,'WebPage',m=>{m.name='Other Employer Careers'})],
 ['wrong same-origin graph identifier',s=>editSchema(s,'WebPage',m=>{m['@id']='https://hex.tech/careers/other/#webpage'})],
])test('Current native inventory holds '+name,()=>{const changed=change(index);assert.notEqual(changed,index);assert.throws(()=>inventory(changed),error)})
test('Current semantic index tolerates CSS class renaming and ordinary comments',()=>{const changed=index.replace(/class="[^"]*"/g,'class="updated-layout"').replace('</main>','<!-- current deployment --> </main>');assert.equal(inventory(changed).total,42)})

for(const[field,value]of[['country','India'],['work-country','India'],['employer','Other Employer'],['posting-status','withdrawn'],['application-url','https://other.example/apply']])test('Known unchanged-text native description '+field+' is qualified',()=>assert.throws(()=>inspect(edit(m=>{m.description='<section data-'+field+'="'+value+'">'+m.description+'</section>'})),error))
for(const[name,change]of[
 ['foreign hiring employer',m=>{m.hiringOrganization.name='Other Employer'}],
 ['foreign employer root identifier',m=>{m.hiringOrganization['@id']='https://other.example/#organization'}],
 ['wrong role URI',m=>{m.url='https://hex.tech/careers/other-role/'}],
 ['wrong role title',m=>{m.title='Another Role'}],
 ['India country',m=>{m.jobLocation[0].address.addressCountry='IN'}],
 ['unknown country',m=>{m.jobLocation[0].address.addressCountry='Unresolved'}],
 ['conflicting typed country alias',m=>{m.jobLocation[0].address.addressCountry={'@type':'Country',name:'United States',identifier:'IN'}}],
 ['missing country',m=>{delete m.jobLocation[0].address.addressCountry}],
 ['additional India jobLocation',m=>{const p=structuredClone(m.jobLocation[0]);p.address.addressCountry='IN';m.jobLocation.push(p)}],
 ['foreign application alias',m=>{m.applyLink='https://other.example/apply'}],
 ['nested PostalAddress application alias',m=>{m.jobLocation[0].address.applicationUrl='https://other.example/apply'}],
 ['object publication status',m=>{m.postingStatus={value:'withdrawn'}}],
 ['object expiry',m=>{m.closingDate={value:'2023-06-29'}}],
 ['boolean closed',m=>{m.isClosed=true}],
 ['publication false',m=>{m.isPublished=false}],
 ['future publication instant',m=>{m.datePosted=new Date(Date.parse(at)+3600000).toISOString()}],
 ['expired native deadline',m=>{m.validThrough='2023-06-29'}],
 ['invalid calendar',m=>{m.datePosted='2026-02-30T18:54:20.084+00:00'}],
 ['untyped workplace',m=>{delete m.jobLocation[0]['@type']}],
 ['hidden description criteria',m=>{m.description='<section hidden data-country="India">'+m.description+'</section>'}],
 ['unknown applicant country',m=>{m.applicantLocationRequirements='Unresolved'}],
 ['India applicant country',m=>{m.applicantLocationRequirements={'@type':'Country',name:'India'}}],
])test('Current same-role contract holds '+name,()=>assert.throws(()=>inspect(edit(change)),error))
for(const field of['workLocation','workLocations','jobLocations','primaryLocation','primaryLocations'])test('Every typed '+field+' country remains qualified',()=>assert.throws(()=>inspect(edit(m=>{const p=structuredClone(m.jobLocation[0]);p.address.addressCountry='IN';m[field]=field.endsWith('s')?[p]:p})),error))
for(const[field,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL','https://other.example/apply'],['Location','Bengaluru, India']]){
 for(const tag of['p','div','section'])test('Actual main semantic '+tag+'/'+tag+' '+field+' is qualified',()=>assert.throws(()=>inspect(insertMain('<section><'+tag+'>'+field+'</'+tag+'><'+tag+'>'+value+'</'+tag+'></section>')),error))
 test('Model criteria semantic '+field+' is qualified',()=>assert.throws(()=>inspect(edit(m=>{m.description='<section><p>'+field+'</p><p>'+value+'</p></section>'+m.description})),error))
}
for(const[name,change]of[
 ['foreign own h1 employer',s=>s.replace('<h1','<h1 data-employer="Other Employer"')],
 ['foreign original schema carrier',s=>s.replace('type="application/ld+json"','data-country="India" type="application/ld+json"')],
 ['hidden original native selector',s=>s.replace('id="ashby_embed"','id="ashby_embed" hidden')],
 ['withdrawn selector owner',s=>s.replace('id="ashby_embed"','id="ashby_embed" aria-disabled="true"')],
 ['foreign selector application alias',s=>s.replace('id="ashby_embed"','id="ashby_embed" data-apply-link="https://other.example/apply"')],
 ['wrong selector id',s=>s.replace('data-jid="4159564c-f4a6-4034-93a6-928c579d96ce"','data-jid="unresolved"')],
 ['foreign same-role WebPage publisher',s=>editSchema(s,'WebPage',m=>{m.publisher['@id']='https://other.example/#organization'})],
])test('Actual original carrier holds '+name,()=>{const changed=change(html);assert.notEqual(changed,html);assert.throws(()=>inspect(changed),error)})
test('Additional same-role WebPage country is qualified alongside primary JobPosting',()=>assert.throws(()=>inspect(appendSchema({'@context':'http://schema.org','@type':'http://schema.org/WebPage',url:row.url,name:row.title,country:'IN'})),error))
test('Supplied WebPage name cannot switch publisher or role',()=>assert.throws(()=>inspect(editSchema(html,'WebPage',m=>{m.name='Other Employer Careers'})),error))

for(const alias of['USA','us','United States',{'@type':'Country',name:'United States',identifier:'US'}])test('Equivalent explicit native country remains supported '+JSON.stringify(alias),()=>assert.equal(inspect(edit(m=>{m.jobLocation[0].address.addressCountry=alias})).country,'United States'))
for(const[name,change]of[
 ['single typed workplace',m=>{m.jobLocation=m.jobLocation[0]}],
 ['explicit foreign applicant country',m=>{m.applicantLocationRequirements={'@type':'Country',name:'United States',identifier:'US'}}],
 ['owned employer root alias',m=>{m.hiringOrganization.url='https://www.hex.tech/';m.hiringOrganization['@id']='https://hex.tech/#organization'}],
 ['coherent publication flags',m=>{m.isPublished=true;m.isClosed=false;m.postingStatus='active'}],
 ['coherent own detail alias',m=>{m.applicationUrl=row.url}],
 ['equivalent UTC publication',m=>{m.datePosted='2026-02-11T18:54:20.084Z'}],
 ['equivalent nonzero offset publication',m=>{m.datePosted='2026-02-12T00:24:20.084+05:30'}],
])test('Coherent native compatibility '+name,()=>assert.equal(inspect(edit(change)).country,'United States'))
test('Flexible current same-role WebPage wording is preserved',()=>assert.equal(inspect(editSchema(html,'WebPage',m=>{m.name='Explore '+row.title+' opportunities at Hex'})).country,'United States'))
test('Unrelated footer Company text is outside actual same-role criteria',()=>assert.equal(inspect(html.replace('</footer>','<section><p>Company</p><p>Other footer navigation</p></section></footer>')).country,'United States'))
test('Coherent native semantic criteria remain supported',()=>assert.equal(inspect(insertMain('<section><p>Country</p><p>United States</p></section><section><p>Employer</p><p>Hex</p></section><section><p>Posting status</p><p>active</p></section><section><p>Application URL</p><a href="'+row.url+'">Apply</a></section>')).country,'United States'))

for(const value of['2026-02-11T18:54:20.084+00:00','2026-02-12T00:24:20.084+05:30'])test('Current source date preserves exact original offset '+value,()=>{const date=constraints([{key:'datePosted',value}],[],{employer:'Hex',observedAt:at,countryAlternatives:['United States']}).posted[0];assert.equal(date.raw,value);assert.equal(date.iso,'2026-02-11T18:54:20.084Z');assert.equal(date.precision,'millisecond')})

test('Closing own role identity change prevents configured zero',async()=>{const io=replay(r=>r.requestedUrl===row.url&&r.phase.startsWith('closing')?withBody(r,text(r).replace('data-jid="4159564c-f4a6-4034-93a6-928c579d96ce"','data-jid="5159564c-f4a6-4034-93a6-928c579d96ce"')):r);await assert.rejects(runCurrentHex({fetchImpl:io.fetchImpl,now:at,requestIntervalMs:0}),error);assert.equal(io.calls.length,86)})
test('Closing own membership change prevents configured zero',async()=>{const io=replay(r=>r.phase==='closing-careers'?withBody(r,text(r).replace('AI Research Engineer','Different Advertised Role')):r);await assert.rejects(runCurrentHex({fetchImpl:io.fetchImpl,now:at,requestIntervalMs:0}),error);assert.equal(io.calls.length,86)})
for(const field of['fetchText','fetchPage','fetchJson'])test('Current ordinary factory rejects non-Response '+field+' adapters',async()=>{let calls=0;await assert.rejects(createHexScraper().run({[field]:async()=>{calls++;return index}}),error);assert.equal(calls,0)})
test('Zero caller cap returns coverage gap with no acquisitions or zero claim',async()=>{const io=replay(),jobs=await runCurrentHex({fetchImpl:io.fetchImpl,maxJobs:0,now:at,requestIntervalMs:0});assert.equal(io.calls.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.notEqual(assessSoftFailureAcquisition(metadata,jobs).zeroJobEvidence,'fetched-zero')})
test('Already aborted opaque caller reason is preserved without acquisitions',async()=>{const c=new AbortController(),reason={caller:'opaque'},io=replay();c.abort(reason);await assert.rejects(runCurrentHex({fetchImpl:io.fetchImpl,signal:c.signal}),e=>e===reason);assert.equal(io.calls.length,0)})
test('Queued opaque abort from supported final audit callback is awaited before transport closes',async()=>{const c=new AbortController(),reason={caller:'audit-abort'};await assert.rejects(runCurrentHex({signal:c.signal,maxJobs:0,now:at,onAudit:()=>{queueMicrotask(()=>c.abort(reason))}}),e=>e===reason)})
for(const status of[202,401,402,403,406,407,429,451])test('Public origin denial '+status+' is never retried',async()=>{let calls=0;const io=currentReader([CAREERS],['https://hex.tech'],{requestIntervalMs:0,fetchImpl:async()=>{calls++;return Object.defineProperty(new Response('Denied',{status,headers:{'content-type':'text/html'}}),'url',{value:CAREERS})}});try{await assert.rejects(io.read(CAREERS),e=>e.status===status);await assert.rejects(io.read(CAREERS),e=>e.nativeUnavailable===true);assert.equal(calls,1)}finally{io.close()}})
for(const[name,change]of[
 ['unexpected response URL',r=>({...r,url:'https://other.example/careers/'})],
 ['wrong original MIME',r=>({...r,headers:{...r.headers,'content-type':'application/json'}})],
 ['invalid original UTF8',r=>({...r,bodyBase64:Buffer.from([255]).toString('base64')})],
])test('Original response boundary holds '+name,async()=>{const io=replay(change);await assert.rejects(runCurrentHex({fetchImpl:io.fetchImpl,requestIntervalMs:0,now:at}),error);assert.equal(io.calls.length,1)})
