import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {RECRUITMENT_OBSERVATIONS} from '../../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readFactSetPublisherDeclaration} from './currentPublisher.js'

const prior=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-declared-board-20261110.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-publisher-20261114.json.gz',import.meta.url))))
const ROOT='https://www.factset.com/careers',EMPLOYER='30097 FactSet Systems India Private Limited'
const OLD='https://www.factset.com/assets/index-CJaIwYkV.js',CURRENT='https://www.factset.com/assets/index--Pj3DBjZ.js'
const HASH='19c18961e30aa70fb08e69f85177f6b9b8d05ee78e14034217dd963fdc27cb4f'
const source=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='factsetresearchsystems'))
const select=(packets,label)=>{const packet=packets.find(row=>row.label===label);assert.ok(packet,label);return packet}
const edit=(packet,change)=>{const value=JSON.parse(packet.body);change(value);packet.body=JSON.stringify(value)}

function transport(profile='current',change=()=>{}){
 const packets=structuredClone(prior.captures)
 // This hermetic registered replay deliberately combines genuine current
 // publisher entities with genuine prior native role pairs. It makes no
 // claim that November10 roles constitute today's live inventory.
 if(profile==='current')for(const packet of packets){
  const index=packet.label.startsWith('corporate-current-')?0:packet.label.startsWith('client-current-')?1
   :packet.label.startsWith('careers-data-current-')?2:packet.label.startsWith('legal-data-current-')?3
    :packet.label.startsWith('board-html-current-')?4:-1
  if(index>=0)Object.assign(packet,structuredClone(current.captures[index]))
 }
 change(packets)
 const counts=new Map(),calls=[]
 return{calls,fetchImpl:async(url,init={})=>{
  const key=JSON.stringify([init.method||'GET',url,init.body||null]),count=counts.get(key)||0
  counts.set(key,count+1);calls.push({url,method:init.method||'GET',signal:init.signal})
  const packet=packets.filter(row=>JSON.stringify([row.requestMethod,row.requestUrl,row.requestBody])===key)[count]
  assert.ok(packet,'Unexpected public read '+key+' #'+count)
  const response=new Response(packet.rawBody??packet.body,{status:packet.status,headers:{'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
 }}
}
async function run(profile='current',change,options={}){
 const wire=transport(profile,change),jobs=await source().run({now:()=>current.capturedAt,fetchImpl:wire.fetchImpl,...options})
 return{jobs,calls:wire.calls,observed:jobs[RECRUITMENT_OBSERVATIONS]}
}
async function held(profile,change,reason){
 const wire=transport(profile,change)
 let jobs,error
 try{jobs=await source().run({now:()=>current.capturedAt,fetchImpl:wire.fetchImpl})}catch(failure){error=failure}
 const observed=jobs?.[RECRUITMENT_OBSERVATIONS]??error?.recruitmentObservations
 assert.equal(jobs?.length??0,0,'unqualified publisher or native context cannot emit roles')
 assert.ok(observed,'a rejected or empty held collection retains diagnostics')
 const messages=[error?.message,...(observed.failures||[]).map(row=>row.message)].join(' | ')
 assert.match(messages,reason)
 return wire.calls
}

test('genuine current five-entity publisher declaration retains exact legal and native tenant authority',async()=>{
 const calls=[],page=current.captures[0]
 const read=async url=>{calls.push(url);const row=current.captures.find(packet=>packet.requestUrl===url);assert.ok(row,url);return{url:row.finalUrl,status:row.status,html:row.body}}
 const declaration=await readFactSetPublisherDeclaration({page:{url:ROOT,status:200,html:page.body},readRenderer:read,
  readJson:async url=>JSON.parse((await read(url)).html),readDeclaredBoardPage:read})
 assert.equal(declaration.context.rendererURL,CURRENT)
 assert.equal(declaration.context.rendererSHA256,HASH)
 assert.equal(declaration.context.cmsPrefix,'/api/page/')
 assert.equal(declaration.context.nativeConfig.tenant,'factset')
 assert.equal(declaration.context.nativeConfig.siteId,'FactSetCareers')
 assert.deepEqual(calls,current.captures.slice(1,5).map(row=>row.requestUrl))
})

for(const profile of ['prior','current'])test('registered '+profile+' finite publisher retains full native role, date, subsidiary and cleanup boundaries',async()=>{
 const {jobs,calls,observed}=await run(profile)
 assert.equal(jobs.length,17)
 assert.equal(calls.length,48)
 assert.ok(jobs.every(job=>job.company===EMPLOYER&&job.nativeLegalEmployer===EMPLOYER&&job.country==='India'))
 assert.ok(jobs.every(job=>job.nativeSourceRecord.hiringOrganization.name===EMPLOYER&&job.nativeClosingSourceRecord.hiringOrganization.name===EMPLOYER))
 assert.ok(jobs.every(job=>job.sourceDescription===job.nativeSourceRecord.jobPostingInfo.jobDescription&&job.sourceDescription.length>6000))
 assert.ok(jobs.every(job=>job.nativeSourceRecord.jobPostingInfo.country.descriptor==='India'&&job.nativeSourceRecord.jobPostingInfo.jobRequisitionLocation.country.alpha2Code==='IN'))
 assert.equal(jobs.find(job=>job.jobId==='R33211').postingDate,'2026-11-09')
 assert.ok(jobs.every(job=>job.sourceNativeClosingContext.eachFullRoleRechecked&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(observed.lifecycleCleanupAllowed,false)
 assert.equal(observed.publisherDeclarations.length,2)
 assert.ok(observed.publisherDeclarations.every(row=>row.evidence.rendererURL===(profile==='current'?CURRENT:OLD)))
})

test('Response text would erase a BOM, while registered streaming authority must retain it',async()=>{
 const bytes=Buffer.concat([Buffer.from([239,187,191]),Buffer.from(current.captures[1].body)])
 assert.equal(await new Response(bytes).text(),current.captures[1].body)
})

for(const profile of ['prior','current'])for(const phase of ['opening','closing']){
 test('actual Response BOM cannot inherit '+profile+' renderer hash at '+phase,async()=>{
  const calls=await held(profile,packets=>{const packet=select(packets,'client-current-'+phase);packet.rawBody=Buffer.concat([Buffer.from([239,187,191]),Buffer.from(packet.body)])},/reviewed active renderer changed/)
  if(phase==='opening')assert.ok(calls.every(call=>!call.url.includes('/api/page/')))
 })
 test('actual Response invalid UTF8 cannot inherit '+profile+' renderer hash at '+phase,async()=>{
  const calls=await held(profile,packets=>{const packet=select(packets,'client-current-'+phase);packet.rawBody=Buffer.concat([Buffer.from([255]),Buffer.from(packet.body)])},/invalid UTF-8 active renderer/)
  if(phase==='opening')assert.ok(calls.every(call=>!call.url.includes('/api/page/')))
 })
}

for(const profile of ['prior','current'])test('known '+profile+' program bytes do not grant an undeclared renderer deployment URL',async()=>{
 const calls=await held(profile,packets=>{
  const expected=profile==='current'?CURRENT:OLD,unknown='https://www.factset.com/assets/index-unreviewed.js'
  for(const packet of packets){
   if(packet.label.startsWith('corporate-current-'))packet.body=packet.body.replace(new URL(expected).pathname,new URL(unknown).pathname)
   if(packet.label.startsWith('client-current-')){packet.requestUrl=unknown;packet.finalUrl=unknown}
  }
 },/reviewed active renderer changed/)
 assert.ok(calls.every(call=>!call.url.includes('/api/page/')))
})

test('known prior program cannot inherit a different known renderer final URL',async()=>{
 const calls=await held('prior',packets=>{
  const packet=select(packets,'client-current-opening');packet.finalUrl=CURRENT
 },/reviewed active renderer changed/)
 assert.ok(calls.every(call=>!call.url.includes('/api/page/')))
})

test('whole current program byte change rejects before any CMS request',async()=>{
 const calls=await held('current',packets=>{select(packets,'client-current-opening').body+='\n/* unreviewed program */'},/reviewed active renderer changed/)
 assert.ok(calls.every(call=>!call.url.includes('/api/page/')))
})
test('current native handoff still requires both exact CTA carriers',async()=>{
 await held('current',packets=>edit(select(packets,'careers-data-current-opening'),value=>{value.content.sections[10].cta.link.href+='?unreviewed'}),/current careers CTA changed/)
})
for(const profile of ['prior','current'])for(const [index,field,value]of [[0,'to','/different-application'],[10,'to','/different-application'],[0,'scrollToComponent','LeadGenCard']]){
 test(profile+' CTA alternate action '+index+'.'+field+' cannot hide the matching native href',async()=>{
  const labels=['corporate-current-opening','client-current-opening','careers-data-current-opening','legal-data-current-opening','board-html-current-opening']
  const packets=structuredClone(profile==='current'?current.captures.slice(0,5):labels.map(label=>select(prior.captures,label))),calls=[]
  edit(packets[2],cms=>{cms.content.sections[index].cta[field]=value})
  const read=async url=>{calls.push(url);const row=packets.find(packet=>packet.requestUrl===url);assert.ok(row,url);return{url:row.finalUrl,status:row.status,html:row.body}}
  await assert.rejects(readFactSetPublisherDeclaration({page:{url:ROOT,status:200,html:packets[0].body},readRenderer:read,
   readJson:async url=>JSON.parse((await read(url)).html),readDeclaredBoardPage:read}),/current careers CTA changed/)
  assert.ok(calls.every(url=>!url.includes('.myworkdayjobs.com')))
 })
}
test('current native handoff still requires original own legal declaration',async()=>{
 await held('current',packets=>{const packet=select(packets,'legal-data-current-opening');packet.body=packet.body.replaceAll('FactSet Research Systems','Different Parent Systems')},/current legal publisher identity changed/)
})
test('current publisher cannot use a foreign primary country with an India location',async()=>{
 await held('current',packets=>edit(select(packets,'detail-R32233-current-opening'),value=>{value.jobPostingInfo.country.descriptor='United Kingdom'}),/Contradictory Workday native countries/)
})
test('current publisher cannot replace missing native country with India search membership',async()=>{
 await held('current',packets=>edit(select(packets,'detail-R32233-current-opening'),value=>{delete value.jobPostingInfo.country}),/Native work countries are missing or conflicting/)
})
test('current publisher excludes a different legal employer instead of relabeling it',async()=>{
 const {jobs,observed}=await run('current',packets=>edit(select(packets,'detail-R32233-current-opening'),value=>{value.hiringOrganization.name='99999 Different Employer'}))
 assert.equal(jobs.length,16);assert.ok(!jobs.some(job=>job.jobId==='R32233'))
 assert.ok(observed.exclusions.some(row=>row.reason==='native-employer-mismatch'))
})
test('current publisher excludes preview-only native criteria',async()=>{
 const {jobs,observed}=await run('current',packets=>edit(select(packets,'detail-R32233-current-opening'),value=>{value.jobPostingInfo.jobDescription='<p>Preview only.</p>'}))
 assert.equal(jobs.length,16);assert.ok(!jobs.some(job=>job.jobId==='R32233'))
 assert.ok(observed.exclusions.some(row=>row.reason==='native-full-description-unavailable'))
})
test('current publisher discards jobs if closing native full criteria changes',async()=>{
 await held('current',packets=>edit(select(packets,'detail-R32233-current-closing'),value=>{value.jobPostingInfo.jobDescription+='<p>New native criteria.</p>'}),/Workday closing native role context changed/)
})
test('current publisher discards jobs if closing selected listing changes',async()=>{
 await held('current',packets=>edit(select(packets,'inventory-india-current-closing'),value=>{value.jobPostings[0].title+=' changed'}),/Workday closing selected listing context changed/)
})
test('current publisher preserves opaque caller abort before CMS and schedules no later work',async()=>{
 const caller=new AbortController(),reason=Object.freeze({stop:'FactSet caller'}),wire=transport()
 await assert.rejects(source().run({now:()=>current.capturedAt,signal:caller.signal,fetchImpl:async(url,init)=>{
  const response=await wire.fetchImpl(url,init)
  if(url===CURRENT)caller.abort(reason)
  return response
 }}),error=>error===reason)
 assert.deepEqual(wire.calls.map(call=>call.url),[ROOT,CURRENT])
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(wire.calls.length,2)
})

function declarationProbe(profile,change){
 const labels=['corporate-current-opening','client-current-opening','careers-data-current-opening','legal-data-current-opening','board-html-current-opening']
 const packets=structuredClone(profile==='current'?current.captures.slice(0,5):labels.map(label=>select(prior.captures,label))),calls=[]
 change?.(packets)
 const read=async url=>{calls.push(url);const row=packets.find(packet=>packet.requestUrl===url);assert.ok(row,url);return{url:row.finalUrl,status:row.status,html:row.body}}
 return{calls,run:()=>readFactSetPublisherDeclaration({page:{url:ROOT,status:200,html:packets[0].body},readRenderer:read,
  readJson:async url=>JSON.parse((await read(url)).html),readDeclaredBoardPage:read})}
}
const envelopeFailure=/CMS component prop envelope changed/
const envelopeProbe=async(change,profile='current')=>{
 const probe=declarationProbe(profile,change)
 await assert.rejects(probe.run(),envelopeFailure)
 assert.ok(probe.calls.every(url=>!url.includes('.myworkdayjobs.com')),'unqualified CMS cannot request the native board')
}
for(const [field,value]of [['style',{display:'none'}],['class','hidden'],['hidden',true],['inert',true],
 ['nt_experiences',{unreviewed:true}],['nt_experiences',[{unreviewed:true}]],['innerHTML','<p>Unavailable</p>'],['onClick','unreviewed'],['id','unreviewed']]){
 test('CMS envelope rejects page-level '+field+' '+(Array.isArray(value)?'array':typeof value),async()=>{
  await envelopeProbe(packets=>edit(packets[2],cms=>{cms.content[field]=value}))
 })
}
for(let index=0;index<13;index++)test('CMS envelope rejects inherited styles on actual careers section '+index,async()=>{
 await envelopeProbe(packets=>edit(packets[2],cms=>{cms.content.sections[index].style={display:'none'}}))
})
for(const [name,change]of [
 ['legal page personalization',cms=>{cms.content.nt_experiences={unreviewed:true}}],
 ['legal hero hidden',cms=>{cms.content.sections[0].hidden=true}],
 ['legal FAQ style',cms=>{cms.content.sections.find(row=>row.__typename==='Faq').style={display:'none'}}],
])test('CMS envelope rejects '+name,async()=>{
 await envelopeProbe(packets=>edit(packets[3],change))
})
for(const [name,change]of [
 ['story child style',cms=>{cms.content.sections[4].sections[0].style={position:'fixed',inset:0}}],
 ['person child inert',cms=>{cms.content.sections[6].personList[0].inert=true}],
 ['award child markup',cms=>{cms.content.sections[8].awards[0].innerHTML='<p>Unreviewed</p>'}],
 ['image hidden',cms=>{cms.content.sections[0].sideVisualAsset.hidden=true}],
 ['missing nested model type',cms=>{delete cms.content.sections[4].sections[0].__typename}],
 ['missing section model type',cms=>{delete cms.content.sections[1].__typename}],
 ['invalid observed field type',cms=>{cms.content.sections[10].name={style:{display:'none'}}}],
])test('CMS envelope rejects '+name,async()=>{
 await envelopeProbe(packets=>edit(packets[2],change))
})
for(const [name,change]of [
 ['personalization',cms=>{cms.content.nt_experiences={unreviewed:true}}],
 ['page styling',cms=>{cms.content.style={display:'none'}}],
])test('CMS envelope retains prior deployment boundary for '+name,async()=>{
 await envelopeProbe(packets=>edit(packets[2],change),'prior')
})
for(const [name,profile,label,change]of [
 ['page personalization','current','careers-data-current-opening',cms=>{cms.content.nt_experiences={unreviewed:true}}],
 ['both CTA styles','current','careers-data-current-opening',cms=>{for(const index of [0,10])cms.content.sections[index].style={display:'none'}}],
 ['closing legal style','current','legal-data-current-closing',cms=>{cms.content.sections.find(row=>row.__typename==='Faq').style={display:'none'}}],
 ['closing prior inert','prior','careers-data-current-closing',cms=>{cms.content.inert=true}],
])test('CMS envelope registered '+name+' retains held publication and cleanup',async()=>{
 const calls=await held(profile,packets=>edit(select(packets,label),change),envelopeFailure)
 if(label.endsWith('opening'))assert.ok(calls.every(call=>!call.url.includes('/wday/cxs/')))
})
test('CMS envelope permits changed informational copy within reviewed native component props',async()=>{
 const probe=declarationProbe('current',packets=>edit(packets[2],cms=>{
  cms.content.sections[10].headline+=' — Updated benefits information'
  cms.content.sections[4].sections[0].headline+=' — Updated story'
 }))
 assert.equal((await probe.run()).context.rendererURL,CURRENT)
})

const richTextFailure=/CMS RichText envelope changed/
function mutateLegalOwner(cms,change){
 let changed=0
 for(const pair of cms.content.sections.find(row=>row.__typename==='Faq').pairs.filter(row=>['Privacy Notice','Terms of Use'].includes(row.question)))
  for(const node of pair.answer.content)if(JSON.stringify(node).includes('FactSet Research Systems')){change(node);changed++}
 assert.ok(changed,'genuine legal ownership carriers must be mutated')
}
function wrapLegalLink(cms){
 let changed=0
 const visit=node=>{
  if(!Array.isArray(node.content))return
  node.content=node.content.map(child=>{
   if(child.nodeType==='hyperlink'&&child.data?.uri==='https://www.factset.com/legal'){changed++;return{nodeType:'unreviewed-native-block',content:[child]}}
   visit(child);return child
  })
 }
 visit(cms.content.sections[12].columnOne);assert.equal(changed,1)
}
for(const profile of ['prior','current'])for(const[name,index,change]of[
 ['unrendered owner paragraph',3,cms=>mutateLegalOwner(cms,node=>{node.nodeType='unreviewed-native-block'})],
 ['unrendered legal navigation',2,wrapLegalLink],
 ['unsupported owner text mark',3,cms=>mutateLegalOwner(cms,node=>{
  const visit=value=>{if(value.nodeType==='text')value.marks.push({type:'unreviewed-native-mark'});else for(const child of value.content||[])visit(child)}
  visit(node)
 })],
])test('RichText envelope '+profile+' rejects '+name+' before native authority',async()=>{
 const probe=declarationProbe(profile,packets=>edit(packets[index],change))
 await assert.rejects(probe.run(),richTextFailure)
 assert.ok(probe.calls.every(url=>!url.includes('.myworkdayjobs.com')))
})
for(const[name,index,change]of[
 ['nonarray text marks',3,cms=>mutateLegalOwner(cms,node=>{
  const visit=value=>{if(value.nodeType==='text')value.marks=null;else for(const child of value.content||[])visit(child)}
  visit(node)
 })],
 ['unreviewed hyperlink data',2,cms=>{
  const visit=node=>{if(node.nodeType==='hyperlink')node.data.style={display:'none'};for(const child of node.content||[])visit(child)}
  visit(cms.content.sections[12].columnOne)
 }],
 ['unsupported informational body node',2,cms=>{cms.content.sections[0].body.content[0].nodeType='unreviewed-native-block'}],
])test('RichText envelope rejects '+name+' in actual CMS inputs',async()=>{
 const probe=declarationProbe('current',packets=>edit(packets[index],change))
 await assert.rejects(probe.run(),richTextFailure)
 assert.ok(probe.calls.every(url=>!url.includes('.myworkdayjobs.com')))
})
for(const[name,label,change]of[
 ['opening dormant legal owner','legal-data-current-opening',cms=>mutateLegalOwner(cms,node=>{node.nodeType='unreviewed-native-block'})],
 ['closing dormant legal link','careers-data-current-closing',wrapLegalLink],
])test('RichText envelope registered '+name+' retains publication and cleanup hold',async()=>{
 const calls=await held('current',packets=>edit(select(packets,label),change),richTextFailure)
 if(label.endsWith('opening'))assert.ok(calls.every(call=>!call.url.includes('/wday/cxs/')))
})
test('RichText envelope permits natural informational text within actual rendered nodes',async()=>{
 const probe=declarationProbe('current',packets=>edit(packets[2],cms=>{
  const visit=node=>{if(node.nodeType==='text')node.value+=' Updated benefits copy';else for(const child of node.content||[])visit(child)}
  visit(cms.content.sections[0].body)
 }))
 assert.equal((await probe.run()).context.rendererURL,CURRENT)
})

const shellFailure=/reviewed corporate shell changed|invalid UTF-8 corporate shell/
const shellMutations=[
 ['missing app mount',html=>html.replace('<div id="app"></div>','<div id="unmounted"></div>')],
 ['hidden app mount',html=>html.replace('<div id="app"></div>','<div id="app" hidden></div>')],
 ['inert app mount',html=>html.replace('<div id="app"></div>','<div id="app" inert></div>')],
 ['hidden body',html=>html.replace('<body>','<body hidden>')],
 ['inline app CSS',html=>html.replace('<div id="app"></div>','<div id="app" style="display:none"></div>')],
 ['document app CSS',html=>html.replace('</head>','<style>#app {display:none!important}</style></head>')],
 ['document body CSS',html=>html.replace('</head>','<style>body {visibility:hidden!important}</style></head>')],
]
for(const[name,change]of shellMutations)test('publisher shell rejects '+name+' in original current HTML',async()=>{
 const probe=declarationProbe('current',packets=>{const before=packets[0].body;packets[0].body=change(before);assert.notEqual(packets[0].body,before)})
 await assert.rejects(probe.run(),shellFailure);assert.equal(probe.calls.length,0)
})
for(const[name,change]of shellMutations.filter((_,index)=>[0,5].includes(index)))test('publisher shell retains exact prior '+name+' boundary',async()=>{
 const probe=declarationProbe('prior',packets=>{const before=packets[0].body;packets[0].body=change(before);assert.notEqual(packets[0].body,before)})
 await assert.rejects(probe.run(),shellFailure);assert.equal(probe.calls.length,0)
})
const fixtureNonce=current.captures[0].body.match(/<script nonce="([^"]+)"/)[1]
const freshNonce=Buffer.alloc(16,7).toString('base64')
assert.equal(current.captures[0].body.split(fixtureNonce).length-1,13)
for(let index=0;index<13;index++)test('publisher shell binds every explicit nonce slot '+index+' to the same value',async()=>{
 const probe=declarationProbe('current',packets=>{
  const pieces=packets[0].body.split(fixtureNonce)
  packets[0].body=pieces.reduce((html,piece,offset)=>html+(offset?offset-1===index?freshNonce:fixtureNonce:'')+piece,'')
 })
 await assert.rejects(probe.run(),shellFailure);assert.equal(probe.calls.length,0)
})
for(const[name,nonce]of[['invalid alphabet','!'.repeat(24)],['noncanonical padding bits','A'.repeat(21)+'B==']])test('publisher shell rejects nonce '+name,async()=>{
 const probe=declarationProbe('current',packets=>{packets[0].body=packets[0].body.replaceAll(fixtureNonce,nonce)})
 await assert.rejects(probe.run(),shellFailure);assert.equal(probe.calls.length,0)
})
for(const profile of ['prior','current'])for(const phase of ['opening','closing'])for(const[kind,prefix]of[
 ['BOM',Buffer.from([239,187,191])],['invalid UTF8',Buffer.from([255])],
])test('publisher shell actual Response '+kind+' cannot inherit '+profile+' '+phase+' entity qualification',async()=>{
 const calls=await held(profile,packets=>{const packet=select(packets,'corporate-current-'+phase);packet.rawBody=Buffer.concat([prefix,Buffer.from(packet.body)])},shellFailure)
 if(phase==='opening')assert.equal(calls.length,1)
})
for(const[name,label,change]of[
 ['opening inert mount','corporate-current-opening',shellMutations[2][1]],
 ['closing app CSS','corporate-current-closing',shellMutations[5][1]],
])test('publisher shell registered '+name+' retains publication and cleanup hold',async()=>{
 const calls=await held('current',packets=>{const packet=select(packets,label);packet.body=change(packet.body)},shellFailure)
 if(label.endsWith('opening'))assert.equal(calls.length,1)
})
for(const[name,from,to]of[
 ['anonymous-state control','"isAnonymous":true','"isAnonymous":false'],
 ['stylesheet declaration','/assets/index-BEfadAGS.css','/assets/index-unreviewed.css'],
])test('publisher shell rejects changed '+name+' outside typed nonce slots',async()=>{
 const probe=declarationProbe('current',packets=>{const before=packets[0].body;packets[0].body=before.replace(from,to);assert.notEqual(packets[0].body,before)})
 await assert.rejects(probe.run(),shellFailure);assert.equal(probe.calls.length,0)
})
test('publisher shell admits a different canonical nonce only in all13bound original slots',async()=>{
 const probe=declarationProbe('current',packets=>{packets[0].body=packets[0].body.replaceAll(fixtureNonce,freshNonce)})
 assert.equal((await probe.run()).context.rendererURL,CURRENT)
})
test('publisher shell registered opening and closing retain independently fresh legitimate nonce values',async()=>{
 const {jobs,observed}=await run('current',packets=>{
  for(const[index,phase]of['opening','closing'].entries()){
   const packet=select(packets,'corporate-current-'+phase),nonce=Buffer.alloc(16,index+8).toString('base64')
   packet.body=packet.body.replaceAll(fixtureNonce,nonce)
  }
 })
 assert.equal(jobs.length,17);assert.equal(observed.failures.length,0)
 assert.deepEqual(observed.publisherDeclarations[0].context,observed.publisherDeclarations[1].context)
 assert.notEqual(observed.publisherDeclarations[0].evidence.publisherBodySHA256,observed.publisherDeclarations[1].evidence.publisherBodySHA256)
})
