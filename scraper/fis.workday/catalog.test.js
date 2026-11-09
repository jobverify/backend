import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { run } from './script.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const original = JSON.parse(readFileSync(new URL('./fixtures/native-india-001.json', import.meta.url)))
const native = () => structuredClone(original)
const base = 'https://careers.fisglobal.com'
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c')
const bootstrap = () => '<script>var phApp = phApp || ' + json({ widgetApiEndpoint: base + '/widgets', country:'us',
  deviceType:'desktop', locale:'en_us', refNum:'FIGLUS', pageName:'search-results' }) + '; phApp.ddo = '
  + json({ eagerLoadRefineSearch:{totalHits:519,hits:0,data:{jobs:[],aggregations:[{field:'country',value:{India:122}}]}},
    siteConfig:{data:{siteSettings:{refineSearch:{enabledFacets:['country','companyValue'],facetDisplayNames:{companyValue:'Company'}}}}} }) + ';</script>'
const row = (id='JR0305635', country='India') => ({ reqId:id, jobId:id, jobSeqNo:'FIGLUS'+id+'EXTERNAL',
  title:id==='JR0305635'?'Quality Analyst Engineer':'Role '+id, country,
  city:country==='India'?'Bengaluru':'Manila', state:country==='India'?'Karnātaka':'',
  cityStateCountry:country==='India'?'Bengaluru, Karnātaka, India':'Manila, Philippines',
  siteType:'external', visibilityType:'External', jobVisibility:['external','internal'],
  applyUrl:id==='JR0305635'?original.job.applyUrl:'https://fis.wd5.myworkdayjobs.com/SearchJobs/job/office/Role_'+id+'/apply',
  postedDate:'2026-08-06T00:00:00.000+0000', descriptionTeaser:'Native listing teaser, never a full description.' })
const payload = (rows, total=rows.length, india=rows.filter(x=>x.country==='India').length) => ({refineSearch:{status:200,
  totalHits:total,hits:rows.length,data:{jobs:rows,ui_selections:{companyValue:['FIS']},aggregations:[
    {field:'country',value:{India:india,Philippines:total-india}},{field:'companyValue',value:{FIS:total,TSYS:5}},
  ]}}})
const detail = fixture => '<link rel="canonical" href="'+fixture.canonical+'"><script>phApp.ddo = '
  + json({jobDetail:{status:200,data:{job:fixture.job}}}) + ';</script><script type="application/ld+json">'
  + json(fixture.posting) + '</script>'
const options = ({ rows=[row()], fixture=native(), response, detailResponse, ...rest }={}) => ({
  fetchText:async url=>url.includes('/search-results')?bootstrap():detailResponse?detailResponse(url):detail(fixture),
  fetchJson:async (_url, request)=>{
    const body=JSON.parse(request.body)
    assert.deepEqual(body.selected_fields,{companyValue:['FIS']})
    assert.equal(body.ddoKey,'refineSearch');assert.equal(body.size,500)
    assert.equal(request.method,'POST')
    return response?response(body):payload(rows)
  }, ...rest,
})

test('FIS catalog executes the official native company-scoped source instead of a zero sentinel',()=>{
  const p=getScraperCatalog().find(x=>x.source==='fis')
  assert.equal(p.atsPlatform,'phenom-native-fis-company-facet')
  assert.equal(p.zeroResultPolicy,'evidence-required')
  assert.match(p.modulePath,/fis\.workday[\\/]script\.js$/)
  assert.equal(p.verifiedPublicJobCount,null)
  assert.equal(p.bindingEvidence.verified,true)
})

