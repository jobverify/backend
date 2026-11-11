import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createSourceConfig,HOME,BOARD} from './parser.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {run as sourceRun} from './script.js'
import {run as auth0Run} from '../auth0/script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime20261110.json.gz',import.meta.url))))
const config=()=>createSourceConfig({now:()=>capture.captureCompletedAt})
const board=capture.captures.find(packet=>packet.url===BOARD)
const home=capture.captures.find(packet=>packet.url===HOME)
const observedRows=capture.currentBoard.observedRows

test('current genuine Okta site-root SEO canonical preserves its complete native board and six own explicitIndia full role contracts',()=>{
 const reader=config();reader.handoffs[0].verify(home.body)
 const page=reader.parseListing(board.body,BOARD)
 assert.equal(page.observedRows,observedRows);assert.equal(page.records.filter(row=>reader.candidateForIndia(row)).length,104)
 for(const selected of capture.selected){
  const row=page.records.find(row=>row.url===selected.url);assert.ok(row)
  const role=reader.parseDetail(selected.packet.body,row)
  assert.equal(role.title,selected.title);assert.equal(role.nativeHiringOrganization.name,'Okta, Inc.')
  assert.ok(role.nativeCountryAddresses.some(address=>address.country==='India'))
  assert.ok(role.nativeVisibleDescriptionHTML.length>100)
  assert.equal(role.nativeCanonicalURL,'https://www.okta.com')
  assert.equal(role.nativeCanonicalPolicy,'reviewed-site-root-SEO;resource-bound-by-native-own-page-model')
  assert.equal(role.sourceURL,selected.url)
 }
})

