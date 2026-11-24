import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const genuineHiverFixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
export async function replayCurrentHiver({change,options={},catalog=false}={}){
 const calls=[],counts=new Map(),original=globalThis.fetch
 const fetchImpl=async(url,init={})=>{
  const value=String(url),pass=(counts.get(value)??0)+1;counts.set(value,pass)
  const base=(pass===1?genuineHiverFixture.opening:genuineHiverFixture.closing).find(p=>p.requestedURL===value)??genuineHiverFixture.assets.find(p=>p.requestedURL===value)
  assert.ok(base,'Unexpected/non-published native URL '+value);assert.ok(pass<=2,'Unbounded or duplicate native request '+value)
  const packet=structuredClone(base);await change?.(packet,{pass,number:calls.length+1,init});calls.push({url:value,pass,init,packet})
  const bytes=Buffer.from(packet.bodyBase64,'base64'),response=new Response(bytes,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }
 globalThis.fetch=fetchImpl
 try{const scraper=catalog?createCatalogScraper(getScraperCatalog().find(p=>p.source==='hiver')):{run};return{jobs:await scraper.run({fetchImpl,requestIntervalMs:0,now:()=>genuineHiverFixture.capturedAt,...options}),calls}}
 finally{globalThis.fetch=original}
}

test('current genuine Hiver publication returns the complete selected typedIndia role instead of the legacy empty-template result',async()=>{
 const {jobs,calls}=await replayCurrentHiver()
 assert.equal(jobs.length,1)
 const job=jobs[0]
 assert.equal(job.source,'hiver');assert.equal(job.company,'Hiver');assert.equal(job.jobId,'607644');assert.equal(job.requisitionId,'REQ-0098');assert.equal(job.nativeJobID,'582830')
 assert.equal(job.country,'India');assert.equal(job.postingDate,'2026-10-27T11:50:58+00:00');assert.equal(job.nativeLegalEmployer,null)
 for(const phrase of ['Own end-to-end quality','4+ years of experience','golden datasets','Langfuse','Working knowledge of how LLM features are built','Anurag Maherchandani','We specialise in delivering innovative solutions'])assert.ok(job.jobDescription.includes(phrase),'Complete original criterion/context missing: '+phrase)
 assert.equal(job.applyUrl,job.sourceUrl+'/applications/new');assert.equal(job.sourceRenderedApplicationQualified,false)
 assert.equal(jobs.nativeCollectionEvidence.opening.rows.length,12);assert.equal(jobs.nativeCollectionEvidence.opening.held.length,11);assert.equal(jobs.nativeCollectionEvidence.closing.rows.length,12)
 assert.equal(jobs.nativeCollectionEvidence.originalResponses.length,24);assert.equal(calls.length,24)
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.ok(job.jobDescription.includes('short practical coding exercise'));assert.ok(job.jobDescription.includes('HM Round'));assert.ok(job.jobDescription.includes('HR Discussion'))
 for(const {init}of calls){assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.ok(!Object.keys(init.headers).some(k=>/cookie|authorization/i.test(k)));assert.match(init.headers['User-Agent'],/Chrome\/138\.0\.0\.0/)}
})

const setBody=(p,fn)=>{p.bodyBase64=Buffer.from(fn(Buffer.from(p.bodyBase64,'base64').toString('utf8'))).toString('base64')}
const setFeed=(p,fn)=>{if(p.kind==='feed')setBody(p,body=>{const model=JSON.parse(body);fn(model,model.data.find(r=>r.id==='607644'));return JSON.stringify(model)})}
const replaceJSON=(html,predicate,fn)=>{
 const d=readNativeDocument(html),script=d.nodes(n=>n.tag==='script'&&predicate(n))[0];assert.ok(script,'Genuine own JSON carrier not found')
 const model=JSON.parse(script.raw);fn(model);return html.replace(script.raw,JSON.stringify(model))
}
const setPosting=(p,fn)=>{if(p.kind==='role')setBody(p,body=>replaceJSON(body,n=>n.attrs.type==='application/ld+json',fn))}
const setComponent=(p,name,index,fn)=>{
 if(p.kind!=='role'&&p.kind!=='board')return
 setBody(p,body=>{const d=readNativeDocument(body),script=d.nodes(n=>n.tag==='script'&&n.attrs['data-component-name']===name)[index];assert.ok(script,'Genuine native component not found');const model=JSON.parse(script.raw);fn(model);return body.replace(script.raw,JSON.stringify(model))})
}
const rich='External::Careerspage::Renderrichtrixcontent',criterion='<div><!--block-->Applicants must hold a PhD in cryptography and a current cloud-security certification before applying.</div>'
function addCompleteCriterion(p,html=criterion){
 setFeed(p,(_,row)=>{row.benefits+=html})
 setPosting(p,model=>{model.description+=html.replaceAll('<!--block-->','')})
 if(p.kind==='role')setComponent(p,rich,3,model=>{model.htmlString+=html})
}
const reject=async change=>assert.rejects(replayCurrentHiver({change}),/Hiver current native:/)

test('a complete current new qualification is retained across feed, all native criterion representations and both passes',async()=>{
 const {jobs}=await replayCurrentHiver({change:p=>addCompleteCriterion(p)})
 assert.ok(jobs[0].jobDescription.includes('PhD in cryptography'));assert.ok(jobs[0].sourceDescription.includes('cloud-security certification before applying'))
 assert.ok(jobs[0].sourceNativeModel.benefits.endsWith(criterion))
})
for(const index of [0,1,2,3])test('complete benign qualification in stage '+index+' remains retained consistently',async()=>{
 const {jobs}=await replayCurrentHiver({change:p=>{if(p.kind==='role')setComponent(p,'External::Jobs::Stagescarousel',0,m=>{m.stages[index].description+=criterion})}})
 assert.ok(jobs[0].jobDescription.includes('PhD in cryptography'));assert.ok(jobs[0].jobDescription.includes('short practical coding exercise'))
 assert.ok(jobs[0].sourceNativeHiringConditions.stages[index].description.endsWith(criterion))
})

const reviewedAuthority=[
 'Applicants must reside in the United States.',
 'Applicants must live in the United States.',
 'Your appointment will be issued by Acme Corporation.',
 'Your contract will be issued by Acme Corporation.',
 'You will work in New York, United States.',
 'Your primary place of work is New York, United States.',
 'Important: Applications close on 1 November 2026.',
 'Please note: Apply before 1 November 2026.',
 'Candidates may apply no later than 1 November 2026.',
 'The position is United States based.',
]
for(const paragraph of reviewedAuthority)test('reviewed authority in all complete both-pass criterion carriers holds: '+paragraph,()=>reject(p=>addCompleteCriterion(p,'<p>'+paragraph+'</p>')))
for(const [index,paragraph]of [reviewedAuthority[0],reviewedAuthority[2],reviewedAuthority[6],reviewedAuthority[4]].entries())test('reviewed authority in complete stage '+index+' holds: '+paragraph,()=>reject(p=>{if(p.kind==='role')setComponent(p,'External::Jobs::Stagescarousel',0,m=>{m.stages[index].description+='<p>'+paragraph+'</p>'})}))
for(const paragraph of [
 'Residence requirements: The successful candidate needs residency authorization in another jurisdiction.',
 'Applicants are required to be domiciled in a different jurisdiction.',
 'This position is based outside the originally advertised area.',
 'Perform all work from the stated base.',
 'Contracting party: Acme Corporation issues the appointment.',
 'The offer letter identifies Acme Corporation as the appointing body.',
 'Submission note: candidates may APPLY by the stated closing point.',
 'Entry window: an application can be made during this interval.',
])test('unbound authority topic holds as a complete clause irrespective of prefix or verb: '+paragraph,()=>reject(p=>addCompleteCriterion(p,'<p>'+paragraph+'</p>')))
for(const paragraph of [
 'Acme Corporation will hire you.',
 'You will be a contractor for Acme Corporation.',
 'Relocate to United States before starting.',
 'Your base will be United States.',
])test('authority topic morphology and nominal workplace do not depend on a particular sentence: '+paragraph,()=>reject(p=>addCompleteCriterion(p,'<p>'+paragraph+'</p>')))
for(const [label,fn]of [
 ['typed native country changed',m=>{m.jobLocation.address.addressCountry='US'}],
 ['typed country absent',m=>{delete m.jobLocation.address.addressCountry}],
 ['an additional foreign place carrier',m=>{m.jobLocation=[m.jobLocation,{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'US'}}]}],
 ['unqualified raw country suffix',m=>{m.jobLocation.address={addressLocality:'Bangalore, IN'}}],
 ['conflicting applicant country',m=>{m.applicantLocationRequirements.name='United States'}],
 ['employer name changed',m=>{m.hiringOrganization.name='Acme Corporation'}],
 ['employer corporate URL changed',m=>{m.hiringOrganization.url='https://example.org'}],
 ['employer sameAs changed',m=>{m.hiringOrganization.sameAs='https://example.org'}],
 ['nested employer context changed',m=>{m.hiringOrganization['@context']='https://example.org'}],
 ['native title changed',m=>{m.title='Another title'}],
 ['native public UUID changed',m=>{m.identifier.value='23b5df4c-2320-4b1d-b72a-a4bfcfbc1844'}],
 ['future native posting date',m=>{m.datePosted='2036-10-27T11:50:58+00:00'}],
 ['invalid native UTC calendar date',m=>{m.datePosted='2026-02-30T11:50:58+00:00'}],
 ['new explicit past expiry',m=>{m.validThrough='2026-11-01T00:00:00+00:00'}],
 ['unreviewed extra mandatory schema field',m=>{m.qualifications='Applicants must hold a cryptography doctorate.'}],
 ['blank full native schema description',m=>{m.description=' '}],
 ['nonstring full native schema description',m=>{m.description={text:'Required criteria'}}],
])test('holds '+label,()=>reject(p=>setPosting(p,fn)))