test('actual typed street-address India detail keeps full authoritative content, offices, employer evidence and original native dates',async()=>{
  const jobs=await run(options())
  assert.equal(jobs.length,1)
  const j=jobs[0]
  assert.equal(j.sourceDetailComplete,true)
  assert.match(j.jobDescription,/^<p style="text-align:left"><b> Position Type : <\/b><\/p>Full time/)
  assert.equal(j.sourceNativeMLDescription,original.job.ml_Description)
  assert.equal(j.sourceNativeJobPosting.description,original.posting.description)
  assert.equal(j.location,'Bengaluru, Karnātaka, India')
  assert.equal(j.city,'Bengaluru')
  assert.equal(j.country,'India')
  assert.equal(j.postingDate,'2026-08-06T00:00:00.000+0000')
  assert.equal(j.sourceNativePublicationEvidence.jsonLdDatePosted,'2026-08-13')
  assert.equal(j.sourceNativePublicationEvidence.dateCreated,'2026-03-13T16:29:24.153+0000')
  assert.deepEqual(j.sourceNativeLocations,original.job.multi_location)
  assert.equal(j.applyUrl,original.job.applyUrl)
  assert.equal(j.sourceEmployerEvidence.companyValue,'FIS')
  assert.equal(j.sourceEmployerEvidence.legalEmployerVerified,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('complete global FIS pagination counts foreign rows and reconciles the India subset',async()=>{
  const offsets=[],foreign=row('JR0000002','Philippines')
  const jobs=await run(options({response:body=>{offsets.push(body.from);return payload(body.from===0?[foreign]:[row()],2,1)}}))
  assert.deepEqual(offsets,[0,1]);assert.equal(jobs.length,1)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,1)
  assert.equal(readInventoryEvidence(jobs).pagesFetched,2)
})

test('native Hong Kong country uses its explicit ISO HK alias without making India scope uncertain',async()=>{
  const foreign={...row('JR0000002','Hong Kong'),city:'Hong Kong',cityStateCountry:'Hong Kong, Hong Kong'}
  const jobs=await run(options({rows:[row(),foreign],response:()=>payload([row(),foreign],2,1)}))
  assert.equal(jobs.length,1)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(jobs[0].sourceListingComplete,undefined)
})

test('explicit Internal/External visibility remains a public external role when native visibility arrays agree',async()=>{
  const fixture=native();fixture.job.visibilityType='Internal/External'
  const listing={...row(),visibilityType:'Internal/External'}
  const jobs=await run(options({rows:[listing],fixture}))
  assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

for(const [label,change] of [
  ['other company',f=>{f.job.companyValue='TSYS'}],
  ['unknown company',f=>{delete f.job.companyValue}],
  ['foreign primary country',f=>{f.job.country='Philippines'}],
  ['contradictory office country',f=>{f.job.multi_location[0].country='Philippines'}],
  ['contradictory office city',f=>{f.job.multi_location[0].city='Pune'}],
  ['contradictory office postal code',f=>{f.posting.jobLocation[0].address.postalCode='99999'}],
  ['contradictory office state',f=>{f.job.multi_location[0].state='Tamil Nādu'}],
  ['different application',f=>{f.job.applyUrl=f.job.applyUrl.replace('JR0305635','JR9999999')}],
  ['different sequence',f=>{f.job.jobSeqNo='FIGLUSJR9999999EXTERNAL'}],
  ['different canonical',f=>{f.canonical=f.canonical.replace('JR0305635','JR9999999')}],
  ['closed native role',f=>{f.job.jobReqStatus='CLOSED'}],
]) test(label+' cannot yield a complete FIS extraction or authorize deletion',async()=>{
  const fixture=native();change(fixture)
  const jobs=await run(options({fixture}))
  assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].jobDescription,null)
  assert.equal(jobs[0].sourceListingComplete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('missing native JD leaves the listing teaser ineligible and protects absent jobs',async()=>{
  const fixture=native();fixture.job.ml_Description='';fixture.posting.description=''
  const jobs=await run(options({fixture}))
  assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].sourceDetailFailureKind,'missing-content')
  assert.equal(jobs[0].sourceListingComplete,false)
})

test('unknown publication fields stay null even with native creation and update timestamps',async()=>{
  const fixture=native();delete fixture.job.postedDate;delete fixture.posting.datePosted
  const listing=row();delete listing.postedDate
  const jobs=await run(options({rows:[listing],fixture}))
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].postingDate,null)
})

test('a later detail publication value cannot refresh an older listing publication date',async()=>{
  const fixture=native();fixture.job.postedDate='2026-10-21';fixture.posting.datePosted='2026-10-22'
  const jobs=await run(options({fixture}))
  assert.equal(jobs[0].postingDate,'2026-08-06T00:00:00.000+0000')
})

for(const response of ['<html><title>Just a moment</title></html>',()=>{throw Object.assign(new Error('HTTP 503'),{status:503})}]) {
  test('detail challenge or upstream failure cannot masquerade as complete extraction '+String(response),async()=>{
    const jobs=await run(options({detailResponse:()=>typeof response==='function'?response():response}))
    assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceListingComplete,false)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  })
}

test('an ambiguous Remote record prevents complete inventory authority while retaining verified India jobs',async()=>{
  const remote={...row('JR0000002'),country:'',city:'',cityStateCountry:'Remote'}
  const jobs=await run(options({response:()=>payload([row(),remote],2,1)}))
  assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
})

test('explicit native empty contract can establish zero India jobs without treating a shell as zero',async()=>{
  const jobs=await run(options({response:()=>payload([],0,0)}))
  assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
  await assert.rejects(run(options({fetchText:async()=>'<html>no data</html>'})),/FIS|PHENOM/)
})

for(const [label,response] of [
  ['missing FIS filter echo',()=>{const p=payload([]);p.refineSearch.data.ui_selections={};return p}],
  ['nonterminal empty page',()=>payload([],3,1)],
  ['duplicate page',()=>payload([row()],2,2)],
  ['foreign tenant',()=>payload([{...row(),jobSeqNo:'OTHERJR0305635EXTERNAL'}])],
  ['HTTP failure',()=>{throw new Error('HTTP 403')}],
  ['malformed hits',()=>{const p=payload([row()]);p.refineSearch.hits=5;return p}],
]) test(label+' fails closed instead of certifying a successful empty snapshot',async()=>{
  await assert.rejects(run(options({response})),/FIS|PHENOM|403/)
})

test('detail budget exhaustion preserves verified positives but prevents complete extraction authority',async()=>{
  const jobs=await run(options({detailEnrichmentBudgetMs:0}))
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].sourceListingComplete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const wrap of [h=>'<template>'+h+'</template>',h=>'<!--'+h+'-->',h=>h.replace('<script>','<script src="/stale.js">')]) {
  test('inactive native model cannot authenticate full FIS content '+String(wrap),async()=>{
    const jobs=await run(options({detailResponse:()=>wrap(detail(native()))}))
    assert.equal(jobs[0].sourceDetailComplete,false)
    assert.equal(jobs[0].sourceListingComplete,false)
  })
}

test('caller cancellation rejects the entire source run',async()=>{
  const reason=new Error('caller stopped')
  await assert.rejects(run(options({signal:AbortSignal.abort(reason)})),e=>e===reason)
})

