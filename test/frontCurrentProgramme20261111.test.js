import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readFrontCorporate,readFrontFeed,readFrontApi,reconcileFrontProgramme} from '../scraper/front/currentProgrammeData.js'
import {readFrontNativeHtml,deriveFrontBoardRoot} from '../scraper/front/currentProgrammeRenderer.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/front-current-programme-openings-20261111.json.gz',import.meta.url))))
const sourceFixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/ashby-renderer-source-certificate-20261111.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const rows=()=>structuredClone(fixture.responses)
const row=(values,kind)=>values.find(value=>value.kind===kind)
const text=value=>Buffer.from(value.bodyBase64,'base64').toString('utf8')
const setText=(value,html)=>{value.bodyBase64=Buffer.from(html).toString('base64');value.bodySHA256=sha(Buffer.from(html));value.bodyBytes=Buffer.byteLength(html)}
const input=value=>({text:text(value),url:value.finalURL,headers:value.headers,headerEntries:value.headerEntries})
const raw=value=>({requestedURL:value.requestedURL,finalURL:value.finalURL,status:value.status,headers:value.headers,headerEntries:value.headerEntries,body:Buffer.from(value.bodyBase64,'base64')})
const native=value=>readFrontNativeHtml(input(value))
const sources=()=>{
  const original=sourceFixture.graphs.find(value=>value.declaration.version==='b5428a08d3c1ba1dd3bbcd88b917eaa284bed83a')
  return {declaration:structuredClone(original.declaration),packets:Object.fromEntries(Object.entries(original.packets).map(([kind,value])=>[kind,{requestedURL:value.requestedURL,finalURL:value.finalURL,status:value.status,headers:structuredClone(value.headers),body:Buffer.from(value.bodyBase64,'base64')}]))}
}
const hold=(action,reason)=>assert.throws(action,error=>error.code==='FRONT_PROGRAMME_HOLD'&&new RegExp(reason).test(error.reason))
function jsonScript(value,kind,change){
  const html=text(value),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  const script=scripts.find(match=>kind==='boot'?match[1].includes('window.__appData'):kind==='next'?match[0].includes('id="__NEXT_DATA__"'):match[0].includes('type="application/ld+json"'))
  assert.ok(script,'Synthetic control found its actual original carrier')
  let start=0,end=script[1].length
  if(kind==='boot'){const assignment=parse(script[1],{ecmaVersion:'latest'}).body[0].expression;start=assignment.right.start;end=assignment.right.end}
  const old=script[1].slice(start,end),valueJSON=JSON.parse(old);change(valueJSON)
  setText(value,html.replace(script[1],script[1].slice(0,start)+JSON.stringify(valueJSON)+script[1].slice(end)))
}
function jsonBody(value,change){const model=JSON.parse(text(value));change(model);setText(value,JSON.stringify(model))}
const encode=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
function metadata(value,name,newValue){
  let changed=0
  setText(value,text(value).replace(/<meta\b[^>]*>/gi,tag=>{
    if(!tag.includes('name="'+name+'"')&&!tag.includes('property="'+name+'"'))return tag
    changed++;return tag.replace(/content="[\s\S]*?"/,'content="'+encode(newValue)+'"')
  }))
  assert.equal(changed,1,'Synthetic control changed one actual head representation')
}
function appendCriterion(values,html,plain){
  const id='91e4b4ad-9ce3-4bc7-896e-f36ff234eca1',own=row(values,'own-91e4b4ad')
  jsonBody(row(values,'native-api'),a=>{const job=a.jobs.find(j=>j.id===id);job.descriptionHtml+=html;job.descriptionPlain+='\n\n'+plain})
  jsonScript(own,'boot',m=>{m.posting.descriptionHtml+=html})
  jsonScript(own,'ld',m=>{m.description+=html})
  const updated=JSON.parse(text(row(values,'native-api'))).jobs.find(j=>j.id===id).descriptionPlain
  for(const name of ['description','og:description','twitter:description'])metadata(own,name,updated)
}
function parsed(values){
  return {corporate:readFrontCorporate(input(row(values,'corporate'))),feed:readFrontFeed(input(row(values,'corporate-feed'))),
    board:native(row(values,'native-board')),api:readFrontApi(input(row(values,'native-api'))),roles:values.filter(v=>v.kind.startsWith('own-')).map(native)}
}
const reconcile=values=>reconcileFrontProgramme(parsed(values))