for(const [label,fn]of [
 ['native job ID substituted for public posting',r=>{r.id='582830'}],
 ['native formal requisition changed',r=>{r.job.requisition_id='REQ-0000'}],
 ['selected combined location conflicts with typed country',r=>{r.location.name='New York - United States'}],
 ['extra native role location',r=>{r.locations=[r.location,{name:'United States'}]}],
 ['unknown extra selected qualification field',r=>{r.qualifications='Applicants must hold a cryptography doctorate.'}],
 ['new native deadline',r=>{r.deadline_at='2026-11-01T00:00:00Z'}],
 ['unreviewed compensation field value',r=>{r.compensation='Unreviewed native pay condition'}],
 ['changed reporting line',r=>{r.reporting_to='Another person'}],
 ['malformed full criterion field',r=>{r.benefits={text:'Required criteria'}}],
 ['blank full criterion field',r=>{r.benefits=' '}],
])test('holds '+label,()=>reject(p=>setFeed(p,(_,row)=>fn(row))))

for(const statement of [
 'This role is based in United States.',
 'This position is located in United States.',
 'Your employer will be Acme Corporation.',
 'You will be employed directly by Acme Corporation.',
 'The hiring entity for this position is Acme Corporation.',
 'Your employing company will be Acme Corporation.',
 'The employing entity is Acme Corporation.',
 'You will be working for Acme Corporation.',
 'The successful candidate will work for Acme Corporation.',
 'Your duty station is New York, United States.',
 'This position is assigned to New York, United States.',
 'You will be stationed in New York, United States.',
 'Applications close on 1 November 2026.',
 'Applications must be received by 1 November 2026.',
 'Applications will be accepted until 1 November 2026.',
 'The application deadline is 1 November 2026.',
 'Apply by 1 November 2026.',
 'Please send your CV no later than 1 November 2026.',
 'Submit your resume by 1 November 2026.',
 'Résumés must be received by 1 November 2026.',
])test('holds full unreviewed authority paragraph: '+statement,()=>reject(p=>addCompleteCriterion(p,'<div><!--block-->'+statement+'</div>')))

