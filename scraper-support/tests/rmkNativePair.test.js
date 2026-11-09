import {pathToFileURL} from 'node:url'
import {getScraperCatalog} from '../providers/index.js'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {runNative,parseNativeRole} from '../shared/rmkNativePair.js'
import {buildPublicJobLifecycleDateScope} from '../../src/utils/publicJobLocationScope.js'
import {document} from '../shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {NATIVE_CONFIG as hersheyConfig} from '../../scraper/hershey.workday/script.js'
import {NATIVE_CONFIG as hubbellConfig} from '../../scraper/hubbell.workday/script.js'
const configs={hershey:hersheyConfig,hubbell:hubbellConfig}
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/rmkNativePair/native-capture.json',import.meta.url),'utf8'))
const read=(source,file)=>{const f=fixture.sources[source][file];assert.ok(f,'Missing captured fixture '+source+'/'+file);const bytes=gunzipSync(Buffer.from(f.gzipBase64,'base64'));assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);return bytes.toString('utf8')}

const survey=source=>JSON.parse(read(source,'native-survey.json'))
function replay(source,change=()=>{}){
 const config=configs[source],map=new Map(),requests=[];let initialSearch=true
 for(const file of Object.keys(fixture.sources[source]).filter(f=>f.endsWith('.json'))){const r=JSON.parse(read(source,file));if(r.requestedURL&&r.status===200){const bodyFile=r.bodyFile??r.hops?.at(-1)?.bodyFile;if(bodyFile)map.set(r.requestedURL,read(source,bodyFile))}}
 const now=JSON.parse(read(source,'003-search.json')).startedAt
 const fetchText=async url=>{requests.push(url);if(url===config.origin+'/search/'){const body=read(source,initialSearch?'003-search-hop0.body':'listing-closure-001.body');initialSearch=false;return change(url,body)??body}assert.ok(map.has(url),'Uncaptured URL '+url);const html=map.get(url);return change(url,html)??html}
 return{fetchText,requests,now}
}
for(const[source,count,total,pages]of[['hershey',9,323,13],['hubbell',19,664,23]]){
 test(source+' full original-clock replay preserves native content, IDs and independent scope',async()=>{
  const r=replay(source),catalog=getScraperCatalog(),provider=catalog.find(p=>p.source===source);assert.equal(new Set(catalog.map(p=>p.source)).size,catalog.length);assert.equal(catalog.filter(p=>p.source===source).length,1);assert.equal(provider.atsPlatform,'successfactors-rmk-native-html');assert.equal(provider.verifiedIndiaJobCount,null);const selected=await import(pathToFileURL(provider.modulePath).href),jobs=await selected.run(r)
  assert.equal(jobs.length,count);assert.equal(jobs[0].scrapedAt,r.now)
  const e=readInventoryEvidence(jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,total);assert.equal(e.pagesFetched,pages)
  for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceDetailComplete,true);assert.equal(job.legalEmployer,null);assert.equal(job.originalPublicationDate,null);assert.equal(job.nativeJobPosting,null);assert.equal(job.nativeEmployerLabel,configs[source].nativeEmployer);assert.ok(job.nativeDescriptionHTML.length>180);assert.equal(job.jobDescription,job.nativeDescriptionHTML);assert.equal(job.sourceDescription,job.nativeDescriptionHTML);assert.ok(job.nativeJobPostingHTML.includes(job.nativeDescriptionHTML));assert.equal(job.requisitionId===null,source==='hubbell')}
  assert.ok(r.requests.every(u=>!u.includes('/talentcommunity/apply/')))
 })
 test(source+' native errors, incomplete pages, scope drift, wrong tenant and unverified zero reject',async()=>{
  for(const mutate of[(u,h)=>u.includes('/search')?h.replace(/ssoCompanyId(\x22\s*:\s*')\w+/,"ssoCompanyId$1wrong"):h,(u,h)=>u.includes('/search')?h.replace(/Results\s*<b>/,'Changed <b>'):h,(u,h)=>u.includes('/search')?h.replace(/startrow=/g,'q=changed&amp;startrow='):h,(u,h)=>u.includes('/search')?'<p>No results</p>':h])await assert.rejects(runNative(configs[source],replay(source,mutate)))
  await assert.rejects(runNative(configs[source],{...replay(source),fetchText:async()=>{throw Error('HTTP 503')}}),/503/)
  await assert.rejects(runNative(configs[source],{...replay(source),signal:AbortSignal.abort(Error('stop'))}),/stop/)
 })
 test(source+' missing or boilerplate content remains partial and cleanup cannot become qualified',async()=>{
  const row=survey(source).details.find(x=>x.row.countryCode==='IN').row,html=read(source,'detail-'+row.jobId+'.body'),d=document(html),n=d.nodes(n=>n.attrs.itemprop==='description')[0],native=d.inner(n)
  for(const replacement of['','<p>We are an equal opportunity employer committed to diversity and inclusion.</p>','<template><p>Responsibilities include design and delivery of reliable production systems with extensive experience and professional qualifications.</p></template>']){
   const job=parseNativeRole(html.replace(native,replacement),row,configs[source]);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceDetailFailureKind,'missing-content')
  }
 })
 test(source+' explicit source closure and direct foreign placement are excluded while global collaboration remains',()=>{
  const row=survey(source).details.find(x=>x.row.countryCode==='IN').row,html=read(source,'detail-'+row.jobId+'.body'),d=document(html),n=d.nodes(n=>n.attrs.itemprop==='description')[0],native=d.inner(n)
  assert.equal(parseNativeRole(html.replace(native,'<p>This job is no longer active.</p>'+native),row,configs[source]).reason,'native-visible-source-closed')
  assert.equal(parseNativeRole(html.replace(native,'<p>This role is based in United States.</p>'+native),row,configs[source]).reason,'explicit-role-placement-contradicts-native-India-address')
  assert.equal(parseNativeRole(html.replace(native,'<p>Collaborate with global teams in the United States.</p>'+native),row,configs[source]).country,'India')
 })
 test(source+' source date precision and future native posting survive without substituting update or created clocks',()=>{
  const row=survey(source).details.find(x=>x.row.countryCode==='IN').row,html=read(source,'detail-'+row.jobId+'.body'),d=document(html),posted=d.nodes(n=>n.attrs.itemprop==='datePosted')[0].attrs.content
  const future=parseNativeRole(html.replace(posted,'2027-01-01'),row,configs[source],'2026-10-21T00:00:00.000Z');assert.equal(future.postingDate,'2027-01-01T00:00:00.000Z');assert.equal(future.nativeDatePostedPrecision,'day');assert.equal(future.originalPublicationDate,null)
  const noDate=parseNativeRole(html.replace(d.outer(d.nodes(n=>n.attrs.itemprop==='datePosted')[0]),''),row,configs[source]);assert.equal(noDate.postingDate,null)
  const valid=d.nodes(n=>n.attrs.itemprop==='validThrough')[0]
  if(valid){const day=parseNativeRole(html.replace(valid.attrs.content,'2026-12-31'),row,configs[source]);assert.equal(day.sourceClosingDateIsExact,false);assert.equal(day.nativeValidThroughPrecision,'day')}
 })
}
test('Hershey requisition ID and Hubbell public identity stay distinct',()=>{
 const row=survey('hershey').details.find(x=>x.row.jobId==='1402764300').row,job=parseNativeRole(read('hershey','detail-1402764300.body'),row,configs.hershey)
 assert.equal(job.jobId,'129285');assert.equal(job.nativePublicJobId,'1402764300');assert.ok(job.applyUrl.includes('/1402764300/'))
})
test('native pagination rejects changed totals, repeated public identities and missing continuation',async()=>{
 for(const source of['hershey','hubbell']){
  const first=JSON.parse(read(source,'native-listings.json')).rows[0].jobId
  const second=read(source,'listing-002.body'),secondId=JSON.parse(read(source,'native-listings.json')).rows[source==='hershey'?25:30].jobId
  for(const mutation of[
   (url,html)=>url.includes('startrow=')?html.replace(/of <b>\d+<\/b>/,'of <b>9999</b>'):html,
   (url,html)=>url.includes('startrow=')?html.replaceAll('/'+secondId+'/', '/'+first+'/'):html,
   (url,html)=>url.endsWith('/search/')?html.replaceAll('startrow=','removedrow='):html
  ])await assert.rejects(runNative(configs[source],replay(source,mutation)))
  assert.ok(second.includes(secondId))
 }
})
test('synthetic native foreign primary with a corroborated India secondary office remains an India role',()=>{
 const row=survey('hubbell').details.find(r=>r.row.jobId==='1422454600').row,html=read('hubbell','detail-'+row.jobId+'.body'),d=document(html),addresses=d.nodes(n=>n.attrs.itemprop==='address')
 const secondary=addresses[1],country=d.nodes(n=>n.attrs.itemprop==='addressCountry',secondary)[0],city=d.nodes(n=>n.attrs.itemprop==='addressLocality',secondary)[0].attrs.content
 const visible=d.nodes(n=>d.hasClass(n,'jobGeoLocation')).find(n=>d.text(n).startsWith(city+','));assert.ok(visible)
 const synthetic=html.replace(d.outer(secondary),d.outer(secondary).replace(d.outer(country),d.outer(country).replace('content="US"','content="IN"'))).replace(d.outer(visible),d.outer(visible).replace(', US,',', IN,'))
 const job=parseNativeRole(synthetic,row,configs.hubbell)
 assert.equal(row.countryCode,'US');assert.equal(job.country,'India');assert.ok(job.nativeLocations.some(a=>a.addressCountry==='US'));assert.ok(job.nativeLocations.some(a=>a.addressCountry==='IN'));assert.ok(job.location.includes(city));assert.equal(job.sourceListingComplete,false)
 assert.throws(()=>parseNativeRole(html.replace(d.outer(secondary),''),row,configs.hubbell),/count|country|location/i)
})
test('existing public lifecycle predicate retains its future upper bound independently from native dates',()=>{
 const now=new Date('2026-10-22T00:00:00.000Z'),scope=buildPublicJobLifecycleDateScope(now)
 assert.ok(JSON.stringify(scope).includes('2026-10-22T00:00:00.000Z'))
 assert.ok(JSON.stringify(scope).includes('$lte'))
})
test('impossible native publication and deadline calendar, time and offset values fail closed',()=>{
 const row=survey('hershey').details.find(x=>x.row.jobId==='1402764300').row,html=read('hershey','detail-'+row.jobId+'.body'),d=document(html)
 for(const field of['datePosted','validThrough']){const n=d.nodes(n=>n.attrs.itemprop===field)[0];assert.ok(n)
  for(const value of['2026-02-30','2026-02-29','2026-04-31','2026-01-01T24:00:00Z','2026-01-01T23:60:00Z','2026-01-01T00:00:00+24:00','2026-01-01T00:00:00+00:60','Mon Feb 30 07:00:00 UTC 2026'])assert.throws(()=>parseNativeRole(html.replace(n.attrs.content,value),row,configs.hershey),/date|calendar|time|offset/i,value)
 }
 const posted=d.nodes(n=>n.attrs.itemprop==='datePosted')[0]
 const future=parseNativeRole(html.replace(posted.attrs.content,'2028-02-29T10:15:30+05:30'),row,configs.hershey)
 assert.equal(future.nativeDatePosted,'2028-02-29T10:15:30+05:30');assert.equal(future.postingDate,'2028-02-29T04:45:30.000Z');assert.equal(future.originalPublicationDate,null)
})
for(const source of['hershey','hubbell']){
 test(source+' advertised search origin and scope are bound before inventory reads',async()=>{
  const config=configs[source]
  for(const target of['https://unrelated.example/search/','http://'+new URL(config.origin).hostname+'/search/','https://user:pass@'+new URL(config.origin).hostname+'/search/',config.origin+':8443/search/','/search/#other','/search/#','/search/?q=foreign-only','/search/?optionsFacetsDD_country=US','/search/?startrow=30','/search/?q=&q=changed','/search/?locale=fr_FR']){
   for(const landing of['<form method="get" action="'+target+'"></form>','<a href="'+target+'">Search</a>']){
    const fixture=replay(source,(url,html)=>url===config.origin+'/'?landing:html)
    await assert.rejects(runNative(config,fixture),/advertised GET search/)
    assert.equal(fixture.requests.length,2,'Invalid advertised target must fail before any inventory GET')
   }
  }
  const scopedForm=replay(source,(url,html)=>url===config.origin+'/'?'<form method="get" action="/search/"><input name="q" value="foreign-only"></form>':html)
  await assert.rejects(runNative(config,scopedForm),/advertised GET search/);assert.equal(scopedForm.requests.length,2)
 })
 test(source+' genuine schema.org JobPosting itemscope is required',()=>{
  const row=survey(source).details.find(r=>r.row.countryCode==='IN').row,html=read(source,'detail-'+row.jobId+'.body'),d=document(html),scope=d.nodes(n=>(n.attrs.itemtype||'').endsWith('/JobPosting'))[0],opening=html.slice(scope.start,scope.openEnd)
  for(const replacement of[opening.replace('http://schema.org/JobPosting','https://unrelated.example/JobPosting'),opening.replace('http://schema.org/JobPosting','http://schema.org.evil.example/JobPosting'),opening.replace(/\sitemscope(?:="itemscope")?/,''),opening.replace('itemscope=','data-itemscope='),opening.replace('http://schema.org/JobPosting','https://schema.org/JobPosting?other=1')])assert.throws(()=>parseNativeRole(html.replace(opening,replacement),row,configs[source]),/JobPosting microdata/)
  for(const type of['http://schema.org/JobPosting','https://schema.org/JobPosting','http://schema.org/JobPosting/','https://schema.org/JobPosting/']){
   const replacement=opening.replace('http://schema.org/JobPosting',type).replace('itemscope="itemscope"','itemscope')
   assert.equal(parseNativeRole(html.replace(opening,replacement),row,configs[source]).sourceDetailComplete,true)
  }
 })
 test(source+' approved empty and default native advertisements preserve the captured records',async()=>{
  const config=configs[source],baseline=await runNative(config,replay(source))
  for(const landing of['<form method="get" action="/search/"><input name="createNewAlert" value="false"><input name="q" value=""></form>','<a href="'+config.origin+'/search?q=&amp;sortColumn=referencedate&amp;sortDirection=desc&amp;startrow=0">Search</a>']){
   const jobs=await runNative(config,replay(source,(url,html)=>url===config.origin+'/'?landing:html));assert.deepEqual(jobs,baseline)
  }
 })
}
for(const source of['hershey','hubbell']){
 const base='<form id="nativeSearch" method="get" action="/search/"><input name="q" value=""></form>'
 for(const [name,landing]of[
  ['external location',base+'<input form="nativeSearch" name="locationsearch" value="United States">'],
  ['external duplicate keyword',base+'<input form="nativeSearch" name="q" value="foreign-only">'],
  ['nameless submit override','<form method="get" action="/search/"><input name="q" value=""><button type="submit" formaction="https://unrelated.example/search/">Search jobs</button></form>']
 ])test(source+' form associations reject reviewer '+name+' before inventory reads',async()=>{
  const config=configs[source],r=replay(source,(url,html)=>url===config.origin+'/'?landing:html)
  await assert.rejects(runNative(config,r),/advertised GET search/);assert.equal(r.requests.length,2)
 })
 test(source+' unsupported form-control associations and overrides fail conservatively',async()=>{
  const cases=[
   base+'<input hidden form="nativeSearch" name="locationsearch" value="United States">',
   base+'<button form="nativeSearch" formaction="https://unrelated.example/search/">Search</button>',
   '<form method="get" action="/search/"><input hidden name="locationsearch" value="United States"></form>',
   '<form method="get" action="/search/"><select hidden name="optionsFacetsDD_country"><option value="US">US</option></select></form>',
   '<form method="get" action="/search/"><input type="submit" formmethod="post"></form>',
   '<form method="get" action="/search/"><button formmethod="post">Search</button></form>',
   '<form id="nativeSearch" method="get" action="/search/"><input form="other" name="q" value=""></form>',
   base+'<form id="nativeSearch" method="post" action="/elsewhere"></form>',
   '<div id="nativeSearch"></div>'+base,
   '<form method="get" action="/search/"><form method="get" action="/search/"></form></form>'
  ]
  for(const landing of cases){const config=configs[source],r=replay(source,(url,html)=>url===config.origin+'/'?landing:html);await assert.rejects(runNative(config,r),/advertised GET search/);assert.equal(r.requests.length,2)}
 })
 test(source+' unrelated invalid forms and inert controls preserve separate genuine advertisements',async()=>{
  const config=configs[source],baseline=await runNative(config,replay(source)),invalid='<form id="unrelated" method="get" action="https://unrelated.example/search/"><button formaction="https://unrelated.example/">Other</button></form><input form="unrelated" name="locationsearch" value="United States">'
  for(const landing of[invalid+base,invalid+'<a href="/search/">Native search</a>',base+'<template><input form="nativeSearch" name="q" value="foreign-only"></template>']){
   const jobs=await runNative(config,replay(source,(url,html)=>url===config.origin+'/'?landing:html));assert.deepEqual(jobs,baseline)
  }
 })
}