test('the portable corpus retains eight separately clocked originals and no closings',()=>{
  assert.equal(fixture.responses.length,8);assert.equal(fixture.acquiredClosingEntities,0);assert.equal(fixture.completeTransaction,false)
  for(const value of fixture.responses){const bytes=Buffer.from(value.bodyBase64,'base64');assert.equal(bytes.length,value.bodyBytes);assert.equal(sha(bytes),value.bodySHA256);assert.equal(value.status,200);assert.equal(value.requestedURL,value.finalURL)}
})
test('corporate SSR and known first-party feed preserve every original group and own link',()=>{
  const values=rows(),corporate=readFrontCorporate(input(row(values,'corporate'))),feed=readFrontFeed(input(row(values,'corporate-feed')))
  assert.deepEqual(corporate.originalJobs,JSON.parse(text(row(values,'corporate-feed'))))
  assert.deepEqual(feed.originalGroups,corporate.originalJobs)
  assert.deepEqual(corporate.ownURLs,[
    'https://jobs.ashbyhq.com/frontcareers/91e4b4ad-9ce3-4bc7-896e-f36ff234eca1',
    'https://jobs.ashbyhq.com/frontcareers/625c97e4-2f4f-4109-82c2-4c5fa6ac837b',
    'https://jobs.ashbyhq.com/frontcareers/22e1f989-12d6-4c59-86a7-77335831e313',
    'https://jobs.ashbyhq.com/frontcareers/cbcfb59d-506f-426d-8446-c13cfba928ac',
  ])
  assert.equal(corporate.publicationFacts.browserExecutionQualified,false)
})
test('API envelope preserves the exact string version and original order/full records',()=>{
  const packet=row(rows(),'native-api'),result=readFrontApi(input(packet)),original=JSON.parse(text(packet))
  assert.deepEqual(result.originalPayload,original);assert.equal(result.originalPayload.apiVersion,'1')
  assert.equal(result.originalPayload.jobs[1].id,'cbcfb59d-506f-426d-8446-c13cfba928ac')
})
test('all four original own models parse without inventing mode or absent applicant fields',()=>{
  const values=rows().filter(v=>v.kind.startsWith('own-')).map(native)
  assert.deepEqual(values.map(v=>v.originalAppData.posting.workplaceType),['Hybrid','Hybrid',null,null])
  assert.equal(Object.hasOwn(values[2].originalLD,'jobLocationType'),false)
  assert.equal(Object.hasOwn(values[2].originalLD,'applicantLocationRequirements'),false)
  assert.equal(Object.hasOwn(values[3].originalLD,'applicantLocationRequirements'),false)
  assert.equal(values[0].declaration.version,'b5428a08d3c1ba1dd3bbcd88b917eaa284bed83a')
  assert.equal(values[2].declaration.version,'3cc7d666e152175eb6519e52d4513bfc65d309de')
})
test('complete original data reconciles all full criteria, salary tiers, consent and country scope',()=>{
  const values=rows(),result=reconcile(values),api=JSON.parse(text(row(values,'native-api')))
  assert.deepEqual(result.nativePayload,api);assert.equal(result.nativeRecords.length,4)
  assert.deepEqual(result.nativeRecords.map(v=>v.country),['Chile','United States','United States','United States'])
  for(const record of result.nativeRecords){
    const original=api.jobs.find(v=>v.id===record.id)
    assert.deepEqual(record.originalPublicRecord,original);assert.equal(record.originalNativePosting.descriptionHtml,original.descriptionHtml)
    assert.equal(record.originalSchema.description,original.descriptionHtml);assert.equal(record.countryQualificationScope,'finite-native-published-work-country')
    assert.equal(record.applicantEligibilityQualified,false);assert.equal(record.publisherLegalNameRegistryVerified,false)
  }
  const paid=result.nativeRecords.find(v=>v.id==='625c97e4-2f4f-4109-82c2-4c5fa6ac837b')
  assert.equal(paid.originalNativePosting.compensationTiers[0].title,'Zone 1')
  assert.equal(paid.originalSchema.baseSalary.value.minValue,160000)
  assert.equal(Buffer.byteLength(paid.originalNativePosting.compensationPhilosophyHtml),764)
  assert.equal(paid.originalNativePosting.legalEntityNameForTextingConsent,'Front Inc.')
  assert.equal(result.qualificationFacts.currentTransactionQualified,false)
  assert.equal(result.qualificationFacts.sourceScopeComplete,false)
})
test('root derivation internally certifies the five actual resources and exact O1 route',()=>{
  const result=deriveFrontBoardRoot({native:raw(row(rows(),'own-91e4b4ad')),sourceInput:sources()})
  assert.equal(result.url,'https://jobs.ashbyhq.com/frontcareers')
  assert.equal(result.sourceCertificate.sourceBodiesQualified,true)
  assert.equal(result.emissionFacts.customDomainDataPresent,false)
  assert.equal(result.emissionFacts.browserExecutionQualified,false)
})
for(const value of [1,'2',null])test('API version '+JSON.stringify(value)+' cannot replace original string1',()=>{
  const packet=row(rows(),'native-api');jsonBody(packet,m=>{m.apiVersion=value});hold(()=>readFrontApi(input(packet)),'api-version')
})
test('duplicate JSON keys cannot erase a contradictory API country',()=>{
  const packet=row(rows(),'native-api'),html=text(packet);setText(packet,html.replace('"addressCountry":"Chile"','"addressCountry":"India","addressCountry":"Chile"'))
  assert.notEqual(text(packet),html);hold(()=>readFrontApi(input(packet)),'json')
})
test('feed unknown criteria/filter fields are retained as an unsupported contract, not dropped',()=>{
  const packet=row(rows(),'corporate-feed');jsonBody(packet,m=>{m[0].jobs[0].experienceRequirements='12 years required'});hold(()=>readFrontFeed(input(packet)),'feed-shape')
})
test('a second corporate data carrier cannot shadow the native programme',()=>{
  const packet=row(rows(),'corporate');setText(packet,text(packet).replace('</body>','<script id="__NEXT_DATA__" type="application/json">{}</script></body>'));hold(()=>readFrontCorporate(input(packet)),'corporate-carrier')
})
test('a newly published corporate recruitment programme is not ignored',()=>{
  const packet=row(rows(),'corporate');setText(packet,text(packet).replace('</body>','<iframe title="Jobs" src="https://jobs.example/careers/"></iframe></body>'));hold(()=>readFrontCorporate(input(packet)),'corporate-programme')
})
for(const attribute of ['src=""','src="https://foreign.example/jobs.js"','nomodule','hidden','style="display:none"'])test('native boot attribute '+attribute+' cannot supply authority',()=>{
  const packet=row(rows(),'own-91e4b4ad');setText(packet,text(packet).replace(/<script nonce="([^"]+)">/,'<script nonce="$1" '+attribute+'>'));hold(()=>native(packet),'native-carrier')
})
for(const tag of ['svg','math','template'])test('foreign or inert '+tag+' boot carrier holds',()=>{
  const packet=row(rows(),'own-91e4b4ad');setText(packet,text(packet).replace(/(<script nonce="[^"]+">[\s\S]*?<\/script>)/,'<'+tag+'>$1</'+tag+'>'));hold(()=>native(packet),'native-carrier')
})
test('an unmatched document title cannot bind the original own model',()=>{
  const packet=row(rows(),'own-91e4b4ad');setText(packet,text(packet).replace('<title>Account Executive, SMB @ Front</title>','<title>Other role @ Other employer</title>'));hold(()=>native(packet),'native-title')
})
test('CSP or declared non-UTF8 cannot silently authorize the same native bytes',()=>{
  for(const [name,value] of [['content-security-policy',"script-src 'none'"],['content-type','text/html; charset=utf-16le']]){
    const packet=row(rows(),'own-91e4b4ad');packet.headers[name]=value;packet.headerEntries=null;hold(()=>native(packet),'security|encoding')
  }
})
test('root derivation rejects supplied authority flags and mixed native/source deployments',()=>{
  hold(()=>deriveFrontBoardRoot({native:{sourceBodiesQualified:true,url:'https://jobs.ashbyhq.com/frontcareers'},sourceInput:sources()}),'native-raw')
  const packet=row(rows(),'own-91e4b4ad');setText(packet,text(packet).replaceAll('b5428a08d3c1ba1dd3bbcd88b917eaa284bed83a','3cc7d666e152175eb6519e52d4513bfc65d309de'))
  hold(()=>deriveFrontBoardRoot({native:raw(packet),sourceInput:sources()}),'source-binding')
})
for(const change of [m=>{m.customDomainData=null},m=>{m.routerPrefix='/different'},m=>{m.organization.customJobsPageUrl='https://foreign.example/jobs'},m=>{m.organization.theme.jobPostingBackUrl='https://foreign.example/jobs'}])test('root emitter unknown boot branch holds',()=>{
  const packet=row(rows(),'own-91e4b4ad');jsonScript(packet,'boot',change);hold(()=>deriveFrontBoardRoot({native:raw(packet),sourceInput:sources()}),'native-model|native-organization|root-route')
})
for(const country of ['India','Unknown Republic',{name:'United States',identifier:'IN'}])test('published primary country '+JSON.stringify(country)+' cannot qualify a foreign zero',()=>{
  const values=rows();jsonBody(row(values,'native-api'),m=>{m.jobs[0].address.postalAddress.addressCountry=country});hold(()=>reconcile(values),'country')
})
test('foreign primary plus additional India stays held',()=>{
  const values=rows();jsonBody(row(values,'native-api'),m=>{m.jobs[0].secondaryLocations.push({location:'Bangalore, India'})});hold(()=>reconcile(values),'country')
})
test('a contradictory published applicant country is not replaced by typed work-country',()=>{
  const values=rows();jsonScript(row(values,'own-91e4b4ad'),'ld',m=>{m.applicantLocationRequirements.name='India'});hold(()=>reconcile(values),'country')
})
for(const [html,plain] of [
  ['<p>Applicants must be based in India.</p>','Applicants must be based in India.'],
  ['<p>Applicants must be based in Ind&#105;a.</p>','Applicants must be based in India.'],
  ['<p>Applicants must be based in Ind<span>ia</span>.</p>','Applicants must be based in India.'],
  ['<p>Work country: I<span style="display:none">X</span>ndia</p>','Work country: IXndia'],
  ['<p>Work location: Bangalore, Karnataka.</p>','Work location: Bangalore, Karnataka.'],
])test('consistent full authored geography '+plain+' holds foreign zero',()=>{
  const values=rows();appendCriterion(values,html,plain);hold(()=>reconcile(values),'geography|authored')
})
test('one authored numeric requirement cannot change in the API alone',()=>{
  const values=rows();jsonBody(row(values,'native-api'),m=>{assert.ok(m.jobs[0].descriptionHtml.includes('1+ years'));m.jobs[0].descriptionHtml=m.jobs[0].descriptionHtml.replace('1+ years','10+ years')});hold(()=>reconcile(values),'criteria')
})
test('a new own schema qualification cannot be omitted from full criteria',()=>{
  const values=rows();jsonScript(row(values,'own-91e4b4ad'),'ld',m=>{m.experienceRequirements='12 years mandatory'});hold(()=>reconcile(values),'schema-shape')
})
test('salary intervals and every original tier remain reconciled',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'ld',m=>{m.baseSalary.value.minValue=160001});hold(()=>reconcile(values),'salary')
})
test('published philosophy keeps its exact underlined link and all geographic conditions',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'boot',m=>{m.posting.compensationPhilosophyHtml+='<p>Applicants must be based in India.</p>'})
  hold(()=>reconcile(values),'geography')
})
test('unknown philosophy classes cannot conceal a published condition',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'boot',m=>{
    assert.ok(m.posting.compensationPhilosophyHtml.includes('class="postings-link"'))
    m.posting.compensationPhilosophyHtml=m.posting.compensationPhilosophyHtml.replace('class="postings-link"','class="unreviewed-hidden-condition"')
  });hold(()=>reconcile(values),'authored')
})
test('an inline split country in the known philosophy underline is still India',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'boot',m=>{m.posting.compensationPhilosophyHtml+='<p>Applicants must be based in Ind<u>ia</u>.</p>'})
  hold(()=>reconcile(values),'geography')
})
test('unknown philosophy styles cannot hide an authored requirement',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'boot',m=>{m.posting.compensationPhilosophyHtml=m.posting.compensationPhilosophyHtml.replace('<u>','<u style="font-size:0">')})
  hold(()=>reconcile(values),'authored')
})
test('the reviewed compensation philosophy link cannot be silently redirected',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'boot',m=>{m.posting.compensationPhilosophyHtml=m.posting.compensationPhilosophyHtml.replace('https://front.com/blog/pay-transparency-at-front','https://foreign.example/pay-policy')})
  hold(()=>reconcile(values),'authored')
})
test('orphan and cyclic teams cannot omit published role rows',()=>{
  const values=rows();jsonScript(row(values,'native-board'),'boot',m=>{m.jobBoard.teams[0].parentTeamId=m.jobBoard.teams[0].id});hold(()=>reconcile(values),'team')
})
test('unvisited own records and different feed order withhold complete data',()=>{
  const values=rows();values.splice(values.findIndex(v=>v.kind==='own-22e1f989'),1);hold(()=>reconcile(values),'membership')
  const changed=rows();jsonBody(row(changed,'corporate-feed'),m=>{m[0].jobs.reverse()});hold(()=>reconcile(changed),'corporate-feed')
})
test('a consistent synthetic removal retains all three actual remaining publications',()=>{
  const values=rows(),id='22e1f989-12d6-4c59-86a7-77335831e313',url='https://jobs.ashbyhq.com/frontcareers/'+id
  values.splice(values.findIndex(v=>v.kind==='own-22e1f989'),1)
  const corporate=row(values,'corporate')
  jsonScript(corporate,'next',m=>{for(const group of m.props.pageProps.jobs)group.jobs=group.jobs.filter(j=>j.key!==id)})
  let html=text(corporate),at=html.indexOf('href="'+url+'"')
  assert.ok(at>=0);const start=html.lastIndexOf('<li',at),end=html.indexOf('</li>',at)+5
  assert.ok(start>=0&&end>at);html=html.slice(0,start)+html.slice(end);setText(corporate,html)
  jsonBody(row(values,'corporate-feed'),m=>{for(const group of m)group.jobs=group.jobs.filter(j=>j.key!==id)})
  jsonBody(row(values,'native-api'),m=>{m.jobs=m.jobs.filter(j=>j.id!==id)})
  jsonScript(row(values,'native-board'),'boot',m=>{m.jobBoard.jobPostings=m.jobBoard.jobPostings.filter(j=>j.id!==id)})
  const result=reconcile(values)
  assert.deepEqual(result.nativeRecords.map(v=>v.id),['91e4b4ad-9ce3-4bc7-896e-f36ff234eca1','cbcfb59d-506f-426d-8446-c13cfba928ac','625c97e4-2f4f-4109-82c2-4c5fa6ac837b'])
  assert.equal(result.qualificationFacts.currentTransactionQualified,false)
})
for(const count of [0,7])test('an API inventory of '+count+' cannot be sampled into the reviewed programme',()=>{
  const packet=row(rows(),'native-api');jsonBody(packet,m=>{m.jobs=Array.from({length:count},()=>structuredClone(m.jobs[0]))});hold(()=>readFrontApi(input(packet)),'membership')
})
test('null native mode cannot become Remote from a coarse flag or new LD hint',()=>{
  const values=rows();jsonBody(row(values,'native-api'),m=>{m.jobs.find(j=>j.id==='22e1f989-12d6-4c59-86a7-77335831e313').isRemote=true});hold(()=>reconcile(values),'mode')
  const second=rows();jsonScript(row(second,'own-22e1f989'),'ld',m=>{m.jobLocationType='TELECOMMUTE'});hold(()=>reconcile(second),'schema-shape|mode')
})
test('invalid native dates and changed punctuation retain a material disagreement',()=>{
  const values=rows();jsonBody(row(values,'native-api'),m=>{m.jobs[0].publishedAt='2026-02-30T16:45:36.469+00:00'});hold(()=>reconcile(values),'date')
  const second=rows();jsonBody(row(second,'native-api'),m=>{assert.ok(m.jobs[0].descriptionPlain.includes('1+ years'));m.jobs[0].descriptionPlain=m.jobs[0].descriptionPlain.replace('1+ years','1 years')});hold(()=>reconcile(second),'criteria')
})
test('a consistent typed-address Bangalore label with foreign country still withholds zero',()=>{
  const values=rows();jsonBody(row(values,'native-api'),m=>{m.jobs[0].address.postalAddress.addressLocality='Bangalore'})
  jsonScript(row(values,'own-91e4b4ad'),'ld',m=>{m.jobLocation.address.addressLocality='Bangalore'});hold(()=>reconcile(values),'geography')
})
test('consistent India in the published title cannot escape typed foreign country checks',()=>{
  const values=rows(),id='91e4b4ad-9ce3-4bc7-896e-f36ff234eca1',title='Account Executive, SMB — India',old='Account Executive, SMB'
  jsonBody(row(values,'native-api'),m=>{m.jobs.find(j=>j.id===id).title=title})
  jsonBody(row(values,'corporate-feed'),m=>{m[0].jobs.find(j=>j.key===id).title=title})
  setText(row(values,'corporate'),text(row(values,'corporate')).replaceAll(old,title))
  jsonScript(row(values,'native-board'),'boot',m=>{m.jobBoard.jobPostings.find(j=>j.id===id).title=title})
  const own=row(values,'own-91e4b4ad');jsonScript(own,'boot',m=>{m.posting.title=title});jsonScript(own,'ld',m=>{m.title=title})
  setText(own,text(own).replace('<title>'+old+' @ Front</title>','<title>'+title+' @ Front</title>'))
  for(const name of ['title','og:title','twitter:title'])metadata(own,name,name==='title'?title+' @ Front':title)
  hold(()=>reconcile(values),'geography')
})
test('native metadata cannot add a navigation authority to an existing description',()=>{
  const packet=row(rows(),'own-91e4b4ad');setText(packet,text(packet).replace('<meta name="description"','<meta http-equiv="refresh" name="description"'))
  hold(()=>native(packet),'native-head')
})
test('derive reads every actual native byte without caller conversion callbacks',()=>{
  const packet=raw(row(rows(),'own-91e4b4ad')),original=packet.body,body=new Uint8Array(Buffer.concat([original,Buffer.from('<script>globalThis.newRole=true</script>')]))
  let calls=0;Object.defineProperty(body,'valueOf',{value(){calls++;return original}});packet.body=body
  hold(()=>deriveFrontBoardRoot({native:packet,sourceInput:sources()}),'native-carrier');assert.equal(calls,0)
})

