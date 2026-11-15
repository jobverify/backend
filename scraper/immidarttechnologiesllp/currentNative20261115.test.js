import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createImmidartTechnologiesLlpScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const original=Object.fromEntries(fixture.packets.map(packet=>{
  const body=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'),packet.bodySHA256)
  return[packet.url,{...packet,html:body.toString()}]
}))
const HOME='https://www.immidart.com/',BOARD=HOME+'careers/',ROLE=BOARD+'technical-architect/'
const changeSchema=(html,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,start,raw,end)=>{
  const value=JSON.parse(raw);if(value['@type']==='JobPosting')change(value);return start+JSON.stringify(value)+end
})
function run(change=()=>{},options={}){
  const calls=[],visits=new Map()
  const packet=(url,init)=>{
    url=String(url);calls.push({url,init});const visit=(visits.get(url)||0)+1;visits.set(url,visit)
    const page=structuredClone(original[url]);assert.ok(page,'Declared public read '+url);change(page,url,visit);return page
  }
  return{calls,jobs:createImmidartTechnologiesLlpScraper().run({now:fixture.capturedAt,...options,
    fetchImpl:async(url,init)=>{const page=packet(url,init);const response=new Response(page.html,{status:page.status,headers:page.headers});Object.defineProperty(response,'url',{value:page.url});return response},
    fetchText:async url=>packet(url,{legacyTextOnly:true}).html,
  })}
}

