import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as scraper from '../../scraper/avendata/script.js'
const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/avendata/test-data/native-20261103.json.gz',import.meta.url))))
const careers=captures.find(row=>row.requestedUrl===scraper.CAREERS_URL).html
const page=async url=>{const row=captures.findLast(row=>row.requestedUrl===url);assert.ok(row,'unexpected public request '+url);return {status:row.status,url:row.finalUrl,html:row.html,text:row.html}}
const run=options=>scraper.createAvenDataScraper().run({fetchPage:page,...options})

test('AvenDATA exports the current first-party hiring entry without a static verified inventory date',()=>{
 assert.equal(scraper.SOURCE,"avendata")
 assert.equal(scraper.COMPANY,"AvenDATA")
 assert.equal(scraper.COMPANY_DOMAIN,"avendata.com")
 assert.equal(scraper.VERIFIED_AT,null)
 assert.equal(scraper.hasOfficialCareersSignal(careers),true)
 assert.equal(scraper.pageExposesPublicJobListings(careers),false)
})

test('AvenDATA public discovery helpers distinguish active ATS/structured candidates from commented and unrevealed markup',()=>{
 const active='<a href="https://job-boards.greenhouse.io/current-employer/jobs/12345">Native role details</a>'
 assert.equal(scraper.pageExposesPublicJobListings(careers+active),true)
 assert.ok(scraper.extractPublicJobLinks(careers+active).includes('https://job-boards.greenhouse.io/current-employer/jobs/12345'))
 assert.equal(scraper.pageExposesPublicJobListings(careers+'<!-- '+active+' --><template>'+active+'</template><div hidden>'+active+'</div>'),false)
 assert.equal(scraper.pageExposesPublicJobListings(careers+'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Unreviewed role'})+'</script>'),true)
})

test('AvenDATA rejects a same-origin soft404 or unrelated employer page before reporting hiring observations',async()=>{
 await assert.rejects(run({fetchPage:async url=>{
  const value=await page(url)
  if(url!==scraper.CAREERS_URL)return value
  const html='<html><body><h1>Careers at Unrelated Employer</h1></body></html>'
  return {...value,html,text:html}
 }}),/official careers identity/i)
})

test('AvenDATA does not reinterpret clock failures as an unavailable upstream or an empty inventory',async()=>{
 const reason={opaque:'native observation clock failed'};let calls=0
 await assert.rejects(run({now:()=>{throw reason},onAudit:()=>{calls++}}),error=>error===reason)
 assert.equal(calls,0)
})