for(const [name,htmlCountry,plainCountry]of [
  ['raw zero-width space','In\u200bdia','In\u200bdia'],
  ['raw zero-width joiner','In\u200ddia','In\u200ddia'],
  ['raw bidi override','\u202eaidnI\u202c','\u202eaidnI\u202c'],
  ['decimal entity','In&#8203;dia','In\u200bdia'],
  ['hex entity','In&#x200d;dia','In\u200ddia'],
  ['named entity','In&ZeroWidthSpace;dia','In\u200bdia'],
])test('consistent authored '+name+' cannot mask work-country text',()=>{
  const values=rows()
  appendCriterion(values,'<p>This position is based in '+htmlCountry+'.</p>','This position is based in '+plainCountry+'.')
  const api=JSON.parse(text(row(values,'native-api'))).jobs[0],own=native(row(values,'own-91e4b4ad'))
  assert.equal(api.descriptionHtml,own.originalAppData.posting.descriptionHtml)
  assert.equal(api.descriptionHtml,own.originalLD.description)
  assert.ok(own.headDescriptions.every(value=>value.endsWith('This position is based in '+plainCountry+'.')))
  hold(()=>reconcile(values),'geography')
})

test('an entity-encoded format control in an authored href stays unsupported',()=>{
  const values=rows(),url='https://front.com/In&#8203;dia',decoded='https://front.com/In\u200bdia'
  appendCriterion(values,'<p><a href="'+url+'">Policy</a></p>','Policy '+decoded)
  hold(()=>reconcile(values),'geography')
})

