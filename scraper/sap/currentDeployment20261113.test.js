import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractSearchResults,extractJobDetail,run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const html=gunzipSync(readFileSync(new URL('./fixtures/search-20261113.html.gz',import.meta.url))).toString()
const full=gunzipSync(readFileSync(new URL('./fixtures/multilocation-detail-20261113.html.gz',import.meta.url))).toString()
const row=[...html.matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/gi)].find(m=>m[1].includes('/1403950833/'))[0]
const page='<title>India - SAP Jobs</title><link rel="canonical" href="https://careers.sap.com/search/"/><div id="searchresults">Results <b>1 - 1</b> of <b>1</b><table>'+row+'</table></div>'

test('SAP current listing separates explicit India from its additional-location display count',()=>{
 const listing=extractSearchResults(html).find(j=>j.jobId==='1403950833')
 assert.equal(listing.country,'India')
 assert.equal(listing.location,'Gurgaon, India')
 assert.equal(listing.city,'Gurgaon')
 assert.match(listing.rawLocation,/\+1 more/)
 const role=extractJobDetail(full,listing)
 assert.equal(role.country,'India')
 assert.equal(role.city,'Gurgaon')
 assert.ok(role.jobDescription.length>1000)
})

test('SAP additional-location marker preserves native detail reconciliation and incomplete company scope',async()=>{
 const jobs=await run({fetchPage:async url=>({status:200,url,html:url.includes('/search/')?page:full})})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.ok(jobs[0].jobDescription.length>1000)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const conflicting of ['Gurgaon, IN, United States','Gurgaon, US, India'])test('SAP additional-location marker cannot hide '+conflicting,async()=>{
 await assert.rejects(run({fetchPage:async url=>({status:200,url,html:page.replaceAll('Gurgaon, IN, 122002',conflicting)})}),/explicit India/)
})