for(const field of ['description','key_responsibilities','skills_knowledge_expertise','benefits'])test('a full original '+field+' cannot be silently omitted',()=>reject(p=>setFeed(p,(_,row)=>{row[field]='<p>Short replacement</p>'})))

test('unknown new own authored criterion outside the reviewed fields holds in visible and inactive scopes',async()=>{
 for(const attrs of ['', ' hidden',' aria-hidden="true"',' inert',' style="display:none"'])await reject(p=>{if(p.kind==='role')setBody(p,body=>body.replace('</body>','<section itemprop="qualifications"'+attrs+'>Applicants must hold a cryptography doctorate.</section></body>'))})
})
for(const statement of ['This position is filled.','This job is not available.','This position is currently unavailable.','Applications are now closed.'])test('active opening or closing unavailable notice holds: '+statement,async()=>{
 for(const closingOnly of [false,true])await reject((p,{pass})=>{if(p.kind==='role'&&(!closingOnly||pass===2))setBody(p,b=>b.replace('</body>','<p>'+statement+'</p></body>'))})
})
test('closing-only complete criterion drift holds after the independent full second pass',async()=>{
 let last
 await assert.rejects(replayCurrentHiver({change:(p,c)=>{last=c.number;if(c.pass===2)addCompleteCriterion(p)}}),/fresh closing/)
 assert.equal(last,24)
})
test('uninspected raw listing observations and unknown tile kinds are retained without promoting them into vacancies',async()=>{
 const {jobs}=await replayCurrentHiver({change:p=>setFeed(p,m=>m.data.push({id:'99999999',title:'Newsletter',kind:'unreviewed-promotion'}))})
 const a=jobs.nativeCollectionEvidence;assert.equal(jobs.length,1);assert.equal(a.observedRecordCount,13);assert.equal(a.observedVacancyCount,1);assert.equal(a.recordKind,'mixed');assert.equal(a.opening.held.length,12);assert.equal(a.opening.rows.at(-1).kind,'unreviewed-promotion')
})

