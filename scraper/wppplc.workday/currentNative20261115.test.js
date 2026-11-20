import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runCurrentWpp as run} from './currentNative20261115.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(p=>{const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256);return[p.requestedURL||p.url,{...p,html:bytes.toString()}]}))
const HOME='https://www.wpp.com/',CAREERS=HOME+'en/careers/search-and-apply',BOARD='https://wpp.careersitecloud.com/'
const ROLE=BOARD+'job-6af4594397c98829424e00ea-manager-category-travel-andheri',APPLY='https://job-boards.greenhouse.io/wpp/jobs/8931621002'
const mutateSchema=(html,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,start,raw,end)=>{const value=JSON.parse(raw);change(value);return start+JSON.stringify(value)+end})
function execute(change=()=>{},options={}){const calls=[],visits=new Map();return{calls,jobs:run({now:()=>fixture.capturedAt,...options,fetchImpl:async(url,init)=>{
  url=String(url);calls.push({url,init});const visit=(visits.get(url)||0)+1;visits.set(url,visit)
  const packet=structuredClone(packets.get(url));assert.ok(packet,'Declared actual native URL '+url);change(packet,url,visit)
  const response=new Response(packet.html,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
}})}}
test('WPP exact native title plus independently typed city reconciles one own India role and complete current criteria',async()=>{
  const result=execute(),jobs=await result.jobs
  assert.equal(jobs.length,1);const job=jobs[0]
  assert.equal(job.title,'Manager - Category (Travel)');assert.equal(job.nativeVisibleTitle,'Manager - Category (Travel), Andheri')
  assert.equal(job.company,'WPP plc');assert.equal(job.country,'India');assert.equal(job.city,'Andheri');assert.equal(job.jobId,'8931621002')
  assert.equal(job.applyUrl,APPLY);assert.equal(job.sourceUrl,ROLE);assert.ok(job.jobDescription.length>5000)
  assert.match(job.jobDescription,/Experience of operational management of large complex regional travel programmes/)
  assert.match(job.jobDescription,/Privacy Notice/)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.ok(result.calls.filter(c=>c.url===ROLE).length>=2);assert.ok(result.calls.filter(c=>c.url===APPLY).length>=2)
  assert.ok(result.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'))
})
test('WPP role bindings do not accept arbitrary title suffixes, agency aliases, countries or application IDs',async t=>{
  for(const [name,change]of[
    ['wrong-visible-suffix',h=>h.replace('Manager - Category (Travel), Andheri</h1>','Manager - Category (Travel), Chennai</h1>')],
    ['wrong-schema-title',h=>mutateSchema(h,s=>{s.title='Other Manager'})],
    ['wrong-employer',h=>mutateSchema(h,s=>{s.hiringOrganization.name='WPP Media'})],
    ['nested-employer-context',h=>mutateSchema(h,s=>{s.hiringOrganization['@context']='https://unrelated.invalid/schema'})],
    ['nested-address-context',h=>mutateSchema(h,s=>{s.jobLocation[0].address['@context']='https://unrelated.invalid/schema'})],
    ['foreign-country',h=>mutateSchema(h,s=>{s.jobLocation[0].address.addressCountry='United States'})],
    ['missing-country',h=>mutateSchema(h,s=>{delete s.jobLocation[0].address.addressCountry})],
    ['wrong-native-id',h=>mutateSchema(h,s=>{s.identifier.value='8931621999'})],
    ['wrong-apply-account',h=>h.replaceAll('greenhouse.io/wpp/jobs/','greenhouse.io/other/jobs/')],
    ['wrong-apply-id',h=>h.replaceAll('greenhouse.io/wpp/jobs/8931621002','greenhouse.io/wpp/jobs/8931621999')],
    ['new-schema-criteria',h=>mutateSchema(h,s=>{s.qualifications='Additional mandatory certification.'})],
    ['future-date',h=>mutateSchema(h,s=>{s.datePosted='2099-11-11T12:02:11.186Z'})],
    ['expired',h=>mutateSchema(h,s=>{s.validThrough='2020-05-11T12:02:11.186Z'})],
    ['hidden-JD',h=>h.replace('class="description-info"','hidden class="description-info"')],
    ['unreviewed-hiding-style',h=>h.replace('class="description-info"','class="description-info" style="filter:opacity(0)"')],
    ['empty-JD',h=>h.replace(/<div class="description-info">[\s\S]*?<\/div>/,'<div class="description-info">Apply now.</div>')],
    ['filled-notice',h=>h.replace('<div class="description-info">','<p>This position is filled.</p><div class="description-info">')],
  ])await t.test(name,async()=>{await assert.rejects(execute((p,url)=>{if(url===ROLE)p.html=change(p.html)}).jobs,/WPP/i)})
})
test('WPP current corporate delegation, native styles and independent application criteria remain mandatory',async t=>{
  for(const mode of['iframe','style','application-company','application-criteria','application-hidden-criteria','application-new-schema-criteria','closing-role','closing-board','closing-publisher'])await t.test(mode,async()=>{
    await assert.rejects(execute((p,url,visit)=>{
      if(mode==='iframe'&&url===CAREERS)p.html=p.html.replace('src="https://wpp.careersitecloud.com/"','src="https://other.careersitecloud.com/"')
      if(mode==='style'&&url.includes('.css'))p.html+='body{display:none}'
      if(mode==='application-company'&&url===APPLY)p.html=p.html.replace(' at WPP</title>',' at Other Company</title>')
      if(mode==='application-criteria'&&url===APPLY)p.html=p.html.replaceAll('regional travel programmes','regional travel programmes and a PhD in cryptography')
      if(mode==='application-hidden-criteria'&&url===APPLY)p.html=p.html.replace('class="job__description body">','class="job__description body"><p hidden>An additional mandatory PhD in cryptography.</p>')
      if(mode==='application-new-schema-criteria'&&url===APPLY)p.html=p.html.replace('</head>','<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'JobPosting',url:APPLY,title:'Manager - Category (Travel)',qualifications:'An additional mandatory PhD in cryptography.'})+'</script></head>')
      if(mode==='closing-role'&&url===ROLE&&visit>1)p.html=p.html.replaceAll('regional travel programmes','regional travel programmes and a PhD in cryptography')
      if(mode==='closing-board'&&url===BOARD&&visit>1)p.html=p.html.replace(/<p>WPP\s*-\s*India,\s*Andheri<\/p>/,'<p>WPP Media - India, Andheri</p>')
      if(mode==='closing-publisher'&&url===CAREERS&&visit>1)p.html=p.html.replace('src="https://wpp.careersitecloud.com/"','src="https://other.careersitecloud.com/"')
    }).jobs,/WPP/i)
  })
})
test('WPP native denials and no qualified own India roles remain failures rather than zero inventory',async t=>{
  await t.test('denial',async()=>{await assert.rejects(execute((p,url)=>{if(url===BOARD)p.status=403}).jobs,/403|WPP/i)})
  await t.test('other-agency-only',async()=>{await assert.rejects(execute((p,url)=>{if(url===BOARD)p.html=p.html.replace(/<p>WPP\s*-\s*India,\s*Andheri<\/p>/,'<p>Landor - India, Andheri</p>')}).jobs,/WPP/i)})
})

test('WPP current explicit unavailability is rejected on both native role surfaces and reads',async t=>{
  for(const [surface,url,marker]of[['role',ROLE,'<div class="description-info">'],['application',APPLY,'<div class="job__description body">']]){
    for(const phase of['opening','closing'])for(const notice of['This position is currently unavailable.','This job is now filled.'])await t.test(surface+' '+phase+' '+notice,async()=>{
      await assert.rejects(execute((packet,value,visit)=>{
        if(value===url&&(phase==='opening'?visit===1:visit>1)){
          assert.ok(packet.html.includes(marker));packet.html=packet.html.replace(marker,'<p>'+notice+'</p>'+marker)
        }
      }).jobs,/filled|closed|unavailable/i)
    })
  }
})

test('WPP hidden and inert unavailability examples do not override an independently current public role',async t=>{
  for(const [surface,url,marker]of[['role',ROLE,'<div class="description-info">'],['application',APPLY,'<div class="job__description body">']]){
    for(const example of['<p hidden>This position is currently unavailable.</p>','<template><p>This position is currently unavailable.</p></template>'])await t.test(surface+' '+example,async()=>{
      const jobs=await execute((packet,value)=>{if(value===url){assert.ok(packet.html.includes(marker));packet.html=packet.html.replace(marker,example+marker)}}).jobs
      assert.equal(jobs.length,1)
    })
  }
})

test('WPP uncooperative native HTTP fetch/body still settle by deadline and cancel the body',async t=>{
  for(const mode of['fetch','body'])await t.test(mode,async()=>{
    let cancelled=false
    const started=Date.now()
    await assert.rejects(run({sourceDeadlineMs:40,fetchImpl:async()=>{
      if(mode==='fetch')return new Promise(()=>{})
      return{status:200,url:HOME,headers:new Headers({'Content-Type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancelled=true},releaseLock:()=>{}})}}
    }}),/deadline/i)
    assert.ok(Date.now()-started<1000);if(mode==='body')assert.equal(cancelled,true)
  })
})

test('WPP preserves exact caller cancellation reasons before and during a native read',async t=>{
  for(const phase of['pre-aborted','fetch','body'])for(const reason of[Object.freeze(new Error('caller-stop')),'caller-stop',new Error('caller-stop')])await t.test(phase+' '+typeof reason+' '+Object.isFrozen(reason),async()=>{
    const controller=new AbortController();let reads=0,cancelled=false
    if(phase==='pre-aborted')controller.abort(reason)
    const pending=run({signal:controller.signal,fetchImpl:async()=>{
      reads++
      if(phase==='fetch'){queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})}
      return{status:200,url:HOME,headers:new Headers({'Content-Type':'text/html'}),body:{getReader:()=>({
        read:()=>{queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})},cancel:async()=>{cancelled=true},releaseLock:()=>{},
      })}}
    }})
    await assert.rejects(pending,error=>{assert.strictEqual(error,reason);return true})
    if(reason&&typeof reason==='object')assert.equal(Object.hasOwn(reason,'sourceAudit'),false)
    assert.equal(reads,phase==='pre-aborted'?0:1);if(phase==='body')assert.equal(cancelled,true)
  })
})

test('WPP optional audit attachment never replaces a native transport error',async t=>{
  const frozen=Object.freeze(new Error('native-failure')),fixedAudit=new Error('native-failure')
  Object.defineProperty(fixedAudit,'sourceAudit',{value:'original',writable:false,configurable:false})
  for(const reason of[frozen,fixedAudit])await t.test(Object.isFrozen(reason)?'frozen':'fixed-audit',async()=>{
    await assert.rejects(run({fetchImpl:async()=>{throw reason}}),error=>{assert.strictEqual(error,reason);return true})
  })
})

test('WPP bounded transport stops an oversized stream before consuming more chunks',async()=>{
  let reads=0,cancelled=false
  await assert.rejects(run({fetchImpl:async()=>({status:200,url:HOME,headers:new Headers({'Content-Type':'text/html'}),body:{getReader:()=>({
    read:async()=>{reads++;return{done:false,value:new Uint8Array(4000001)}},cancel:async()=>{cancelled=true},releaseLock:()=>{},
  })}})}),/byte bound/i)
  assert.equal(reads,1);assert.equal(cancelled,true)
})

test('WPP inactive application declarations and extra active mutation programs never qualify an application URL',async t=>{
  for(const mode of['template','empty-src','nomodule','module-override'])await t.test(mode,async()=>{
    await assert.rejects(execute((p,url)=>{if(url===ROLE){
      if(mode==='module-override')p.html+='<script type="module">window.immediateApplyRedirect="https://other.invalid/jobs";</script>'
      else p.html=p.html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>{
        if(!code.includes('var immediateApplyRedirect'))return all
        return mode==='template'?'<template>'+all+'</template>':'<script '+(mode==='empty-src'?'src=""':'nomodule')+attrs+'>'+code+'</script>'
      })
    }}).jobs,/WPP/i)
  })
})