test('a consistently published native title with format controls stays unsupported',()=>{
  const values=rows(),id='91e4b4ad-9ce3-4bc7-896e-f36ff234eca1',old='Account Executive, SMB',title=old+' In\u200bdia'
  jsonBody(row(values,'native-api'),m=>{m.jobs.find(j=>j.id===id).title=title})
  jsonBody(row(values,'corporate-feed'),m=>{m[0].jobs.find(j=>j.key===id).title=title})
  setText(row(values,'corporate'),text(row(values,'corporate')).replaceAll(old,title))
  jsonScript(row(values,'native-board'),'boot',m=>{m.jobBoard.jobPostings.find(j=>j.id===id).title=title})
  const own=row(values,'own-91e4b4ad');jsonScript(own,'boot',m=>{m.posting.title=title});jsonScript(own,'ld',m=>{m.title=title})
  setText(own,text(own).replace('<title>'+old+' @ Front</title>','<title>'+title+' @ Front</title>'))
  for(const name of ['title','og:title','twitter:title'])metadata(own,name,name==='title'?title+' @ Front':title)
  hold(()=>reconcile(values),'geography')
})

test('matching original address representations cannot conceal a format control',()=>{
  const values=rows(),locality='Santi\u200bago'
  jsonBody(row(values,'native-api'),m=>{m.jobs[0].address.postalAddress.addressLocality=locality})
  jsonScript(row(values,'own-91e4b4ad'),'ld',m=>{m.jobLocation.address.addressLocality=locality})
  hold(()=>reconcile(values),'geography')
})