test('derived audit and inventory narratives retain actual observation, typed-vacancy and hold counts after a held promotion',async()=>{
 for(const catalog of [false,true]){
 const {jobs}=await replayCurrentHiver({catalog,options:{maxJobs:1},change:p=>setFeed(p,m=>m.data.push({id:'99999999',title:'Newsletter',kind:'unreviewed-promotion'}))})
 const audit=jobs.nativeCollectionEvidence,reason=readInventoryEvidence(jobs).reason
 assert.equal(audit.observedRecordCount,13);assert.equal(audit.observedVacancyCount,1);assert.equal(audit.opening.held.length,12)
 assert.ok(audit.observationCountSemantics.includes('13 original native feed observations'))
 assert.ok(audit.observationCountSemantics.includes('1 independently hydrated full typed JobPosting'))
 assert.ok(audit.observationCountSemantics.includes('12 uninspected rows'))
 assert.ok(reason.includes('13-native-records;1-native-typed-vacancies;12-uninspected-holds'))
 }
})
test('caller limits preserve all12 observations, one proven typed vacancy and full receipts through actual catalog decoration',async()=>{
 const fixture=await replayCurrentHiver({options:{maxJobs:1}}),provider=getScraperCatalog().find(p=>p.source==='hiver'),counts=new Map(),fetchImpl=async url=>{const n=(counts.get(url)??0)+1;counts.set(url,n);const p=(n===1?genuineHiverFixture.opening:genuineHiverFixture.closing).find(p=>p.url===url)??genuineHiverFixture.assets.find(p=>p.url===url);assert.ok(p);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.url});return r}
 const jobs=await createCatalogScraper(provider).run({fetchImpl,requestIntervalMs:0,maxJobs:1,now:()=>genuineHiverFixture.capturedAt})
 for(const a of [fixture.jobs.nativeCollectionEvidence,jobs.nativeCollectionEvidence]){assert.equal(a.recordKind,'mixed');assert.equal(a.observedRecordCount,12);assert.equal(a.observedVacancyCount,1);assert.equal(a.originalResponses.length,24);assert.equal(a.opening.held.length,11)}
})
test('empty feed cannot certify current zero',()=>reject(p=>setFeed(p,m=>{m.data=[]})))
test('duplicate native observation identity holds',()=>reject(p=>setFeed(p,m=>{m.data.push(m.data[0])})))
test('current native JSON duplicate decoded country keys hold',()=>reject(p=>{if(p.kind==='role')setBody(p,b=>b.replace('"addressCountry":"IN"','"addressCountry":"IN","addressCountry":"US"'))}))
test('current declared feed component URL/account cannot change',()=>reject(p=>{if(p.kind==='board')setComponent(p,'External::Jobs',0,m=>{m.url='https://another.pinpointhq.com/postings.json'})}))