test('Okta current fixture retains all ten exact original native bodies and distinct closing board packet',()=>{
 assert.equal(capture.captures.length,10)
 for(const packet of capture.captures){
  const bytes=Buffer.from(packet.rawBodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
  assert.equal(bytes.length,packet.bodyBytes);assert.equal(bytes.toString('utf8'),packet.body)
 }
 const repeated=capture.captures.filter(packet=>packet.url===BOARD)
 assert.equal(repeated.length,2);assert.ok(repeated[0].requestedAt<repeated[1].requestedAt)
})

for(const value of ['https://other.example','https://www.okta.com/other/','https://www.okta.com?source=other'])test('Okta rejects an unreviewed global canonical '+value,()=>{
 assert.throws(()=>config().parseListing(board.body.replace('rel="canonical" href="https://www.okta.com"','rel="canonical" href="'+value+'"'),BOARD))
})

for(const field of ['Organization','WebSite'])test('Okta site-root canonical requires exact typed own '+field+' publisher',()=>{
 const changed=board.body.replace(new RegExp('("@type"\\s*:\\s*"'+field+'"[\\s\\S]*?)("(?:legalName|name)"\\s*:\\s*)"Okta, Inc\\."'), '$1$2"Other Company"')
 assert.notEqual(changed,board.body)
 assert.throws(()=>config().parseListing(changed,BOARD))
})

test('Okta root canonical cannot replace a changed own native article identity',()=>{
 const reader=config(),page=reader.parseListing(board.body,BOARD),selected=capture.selected[1],row=page.records.find(row=>row.url===selected.url)
 const changed=selected.packet.body.replace('about="'+new URL(selected.url).pathname+'"','about="/company/careers/other-role/"')
 assert.notEqual(changed,selected.packet.body);assert.throws(()=>reader.parseDetail(changed,row))
})

test('Okta exact careers home canonical remains required despite site-root SEO review',()=>{
 const d=document(home.body),canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')[0]
 assert.ok(canonical)
 assert.throws(()=>config().handoffs[0].verify(home.body.replace('href="'+HOME+'" rel="canonical"','href="https://www.okta.com" rel="canonical"').replace('rel="canonical" href="'+HOME+'"','rel="canonical" href="https://www.okta.com"')))
})

const changeSchema=(html,type,change)=>{
 const doc=document(html),node=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').find(node=>JSON.parse(node.raw)['@type']===type)
 assert.ok(node,'Actual typed native model required');const model=JSON.parse(node.raw);change(model)
 return html.replace(node.raw,JSON.stringify(model))
}
for(const[label,change]of [
 ['missing canonical',html=>html.replace(/<link\b[^>]*rel="canonical"[^>]*>/,'')],
 ['duplicate canonical',html=>html.replace('</head>','<link rel="canonical" href="https://www.okta.com"></head>')],
 ['conflicting typed Organization URL',html=>changeSchema(html,'Organization',model=>{model.url='https://other.example/'})],
 ['conflicting typed Organization name',html=>changeSchema(html,'Organization',model=>{model.name='Other Company'})],
 ['conflicting typed WebSite URL',html=>changeSchema(html,'WebSite',model=>{model.url='https://other.example/'})],
 ['foreign board title',html=>html.replace('<title>Job Openings | Okta</title>','<title>Job Openings | Other Company</title>')],
 ['native pagination',html=>html.replace('</main>','<a rel="next" href="?page=1">Next</a></main>')],
 ['missing native form',html=>html.replace('data-drupal-selector="views-exposed-form-careers-main"','data-drupal-selector="other"')],
 ['comment-only expected title',html=>html.replace('<title>Job Openings | Okta</title>','<title>Other Company</title><!-- <title>Job Openings | Okta</title> -->')],
 ['script-only expected title',html=>html.replace('<title>Job Openings | Okta</title>','<title>Other Company</title><script type="application/json">"<title>Job Openings | Okta</title>"</script>')],
])test('Okta reviewed root canonical cannot qualify '+label,()=>{
 const html=change(board.body);assert.notEqual(html,board.body);assert.throws(()=>config().parseListing(html,BOARD))
})

for(const tag of ['template','blockquote','pre'])test('Okta root canonical ignores '+tag+' typed publisher decoys',()=>{
 const doc=document(board.body),publisher=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').find(node=>JSON.parse(node.raw)['@type']==='Organization')
 const original=doc.outer(publisher),changed=board.body.replace(original,'<'+tag+'>'+original+'</'+tag+'>')
 assert.notEqual(changed,board.body);assert.throws(()=>config().parseListing(changed,BOARD))
})

test('Okta a quoted canonical link cannot establish a current native resource declaration',()=>{
 const doc=document(board.body),node=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')[0]
 const before=doc.outer(node),html=board.body.replace(before,'<blockquote>'+before+'</blockquote>')
 assert.notEqual(html,board.body);assert.throws(()=>config().parseListing(html,BOARD))
})

for(const[label,change]of [
 ['foreign employer',html=>changeSchema(html,'JobPosting',model=>{model.hiringOrganization.name='Other Employer'})],
 ['foreign country',html=>changeSchema(html,'JobPosting',model=>{model.jobLocation[0].address='Bengaluru, United States'})],
 ['foreign title',html=>changeSchema(html,'JobPosting',model=>{model.title='Other Role'})],
 ['missing date',html=>changeSchema(html,'JobPosting',model=>{delete model.datePosted})],
 ['future date',html=>changeSchema(html,'JobPosting',model=>{model.datePosted='2099-01-01'})],
 ['changed native external ID',html=>html.replace(/data-job-id="[1-9]\d+"/,'data-job-id="0000001"')],
 ['missing full article',html=>{const d=document(html),node=d.nodes(node=>node.tag==='article'&&d.hasClass(node,'Job__content'))[0];return html.replace(d.outer(node),'')}],
 ['teaser only article',html=>{const d=document(html),node=d.nodes(node=>node.tag==='article'&&d.hasClass(node,'Job__content'))[0];return html.replace(d.inner(node),'<p>Secure Every Identity, from AI to Human</p><h2>The Okta Experience</h2>')}],
])test('Okta reviewed root canonical retains own full role '+label+' hold',()=>{
 const reader=config(),page=reader.parseListing(board.body,BOARD),selected=capture.selected[1],row=page.records.find(row=>row.url===selected.url)
 const html=change(selected.packet.body);assert.notEqual(html,selected.packet.body);assert.throws(()=>reader.parseDetail(html,row))
})

const replay=(change=packet=>packet)=>{
 const positions=new Map()
 return{now:()=>capture.captureCompletedAt,transport:async(url,request)=>{
  const records=capture.captures.filter(packet=>packet.url===url),position=positions.get(url)||0
  positions.set(url,position+1)
  // Only six genuine own full details are captured here. Uncaptured roles
  // deliberately fail transport, preserving every original listing row and
  // explicit per-role holds; no filtered/synthetic native board is produced.
  if(!records.length)throw Object.assign(Error('Uncaptured own detail controlled transport failure'),{code:'TEST_UNCAPTURED_DETAIL'})
  assert.ok(records[position],'Exact original response occurrence required')
  assert.equal(request.method,'GET');assert.equal(request.credentials,'omit');assert.equal(request.redirect,'manual')
  const packet=change(structuredClone(records[position]),{url,position})
  return{url,status:packet.status,headers:packet.headers,body:Buffer.from(packet.rawBodyBase64,'base64'),bodyComplete:true,requestedAt:packet.requestedAt,completedAt:packet.completedAt}
 }}
}

test('actual Okta source export retains six genuine own detail successes and98 explicit uncaptured-role failures',async()=>{
 const jobs=await sourceRun(replay())
 assert.equal(jobs.length,6);assert.ok(jobs.every(job=>job.source==='okta'&&job.company==='Okta'&&job.country==='India'))
 const evidence=jobs[0].nativeCollectionEvidence
 assert.equal(evidence.observedListingCount,observedRows);assert.equal(evidence.candidateDetails,104);assert.equal(evidence.failures.length,98)
 assert.equal(evidence.closingInventoryMatches,true);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.nativeFacts.nativeCanonicalURL==='https://www.okta.com'))
})

