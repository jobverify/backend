import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createPhenomScraper} from '../phenom/engine.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'

const capture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/lowesindia/native-office-20261029.json.gz',import.meta.url))))
const factory=extra=>createPhenomScraper({companyName:'Lowes India',source:'lowesindia',baseUrl:'https://talent.lowes.com',
  searchPath:'/in/en/search-results',useJobSequenceForDetailUrl:true,
  numberedOfficeLocations:{idPrefix:'LWS',namePrefix:'LWS_IND_'},...extra})
const listingHtml=listing=>'<script>phApp.ddo = '+JSON.stringify({eagerLoadRefineSearch:{status:200,totalHits:1,hits:1,
  data:{jobs:[listing],aggregations:[]}}})+'</script>'
const detailHtml=sample=>'<link rel="canonical" href="'+sample.canonicalUrl+'">'
  +'<script type="application/ld+json">'+JSON.stringify(sample.posting)+'</script>'
  +'<script>phApp.ddo = '+JSON.stringify({jobDetail:{status:200,data:{job:sample.detail}}})+'</script>'
const replay=async(sample,options={})=>{
  const scraper=factory(options)
  return scraper.run({detailEnrichmentBudgetMs:1000,fetchText:async url=>url.includes('/search-results')
    ?listingHtml(sample.listing):detailHtml(sample)})
}

test('current Lowes advertised native sequence supplies the reachable role URL',()=>{
  const sample=capture()
  assert.equal(factory().buildJobDetailUrl(sample.listing),sample.response.url)
  assert.match(factory({useJobSequenceForDetailUrl:false}).buildJobDetailUrl(sample.listing),/\/job\/JR-02615382\//)
  assert.throws(()=>factory().buildJobDetailUrl({...sample.listing,jobSeqNo:'../other-host'}),/invalid native detail URL/)
})

test('captured Lowes numbered office identity recovers its exact native employer description',async()=>{
  const sample=capture(),[job]=await replay(sample)
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(hasSourceDescription(job),true)
  assert.match(job.jobDescription,/SOX/)
  assert.equal(job.jobId,sample.listing.jobId)
  assert.equal(job.title,sample.listing.title)
  assert.equal(job.country,'India')
  assert.equal(job.sourceUrl,sample.response.url)
  const [withoutSourceFormat]=await replay(sample,{numberedOfficeLocations:null})
  assert.equal(withoutSourceFormat.sourceDetailComplete,false)
})

test('Lowes named building format still requires matching native office ID, country and full city region',async()=>{
  const sample=capture(),office=sample.detail.multi_location[0]
  Object.assign(office,{location:'D3 Blue Tech 4120',locationId:'LWS4120',locationName:'LWS_IND_D3 Blue Tech 4120'})
  const options={numberedOfficeLocations:{idPrefix:'LWS',namePrefix:'LWS_IND_',buildingLabels:['D3 Blue Tech']}}
  assert.equal((await replay(sample,options))[0].sourceDetailComplete,true)
  assert.equal((await replay(sample))[0].sourceDetailComplete,false)
  office.country='United States'
  assert.equal((await replay(sample,options))[0].sourceDetailComplete,false)
})

for(const [label,change] of [
  ['native office number',sample=>{sample.detail.multi_location[0].locationId='LWS9999'}],
  ['native office name',sample=>{sample.detail.multi_location[0].locationName='Another office'}],
  ['city',sample=>{sample.detail.multi_location[0].city='Delhi'}],
  ['country',sample=>{sample.detail.multi_location[0].country='United States'}],
  ['native role',sample=>{sample.detail.reqId='JR-OTHER'}],
  ['native sequence',sample=>{sample.detail.jobSeqNo='LOWEUSOTHER'}],
])test('Lowes rejects a conflict in '+label,async()=>{
  const sample=capture();change(sample)
  const [job]=await replay(sample)
  assert.equal(job.sourceDetailComplete,false)
  assert.equal(hasSourceDescription(job),false)
})