for(const kind of ['corporate','board','role'])test('a new active base URL in '+kind+' holds',()=>reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace('<head>','<head><base href="https://example.org/">'))}))
for(const kind of ['corporate','board','role'])test('new inline hiding/style/controller context in '+kind+' holds',()=>reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace('</head>','<style>body{display:none}</style></head>'))}))
for(const kind of ['board','role'])test('new or altered native nonce/CSRF/component binding in '+kind+' holds',async()=>{
 await reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace('name="csp-nonce" content="','name="csp-nonce" content="0'))})
 await reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace('name="csrf-token"','name="unreviewed-csrf-token"'))})
 await reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace('data-dom-id="','data-dom-id="other-'))})
 await reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace('type="application/json" class="js-react-on-rails-component"','type="application/json" src="" class="js-react-on-rails-component"'))})
})
for(const header of ['content-security-policy','content-type','cache-control','refresh'])test('critical native '+header+' drift holds',()=>reject(p=>{if(p.kind==='role')p.headers[header]=header==='refresh'?'0; url=https://example.org/':'unreviewed'}))
test('an unreviewed partial-entity response header holds',()=>reject(p=>{if(p.kind==='role')p.headers['content-range']='bytes 0-100/999999'}))

test('both complete genuinely observed cache/session/nonce/component representations qualify independently',async()=>{
 const {jobs,calls}=await replayCurrentHiver({change:p=>{const current=genuineHiverFixture.closing.find(c=>c.requestedURL===p.requestedURL);if(current)Object.assign(p,structuredClone(current))}})
 assert.equal(jobs.length,1);assert.equal(calls.length,24);assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,12)
})

test('corporate cache stylesheet timestamps and Last-Modified are provenance',async()=>{
 assert.equal((await replayCurrentHiver({change:p=>{if(p.kind==='corporate')setBody(p,b=>b.replace(/wpr_t=(\d{10})/,(_,v)=>'wpr_t='+(Number(v)+1)))}})).jobs.length,1)
 assert.equal((await replayCurrentHiver({change:p=>{if(p.kind==='corporate')p.headers['last-modified']=new Date(Date.parse(p.headers['last-modified'])+1000).toUTCString()}})).jobs.length,1)
})

test('corporate cache comments are provenance while new authored hiring conditions hold',async()=>{
 assert.equal((await replayCurrentHiver({change:p=>{if(p.kind==='corporate')p.headers['cache-control']='max-age=1, must-revalidate'}})).jobs.length,1)
 assert.equal((await replayCurrentHiver({change:p=>{if(p.kind==='corporate')setBody(p,b=>b.replace(/(<!--\n\tgenerated)/,'<!-- unreviewed condition -->$1'))}})).jobs.length,1)
 await reject(p=>{if(p.kind==='corporate')setBody(p,b=>b+'<p>Applicants must hold an additional certification.</p>')})
})

test('corporate decorative background UUID and image carriers are provenance',async()=>{
 const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url))),slot=profile.corporate.variableSlots[0]
 assert.equal((await replayCurrentHiver({change:p=>{if(p.kind==='corporate')setBody(p,b=>{const match=b.match(new RegExp('var\\(--wpr-bg-([a-f0-9-]+)\\)'));assert.ok(match);return b.replace(match[0],'var(--wpr-bg-00000000-0000-4000-8000-000000000000)')})}})).jobs.length,1)
 assert.equal((await replayCurrentHiver({change:p=>{if(p.kind==='corporate')setBody(p,b=>{const hash=b.match(new RegExp('var\\(--wpr-bg-([a-f0-9-]+)\\)'))?.[1];assert.ok(hash);return b+'<!--'+hash+'-->'})}})).jobs.length,1)
 assert.equal((await replayCurrentHiver({change:p=>{if(p.kind==='corporate')setBody(p,b=>{assert.ok(b.includes(slot.url));return b.replace(slot.url,slot.url+'?unreviewed-image=1')})}})).jobs.length,1)
})


for(const kind of ['board','role'])test('passive '+kind+' image scope and all anonymous query carriers must agree',async()=>{
 await reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace('/pd2uomwny6htdxkrsq18ntuki8ck','/another-native-object'))})
 await reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace(/X-Amz-Signature=([a-f0-9]{64})/,(_,v)=>'X-Amz-Signature='+v.slice(1)))})
 await reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace(/X-Amz-Expires=300/g,'X-Amz-Expires=301'))})
 await reject(p=>{if(p.kind===kind)setBody(p,b=>b.replace(/X-Amz-SignedHeaders=host/g,'X-Amz-SignedHeaders=host&amp;unreviewed=1'))})
})