test('reviewed layout whitespace and once-decoded literal entity text remain original',()=>{
  const values=rows(),html='<p>Policy:\u00a0 &amp;ZeroWidthSpace; remains literal text.</p>',plain='Policy:\u00a0 &ZeroWidthSpace; remains literal text.'
  appendCriterion(values,html,plain)
  const result=reconcile(values),record=result.nativeRecords[0]
  assert.ok(record.originalNativePosting.descriptionHtml.endsWith(html))
  assert.ok(record.originalPublicRecord.descriptionPlain.endsWith(plain))
  assert.equal(result.qualificationFacts.currentTransactionQualified,false)
})

for(const criterion of ['Applicants may work from any country.','Applicants may work globally.','Remote work is available from any location.'])
test('explicit global work scope stays unresolved: '+criterion,()=>{
  const values=rows();appendCriterion(values,'<p>'+criterion+'</p>',criterion)
  const api=JSON.parse(text(row(values,'native-api'))).jobs[0],own=native(row(values,'own-91e4b4ad'))
  assert.equal(api.descriptionHtml,own.originalAppData.posting.descriptionHtml)
  assert.equal(api.descriptionHtml,own.originalLD.description)
  assert.ok(own.headDescriptions.every(value=>value.endsWith(criterion)))
  hold(()=>reconcile(values),'geography')
})

for(const [name,addition]of [
  ['known careers reference','<a href="https://new-provider.example/careers/">India engineering openings</a>'],
  ['visible hiring label','<a href="https://new-provider.example/team">India engineering openings</a>'],
  ['hidden hiring label','<a hidden href="https://new-provider.example/team">India engineering openings</a>'],
  ['descendant hiring label','<a href="https://new-provider.example/team">India engineering open<span>ings</span></a>'],
  ['entity-encoded format control in hiring label','<a href="https://new-provider.example/team">India engineering ope&ZeroWidthSpace;nings</a>'],
])test('an additional corporate '+name+' cannot be ignored',()=>{
  const values=rows(),packet=row(values,'corporate'),original=text(packet)
  assert.equal(original.split('</body>').length,2)
  setText(packet,original.replace('</body>',addition+'</body>'))
  assert.notEqual(packet.bodySHA256,sha(Buffer.from(original)))
  hold(()=>reconcile(values),'corporate-programme')
})
