import assert from 'node:assert/strict'
import test from 'node:test'
import {fileURLToPath} from 'node:url'
import {createPhenomScraper} from '../phenom/engine.js'

const scraper=createPhenomScraper({companyName:'Apply Identity Fixture',source:'phenom-apply-identity-fixture',
  baseUrl:'https://careers.example.test',scraperDir:fileURLToPath(new URL('.',import.meta.url))})
const row=()=>({jobId:'REQ-1',reqId:'REQ-1',title:'Owned Role',country:'India',cityStateCountry:'Pune, India',descriptionTeaser:'A listing teaser.'})
const roleUrl=scraper.buildJobDetailUrl(row()),nativeApply=roleUrl+'/apply',description='<p>Build and maintain complete native employer production services.</p>'
const fixture=()=>({listing:row(),canonical:roleUrl,job:{jobId:'REQ-1',reqId:'REQ-1',title:'Owned Role',ml_country:'India',ml_Description:description,applyUrl:nativeApply},
  posting:{'@context':'https://schema.org','@type':'JobPosting',identifier:'REQ-1',title:'Owned Role',description,datePosted:'2026-07-06',
    jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'Pune',addressCountry:'India'}}}})
const run=async model=>{
  const listing='<script>phApp.ddo = '+JSON.stringify({eagerLoadRefineSearch:{totalHits:1,hits:1,data:{jobs:[model.listing],aggregations:[{field:'country',value:{India:1}}]}}})+'</script>'
  const canonical=model.canonical==null?'':'<link rel="canonical" href="'+model.canonical+'">'
  const detail='<head>'+canonical+'<script type="application/ld+json">'+JSON.stringify(model.posting)+'</script></head><script>phApp.ddo = '+JSON.stringify({jobDetail:{data:{job:model.job}}})+'</script>'
  const calls=[],jobs=await scraper.run({maxPages:1,maxJobs:5,fetchText:async url=>{calls.push(url);assert.ok([scraper.buildSearchResultsPageUrl(),roleUrl].includes(url));return url===roleUrl?detail:listing}})
  assert.deepEqual(calls,[scraper.buildSearchResultsPageUrl(),roleUrl]);assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'REQ-1');assert.equal(jobs[0].requisitionId,'REQ-1');assert.equal(jobs[0].title,'Owned Role');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceUrl,roleUrl)
  return jobs[0]
}
for(const [name,change]of[
  ['matching raw native job IDs',()=>{}],
  ['one explicit raw requisition',model=>{delete model.job.jobId}],
])test('absent listing apply accepts an observed owned same-role apply with '+name,async()=>{
  const model=fixture();change(model);const job=await run(model)
  assert.equal(job.applyUrl,nativeApply);assert.equal(job.link,nativeApply);assert.equal(job.sourceDetailComplete,true)
  assert.match(job.jobDescription,/complete native employer production/);assert.equal(job.postingDate,'2026-07-06');assert.ok(job.nativeEmployer==null)
})
test('missing native detail apply never manufactures an apply route',async()=>{
  const model=fixture();delete model.job.applyUrl;const job=await run(model)
  assert.equal(job.applyUrl,roleUrl);assert.equal(job.link,roleUrl);assert.equal(job.sourceDetailComplete,true)
})
test('explicit agreeing external listing and detail URLs retain their original contract',async()=>{
  const model=fixture(),url='https://native-apply.example/job/REQ-1?source=careers';model.listing.applyUrl=url;model.job.applyUrl=url;const job=await run(model)
  assert.equal(job.applyUrl,url);assert.equal(job.sourceDetailComplete,true)
})
for(const [name,change]of[
  ['no raw canonical',model=>{model.canonical=null}],
  ['wrong raw canonical role',model=>{model.canonical=roleUrl.replace('REQ-1','REQ-2')}],
  ['foreign raw canonical host',model=>{model.canonical=roleUrl.replace('careers.example.test','other.example.test')}],
  ['no raw role IDs',model=>{delete model.job.jobId;delete model.job.reqId;delete model.posting.identifier}],
  ['wrong raw role ID',model=>{model.job.jobId='REQ-2'}],
  ['no raw native title',model=>{delete model.job.title;delete model.posting.title}],
  ['wrong raw native title',model=>{model.job.title='Other Role'}],
  ['no raw detail country',model=>{delete model.job.ml_country;delete model.posting.jobLocation}],
  ['foreign raw detail country',model=>{model.job.ml_country='United States';model.posting.jobLocation.address.addressCountry='United States'}],
  ['foreign detail apply host',model=>{model.job.applyUrl=nativeApply.replace('careers.example.test','other.example.test')}],
  ['wrong-job detail apply',model=>{model.job.applyUrl=nativeApply.replace('REQ-1','REQ-2')}],
  ['other same-origin apply path',model=>{model.job.applyUrl='https://careers.example.test/apply'}],
  ['query on uncorroborated detail apply',model=>{model.job.applyUrl=nativeApply+'?role=REQ-1'}],
  ['fragment on uncorroborated detail apply',model=>{model.job.applyUrl=nativeApply+'#apply'}],
  ['credentials on detail apply',model=>{model.job.applyUrl=nativeApply.replace('https://','https://user:secret@')}],
  ['HTTP detail apply',model=>{model.job.applyUrl=nativeApply.replace('https:','http:')}],
  ['nondefault-port detail apply',model=>{model.job.applyUrl=nativeApply.replace('careers.example.test','careers.example.test:444')}],
  ['relative detail apply',model=>{model.job.applyUrl=new URL(nativeApply).pathname}],
  ['encoded-path detail apply',model=>{model.job.applyUrl=nativeApply.replace('/apply','/%61pply')}],
  ['trailing slash detail apply',model=>{model.job.applyUrl=nativeApply+'/'}],
  ['nonnull empty native listing apply',model=>{model.listing.applyUrl=''}],
  ['explicit null native listing apply',model=>{model.listing.applyUrl=null}],
  ['explicit listing role URL conflicts with detail apply',model=>{model.listing.applyUrl=roleUrl}],
  ['explicit listing apply conflicts with detail role URL',model=>{model.listing.applyUrl=nativeApply;model.job.applyUrl=roleUrl}],
  ['malformed detail apply type',model=>{model.job.applyUrl=[nativeApply]}],
])test('observed-apply exception stays closed for '+name,async()=>{
  const model=fixture();change(model);const job=await run(model)
  assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailFailureKind,'identity-mismatch');assert.equal(job.jobDescription,null)
})