for(const kind of ['board','role'])test('unique '+kind+' nonce, CSRF and React target bindings reject unknown carriers',async()=>{
 await reject(p=>{if(p.kind===kind)setBody(p,b=>{const d=readNativeDocument(b),m=d.nodes(n=>n.tag==='meta'&&n.attrs.name==='csp-nonce')[0];assert.ok(m);return b.replace('</body>','<!--'+m.attrs.content+'--></body>')})})
 await reject(p=>{if(p.kind===kind)setBody(p,b=>{const d=readNativeDocument(b),m=d.nodes(n=>n.tag==='meta'&&n.attrs.name==='csrf-token')[0];assert.ok(m);return b.replace('</head>','<meta name="csrf-token" content="'+m.attrs.content+'"></head>')})})
 await reject(p=>{if(p.kind===kind)setBody(p,b=>{const d=readNativeDocument(b),m=d.nodes(n=>n.tag==='script'&&n.attrs.class==='js-react-on-rails-component')[0];assert.ok(m);const id=m.attrs['data-dom-id'];assert.ok(b.includes(' id="'+id+'"'));return b.replace(' id="'+id+'"',' hidden id="'+id+'"')})})
})

test('a closing-only native controller or membership change remains held',async()=>{
 await reject((p,{pass})=>{if(pass===2&&p.requestedURL===genuineHiverFixture.assets[3].requestedURL)setBody(p,b=>b+'/* current changed renderer */')})
 await reject((p,{pass})=>{if(pass===2)setFeed(p,m=>{m.data=m.data.filter(r=>r.id!=='607644')})})
})

for(const index of [0,1,2,3,4,5,6,7])test('complete native declared asset bytes '+index+' cannot drift',()=>reject(p=>{if(p.requestedURL===genuineHiverFixture.assets[index].requestedURL)setBody(p,b=>b+'\n/* changed current native controller/style */')}))
test('an own Apply Now URL with another posting or a disabled control holds',async()=>{
 await reject(p=>{if(p.kind==='role')setBody(p,b=>b.replace('/en/postings/64a310b6-2717-4478-bd32-d299502f5e89/applications/new','/en/postings/23b5df4c-2320-4b1d-b72a-a4bfcfbc1844/applications/new'))})
 await reject(p=>{if(p.kind==='role')setBody(p,b=>b.replace('>Apply Now</a>',' disabled>Apply Now</a>'))})
})
test('ordinary denied or redirected native pages remain unresolved',async()=>{
 for(const status of [403,302])await reject(p=>{if(p.kind==='board'){p.status=status;p.headers.location='https://example.org/'}})
})
test('pre-aborted frozen and primitive caller reasons remain exact with no reads',async()=>{
 for(const reason of [Object.freeze(Error('caller-stop')),'caller-string-stop',37]){
  const controller=new AbortController();controller.abort(reason);let reads=0
  await assert.rejects(run({signal:controller.signal,fetchImpl:()=>{reads++}}),e=>e===reason);assert.equal(reads,0)
 }
})
test('in-flight caller abort preserves its frozen reason and releases the active stream once',async()=>{
 const controller=new AbortController(),reason=Object.freeze(Error('caller-in-flight-stop'));let canceled=0,released=0
 const p=genuineHiverFixture.opening[0],fetchImpl=async()=>({status:200,url:p.url,headers:new Headers(p.headers),body:{getReader:()=>({read:()=>{setTimeout(()=>controller.abort(reason),5);return new Promise(()=>{})},cancel:value=>{assert.equal(value,reason);canceled++},releaseLock:()=>{released++}})}})
 await assert.rejects(run({signal:controller.signal,fetchImpl}),e=>e===reason);assert.equal(canceled,1);assert.equal(released,1)
})
test('source deadline settles an uncooperative fetch without extending production bounds',async()=>{
 const started=performance.now();await assert.rejects(run({fetchImpl:()=>new Promise(()=>{}),sourceTimeoutMs:20}),/source deadline/);assert.ok(performance.now()-started<1500)
})
test('intrinsic streaming byte bound rejects before buffering and disposes the reader once',async()=>{
 let readCount=0,canceled=0,released=0;const p=genuineHiverFixture.opening[0]
 await assert.rejects(run({fetchImpl:async()=>({status:200,url:p.url,headers:new Headers(p.headers),body:{getReader:()=>({read:async()=>{readCount++;return{done:false,value:new Uint8Array(4_000_001)}},cancel:()=>{canceled++},releaseLock:()=>{released++}})}})}),/streaming entity/)
 assert.equal(readCount,1);assert.equal(canceled,1);assert.equal(released,1)
})