test('actual registered Okta adapter preserves current root SEO proof and source ownership',async()=>{
 const provider=getScraperCatalog().find(provider=>provider.source==='okta');assert.ok(provider)
 const jobs=await createCatalogScraper(provider).run(replay())
 assert.equal(jobs.length,6);assert.ok(jobs.every(job=>job.source==='okta'&&job.country==='India'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('actual Auth0 current308 delegation executes Okta current parser without inventing separate Auth0 jobs',async()=>{
 const jobs=await auth0Run({...replay(),fetchPage:async url=>{
  const packet=capture.captures.find(packet=>packet.url===url);assert.ok(packet)
  return{status:packet.status,url:packet.finalURL,headers:packet.headers,body:packet.body,capturedAt:packet.completedAt}
 }})
 assert.equal(jobs.length,6);assert.ok(jobs.every(job=>job.source==='okta'&&job.company==='Okta'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const proof=jobs[Symbol.for('jobverify.inventory-delegation-evidence')]
 assert.equal(proof.source,'auth0');assert.deepEqual(proof.sources,['okta']);assert.equal(proof.preservesChildSourceAndCompany,true)
})

test('actual registered Auth0 adapter preserves canonical Okta job ownership and unknown separate employer scope',async()=>{
 const provider=getScraperCatalog().find(provider=>provider.source==='auth0');assert.ok(provider)
 const jobs=await createCatalogScraper(provider).run({...replay(),fetchPage:async url=>{
  const packet=capture.captures.find(packet=>packet.url===url);assert.ok(packet)
  return{status:packet.status,url:packet.finalURL,headers:packet.headers,body:packet.body,capturedAt:packet.completedAt}
 }})
 assert.equal(jobs.length,6);assert.ok(jobs.every(job=>job.source==='okta'&&job.company==='Okta'&&job.sourceScopeComplete===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const proof=jobs[Symbol.for('jobverify.inventory-delegation-evidence')]
 assert.equal(proof.source,'auth0');assert.deepEqual(proof.sources,['okta']);assert.equal(proof.preservesChildSourceAndCompany,true)
})

test('current short numeric URL disambiguators keep distinct own resource identities until genuine native IDs are read',()=>{
 const reader=config(),page=reader.parseListing(board.body,BOARD)
 assert.equal(new Set(page.records.map(row=>row.id)).size,page.records.length)
 const selected=capture.selected.filter(role=>/-[01]\/$/.test(role.url));assert.equal(selected.length,3)
 const actual=[]
 for(const role of selected){
  const row=page.records.find(row=>row.url===role.url)
  assert.equal(row.nativeURLJobID,null);assert.equal(row.id,row.url);assert.ok(!['0','1'].includes(row.id))
  const detail=reader.parseDetail(role.packet.body,row)
  assert.match(detail.nativeExternalJobID,/^[1-9]\d{4,11}$/);assert.notEqual(detail.id,row.id)
  actual.push(detail.id)
 }
 assert.equal(new Set(actual).size,3)
})

test('Okta native closing membership change retains explicit hold and original observed rows',async()=>{
 const jobs=await sourceRun(replay((packet,{url,position})=>{
  if(url===BOARD&&position===1){packet.body=packet.body.replace('Senior Data Engineer','Withdrawn Senior Data Engineer');packet.rawBodyBase64=Buffer.from(packet.body).toString('base64')}
  return packet
 }))
 assert.equal(jobs.length,6);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)
 assert.ok(jobs[0].nativeCollectionEvidence.failures.some(failure=>failure.stage==='closing-inventory'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Okta denies native access without continuing detail requests or claiming empty inventory',async()=>{
 await assert.rejects(sourceRun(replay((packet,{url})=>{if(url===BOARD)packet.status=403;return packet})),error=>{
  assert.equal(error.code,'NATIVE_HTML_INCOMPLETE');assert.equal(error.nativeEvidence.retainedResponses.length,2)
  assert.equal(error.nativeEvidence.verifiedZeroInventory,false);return true
 })
})

test('Okta partial output cap and already-cancelled acquisition cannot produce native coverage',async()=>{
 assert.throws(()=>sourceRun({maxJobs:1,transport:()=>assert.fail('partial cap must not acquire')}),/Partial maxJobs/)
 await assert.rejects(sourceRun({signal:AbortSignal.abort(Error('stop current native read')),transport:()=>assert.fail('cancelled acquisition')}))
})

const ownDetail=change=>{
 const reader=config(),page=reader.parseListing(board.body,BOARD),selected=capture.selected[1],row=page.records.find(row=>row.url===selected.url)
 return()=>reader.parseDetail(change(selected.packet.body),row)
}
const editArticle=(html,change)=>{
 const doc=document(html),article=doc.nodes(node=>node.tag==='article'&&doc.hasClass(node,'Job__content'))[0]
 assert.ok(article);return html.replace(doc.inner(article),change(doc.inner(article)))
}
for(const text of ['You will be employed by Other Corporation.','Your employer is Other Corporation.','Other Corporation is your employer.','Employer: Other Corporation','Hiring Organization: Other Corporation','Okta is not your employer.','You will not be employed by Okta.','Our overview<aside>Employer: Other Corporation</aside>'])test('Okta holds active own article employer contradiction '+text,()=>{
 assert.throws(ownDetail(html=>editArticle(html,body=>body+'<p>'+text+'</p>')))
})
test('Okta own native schema teaser cannot contradict the exact own employer',()=>{
 assert.throws(ownDetail(html=>changeSchema(html,'JobPosting',model=>{model.description+='<p>You will be employed by Other Corporation.</p>'})))
})
for(const tag of ['blockquote','q','pre','code','template'])test('Okta ignores '+tag+' employer sample while retaining genuine own criteria',()=>{
 const parse=ownDetail(html=>editArticle(html,body=>body+'<'+tag+'><p>You will be employed by Other Corporation.</p></'+tag+'>'))
 assert.equal(parse().nativeHiringOrganization.name,'Okta, Inc.')
})
for(const kind of ['article','schema','title','location','ID'])for(const tag of ['blockquote','pre','code','template','aside'])test('Okta does not qualify quoted '+kind+' proof within '+tag,()=>{
 assert.throws(ownDetail(html=>{
  const d=document(html),node=kind==='article'?d.nodes(n=>n.tag==='article'&&d.hasClass(n,'Job__content'))[0]
   :kind==='schema'?d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&JSON.parse(n.raw)['@type']==='JobPosting')[0]
   :kind==='title'?d.nodes(n=>n.tag==='h1')[0]
   :kind==='location'?d.nodes(n=>n.tag==='div'&&d.hasClass(n,'mb-4')&&d.hasClass(n,'h5'))[0]
   :d.nodes(n=>typeof n.attrs['data-job-id']==='string')[0]
  assert.ok(node);const raw=d.outer(node);return html.replace(raw,'<'+tag+'>'+raw+'</'+tag+'>')
 }))
})
for(const kind of ['article','schema','title','location','ID'])for(const attribute of ['hidden','inert','aria-hidden="true"','style="display:none"'])test('Okta does not qualify '+attribute+' own '+kind+' proof',()=>{
 assert.throws(ownDetail(html=>{
  const d=document(html),node=kind==='article'?d.nodes(n=>n.tag==='article'&&d.hasClass(n,'Job__content'))[0]
   :kind==='schema'?d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&JSON.parse(n.raw)['@type']==='JobPosting')[0]
   :kind==='title'?d.nodes(n=>n.tag==='h1')[0]
   :kind==='location'?d.nodes(n=>n.tag==='div'&&d.hasClass(n,'mb-4')&&d.hasClass(n,'h5'))[0]
   :d.nodes(n=>typeof n.attrs['data-job-id']==='string')[0]
  assert.ok(node);const raw=d.outer(node);return html.replace(raw,'<div '+attribute+'>'+raw+'</div>')
 }))
})
for(const kind of ['row','link','location'])for(const tag of ['blockquote','pre','code'])test('Okta excludes quoted native listing '+kind+' proof in '+tag,()=>{
 const d=document(board.body),row=d.nodes(n=>d.hasClass(n,'views-row')).find(row=>d.nodes(n=>n.tag==='a'&&new URL(n.attrs.href||'/',HOME).href===capture.selected[1].url,row).length)
 assert.ok(row)
 const node=kind==='row'?row:kind==='link'?d.nodes(n=>n.tag==='a'&&n.attrs.href,row)[0]:d.nodes(n=>d.hasClass(n,'views-field-field-job-location'),row)[0]
 const raw=d.outer(node),changed=board.body.slice(0,node.start)+'<'+tag+'>'+raw+'</'+tag+'>'+board.body.slice(node.end),page=config().parseListing(changed,BOARD)
 assert.ok(!page.records.some(record=>record.url===capture.selected[1].url))
})
test('Okta current careers home publisher title cannot be supplied by an inactive script decoy',()=>{
 const before=/<title>[^<]*<\/title>/.exec(home.body)?.[0];assert.ok(before)
 const changed=home.body.replace(before,'<title>Other Company</title><script type="application/json">"<title>Careers | Okta</title>"</script>')
 assert.throws(()=>config().handoffs[0].verify(changed))
})
for(const value of ['Toronto, Canada, India','Toronto - Canada, India','Toronto (Canada), India'])test('Okta mixed own listing country cannot be interpreted as uncontradicted India '+value,()=>{
 const reader=config(),html=board.body.replaceAll('Bengaluru, India',value),page=reader.parseListing(html,BOARD)
 assert.ok(page.errors.length>0);assert.ok(!page.records.some(row=>row.nativeLocation===value&&row.countries.includes('India')))
})
for(const value of ['Location: Canada','Work Country: United States','This role is based in Toronto, Canada.'])test('Okta explicit own authored workplace cannot contradict original native address '+value,()=>{
 assert.throws(ownDetail(html=>editArticle(html,body=>body+'<p>'+value+'</p>')))
})
for(const html of [
 '<p>Employer:</p><p>Other Corporation</p>',
 '<p>Employer</p><p>:</p><p>Other Corporation</p>',
 '<p>Hiring Organization:</p><p>Other Corporation</p>',
 '<p>Work Location:</p><p>Toronto, Canada</p>',
 '<p>Work Location</p><p>:</p><p>Toronto, Canada</p>',
 '<p>Work Country:</p><p>Canada</p>',
])test('Okta own split label/value contradiction stays held '+html,()=>{
 assert.throws(ownDetail(source=>editArticle(source,body=>body+html)))
})
for(const value of ["You won't be employed by Okta.","You aren't employed by Okta.","Okta isn't your employer.","Okta won't be your employer."])test('Okta named own employer denial contraction stays held '+value,()=>{
 assert.throws(ownDetail(html=>editArticle(html,body=>body+'<p>'+value+'</p>')))
})
const pairMarkup=(left,right,label,value,colon)=>{
 const parts='<'+left+'>'+label+(colon?'':':')+'</'+left+'>'+(colon?'<'+right+'>:</'+right+'>':'')+'<'+right+'>'+value+'</'+right+'>'
 return ['td','th'].includes(left)?'<table><tr>'+parts+'</tr></table>':['dt','dd'].includes(left)?'<dl>'+parts+'</dl>':parts
}
for(const[left,right]of [['p','p'],['div','div'],['th','td'],['td','td'],['dt','dd'],['dd','dd']])for(const colon of [false,true])for(const[label,value]of [['Employer','Other Corporation'],['Work Location','Toronto, Canada']])test('Okta rejects own '+label+' split over '+left+'/'+right+' with separateColon='+colon,()=>{
 assert.throws(ownDetail(html=>editArticle(html,body=>body+pairMarkup(left,right,label,value,colon))))
})
for(const boundary of ['main','address','aside'])for(const[label,value]of [['Employer','Other Corporation'],['Work Location','Toronto, Canada']])test('Okta preceding plain overview cannot mask '+label+' in '+boundary,()=>{
 assert.throws(ownDetail(html=>editArticle(html,body=>body+'Our overview<'+boundary+'>'+label+': '+value+'</'+boundary+'>')))
})
for(const name of ['Okta','Okta, Inc.','OktaInc'])for(const sentence of [name+' is not your employer.',name+" won't be your employer.",'You are not employed by '+name+'.','You will not be employed by '+name+'.',"You won't be employed by "+name+'.',"You aren't employed by "+name+'.'])test('Okta exact own employer denial variants '+sentence,()=>{
 assert.throws(ownDetail(html=>editArticle(html,body=>body+'<p>'+sentence+'</p>')))
})
for(const tag of ['blockquote','q','pre','code','template'])for(const[label,value]of [['Employer','Other Corporation'],['Work Location','Toronto, Canada']])test('Okta ignored '+tag+' split '+label+' value cannot bind a subsequent active field',()=>{
 const parse=ownDetail(html=>editArticle(html,body=>body+'<p>'+label+':</p><'+tag+'><p>'+value+'</p></'+tag+'><p>Work Country: India</p>'))
 assert.equal(parse().nativeHiringOrganization.name,'Okta, Inc.')
})
for(const attribute of ['hidden','inert','aria-hidden="true"','style="display:none"'])for(const[label,value]of [['Employer','Other Corporation'],['Work Location','Toronto, Canada']])test('Okta ignored '+attribute+' '+label+' value cannot bind a subsequent active field',()=>{
 const parse=ownDetail(html=>editArticle(html,body=>body+'<p>'+label+':</p><div '+attribute+'><p>'+value+'</p></div><p>Work Country: India</p>'))
 assert.equal(parse().nativeHiringOrganization.name,'Okta, Inc.')
})
test('Okta a blank employer declaration stops at the next separate native label',()=>{
 const parse=ownDetail(html=>editArticle(html,body=>body+'<p>Employer:</p><p>Work Location</p><p>India</p>'))
 assert.equal(parse().nativeHiringOrganization.name,'Okta, Inc.')
})
for(const value of ['Not India','NotIndia','Non-India'])test('Okta explicit own work-country denial does not qualify by substring '+value,()=>{
 assert.throws(ownDetail(html=>editArticle(html,body=>body+'<p>Work Country: '+value+'</p>')))
})
test('Okta explicit own teaser workplace cannot contradict original native address',()=>{
 assert.throws(ownDetail(html=>changeSchema(html,'JobPosting',model=>{model.description+='<p>Location: Canada</p>'})))
})
test('Okta generic client market prose does not invent a foreign workplace',()=>{
 const parse=ownDetail(html=>editArticle(html,body=>body+'<p>Support customers and client markets in Canada.</p>'))
 assert.equal(parse().nativeCountryAddresses[0].country,'India')
})
for(const body of [
 '<p>Secure Every Identity, from AI to Human</p><h2>Responsibilities</h2><h2>Qualifications</h2>',
 '<p>Secure Every Identity, from AI to Human</p><p><strong>Responsibilities</strong></p><p><strong>Qualifications</strong></p>',
 '<p>Secure Every Identity, from AI to Human</p><h2>Responsibilities</h2><p hidden>Build highly available services and improve automated tests for distributed systems at scale.</p>',
 '<p>Secure Every Identity, from AI to Human</p><h2>Responsibilities</h2><blockquote><p>Build highly available services and improve automated tests for distributed systems at scale.</p></blockquote>',
])test('Okta requires actual active authored criteria beyond company intro and headings '+body.slice(58,110),()=>{
 assert.throws(ownDetail(html=>editArticle(html,()=>body)))
})