test('Immidart current own full criteria qualify five roles while two overview placeholders remain held',async()=>{
  const result=run(),jobs=await result.jobs
  assert.equal(jobs.length,5)
  const architect=jobs.find(job=>job.sourceUrl===ROLE)
  assert.ok(architect);assert.match(architect.jobDescription,/SQL Server & Dapper\/ORM/)
  assert.match(architect.jobDescription,/Kubernetes Service/)
  assert.ok(architect.jobDescription.length>2000)
  assert.equal(architect.sourceNativeJobPosting.description.length<200,true)
  assert.equal(architect.postingDate,'2026-10-05')
  assert.equal(architect.closingDate,null)
  assert.equal(architect.location,'Bengaluru (5 Days Work From Office)')
  assert.ok(jobs.every(job=>job.country==='India'&&job.company==='Immidart Technologies LLP'&&job.sourceDetailComplete===true&&job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.equal(jobs.nativeCollectionEvidence.heldRecords.length,2)
  assert.ok(jobs.nativeCollectionEvidence.heldRecords.every(row=>row.reason==='native-full-authored-criteria-unqualified'))
  assert.equal(jobs.nativeCollectionEvidence.navigationLeads.length,7)
  assert.equal(jobs.nativeCollectionEvidence.navigationVisibilityQualified,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.ok(result.calls.every(call=>call.init.method==='GET'&&call.init.redirect==='manual'&&call.init.credentials==='omit'))
  assert.ok(result.calls.filter(call=>call.url===ROLE).length>=2)
  assert.equal(result.calls.some(call=>call.url.endsWith('/apply/')),false)
})

test('Immidart hidden discovery anchors cannot replace own visible full criteria or native typed country',async t=>{
  for(const [name,change]of[
    ['employer',p=>changeSchema(p,s=>{s.hiringOrganization.name='Other Company'})],
    ['employer-context',p=>changeSchema(p,s=>{s.hiringOrganization['@context']='https://unrelated.invalid/context'})],
    ['place-context',p=>changeSchema(p,s=>{s.jobLocation['@context']='https://unrelated.invalid/context'})],
    ['address-context',p=>changeSchema(p,s=>{s.jobLocation.address['@context']='https://unrelated.invalid/context'})],
    ['foreign-country',p=>changeSchema(p,s=>{s.jobLocation.address.addressCountry='US'})],
    ['missing-country',p=>changeSchema(p,s=>{delete s.jobLocation.address.addressCountry})],
    ['different-title',p=>changeSchema(p,s=>{s.title='Other Role'})],
    ['canonical',p=>p.replace('rel="canonical" href="'+ROLE+'"','rel="canonical" href="'+BOARD+'other/"')],
    ['article-hidden',p=>p.replace('<article class="career-detail__content"','<article hidden class="career-detail__content"')],
    ['article-css-hidden',p=>p.replace('</head>','<style>article{display:none!important}</style></head>')],
    ['schema-only-teaser',p=>p.replace(/<article\b[^>]*>[\s\S]*?<\/article>/,'<article class="career-detail__content"><p>Lead our product team.</p></article>')],
    ['empty-required-skills',p=>p.replace(/(<h2>Required skills<\/h2>)<ul\b[^>]*>[\s\S]*?<\/ul>/,'$1<ul></ul>')],
    ['future-publication',p=>changeSchema(p,s=>{s.datePosted='2099-01-01'})],
    ['expired',p=>changeSchema(p,s=>{s.validThrough='2020-01-01T23:59'})],
  ])await t.test(name,async()=>{
    await assert.rejects(run((p,url)=>{if(url===ROLE)p.html=change(p.html)}).jobs,/Immidart/i)
  })
})

test('Immidart current publisher, reviewed style bytes and closing full role context are mandatory',async t=>{
  for(const mode of['corporate-handoff','native-organization','style','closing-role','closing-board','closing-publisher'])await t.test(mode,async()=>{
    const result=run((p,url,visit)=>{
      if(mode==='corporate-handoff'&&url===HOME)p.html=p.html.replaceAll('href="/careers/"','href="/resources/"')
      if(mode==='native-organization'&&url===HOME)p.html=p.html.replaceAll('"name":"Immidart Technologies LLP"','"name":"Other Company"')
      if(mode==='style'&&url.endsWith('.css'))p.html+='article{display:none}'
      if(mode==='closing-role'&&url===ROLE&&visit>1)p.html=p.html.replaceAll('Dapper/ORM','Additional mandatory certification')
      if(mode==='closing-board'&&url===BOARD&&visit>1)p.html=p.html.replaceAll('/careers/product-specialist/','/careers/other-role/')
      if(mode==='closing-publisher'&&url===HOME&&visit>1)p.html=p.html.replaceAll('"name":"Immidart Technologies LLP"','"name":"Other Company"')
    })
    await assert.rejects(result.jobs,/Immidart/i)
  })
})

test('Immidart denied or empty native surfaces cannot become zero inventory or use legacy body-only data',async t=>{
  await t.test('HTTP403',async()=>{await assert.rejects(run(p=>{p.status=403}).jobs,/403|Immidart/i)})
  await t.test('empty',async()=>{await assert.rejects(run((p,url)=>{if(url===BOARD)p.html=p.html.replace(/<article class="careers-job-card">[\s\S]*?<\/article>/g,'')}).jobs,/Immidart/i)})
  await t.test('body-only',async()=>{await assert.rejects(createImmidartTechnologiesLlpScraper().run({fetchText:async()=>'<h1>No jobs available</h1>'}),/native HTTP|metadata|body-only/i)})
})

test('Immidart uncooperative native transports obey the source deadline and drain their reader',async t=>{
  for(const mode of['fetch','body'])await t.test(mode,async()=>{
    let cancelled=false
    const began=Date.now()
    const jobs=createImmidartTechnologiesLlpScraper().run({sourceDeadlineMs:40,fetchImpl:async()=>{
      if(mode==='fetch')return new Promise(()=>{})
      return{status:200,url:HOME,headers:new Headers({'Content-Type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancelled=true},releaseLock:()=>{}})}}
    }})
    await assert.rejects(jobs,/deadline/i)
    assert.ok(Date.now()-began<1000)
    if(mode==='body')assert.equal(cancelled,true)
  })
})

test('Immidart stops an oversized stream before buffering or reading later chunks',async()=>{
  let reads=0,cancelled=false
  const jobs=createImmidartTechnologiesLlpScraper().run({fetchImpl:async()=>({status:200,url:HOME,headers:new Headers({'Content-Type':'text/html'}),body:{getReader:()=>({
    read:async()=>{reads++;return{done:false,value:new Uint8Array(4000001)}},cancel:async()=>{cancelled=true},releaseLock:()=>{},
  })}})})
  await assert.rejects(jobs,/byte bound/i)
  assert.equal(reads,1);assert.equal(cancelled,true)
})

test('Immidart current explicit unavailable notices withhold the complete staged batch',async t=>{
  for(const notice of['This position is filled.','This role has been filled.','This vacancy is closed.','The job is no longer available.','We are no longer accepting applications for this position.','Applications for this role are closed.','This position has been withdrawn.'])await t.test(notice,async()=>{
    await assert.rejects(run((p,url)=>{if(url===ROLE)p.html=p.html.replace('<article class="career-detail__content">','<p>'+notice+'</p><article class="career-detail__content">')}).jobs,/closed|filled|unavailable|withdrawn/i)
  })
})

test('Immidart new schema criterion fields or changed schema introduction cannot omit native requirements from the full JD',async t=>{
  for(const field of['qualifications','responsibilities','skills','experienceRequirements','educationRequirements','physicalRequirement','securityClearanceRequirement','jobBenefits'])await t.test(field,async()=>{
    await assert.rejects(run((p,url)=>{if(url===ROLE)p.html=changeSchema(p.html,s=>{s[field]='An additional current minimum requirement: a PhD in cryptography.'})}).jobs,/schema.*(?:field|criteria|review)/i)
  })
  await t.test('changed-introduction',async()=>{
    await assert.rejects(run((p,url)=>{if(url===ROLE)p.html=changeSchema(p.html,s=>{s.description+='<p>An additional current minimum requirement: a PhD in cryptography.</p>'})}).jobs,/schema.*(?:introduction|criteria|review)/i)
  })
})

test('Immidart unavailable wording in inert or hidden examples cannot close an own current role',async()=>{
  const result=run((packet,url)=>{if(url===ROLE)packet.html=packet.html.replace('<article class="career-detail__content">',
    '<template><p>This position is filled.</p></template><script type="application/json">{"example":"This vacancy is closed."}</script>'
    +'<p hidden>This position has been withdrawn.</p><p style="display:none">Applications for this role are closed.</p>'
    +'<article class="career-detail__content">')})
  assert.equal((await result.jobs).length,5)
})

test('Immidart withheld new native schema criteria retain their complete original public receipt',async()=>{
  await assert.rejects(run((p,url)=>{if(url===ROLE)p.html=changeSchema(p.html,s=>{s.qualifications='An additional current minimum requirement: a PhD in cryptography.'})}).jobs,error=>{
    assert.equal(error.sourceAudit.source,'immidarttechnologiesllp')
    assert.ok(error.sourceAudit.originalResponses.find(p=>p.url===ROLE).body.includes('a PhD in cryptography'))
    assert.equal(error.sourceAudit.sourceScopeComplete,false)
    assert.equal(error.sourceAudit.lifecycleCleanupAllowed,false)
    return true
  })
})
