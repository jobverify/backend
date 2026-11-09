import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
const{packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz',import.meta.url))))
const fresh=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/revisit-20261103.json.gz',import.meta.url))))
const replay=(drift=false)=>{let reads=0;const first=source.extractIndiaListings(packets[0].body)[11];return{fetchText:async url=>{
 const packet=packets.find(row=>row.url===url);assert.ok(packet,url)
 return url===source.CAREERS_URL&&++reads===2&&drift?packet.body.replaceAll(first.sourceUrl,first.sourceUrl+'changed/'):packet.body
}}}
test('Amicorp checks closing native cards and sitemap while retaining the three semantic or date contradictions',async()=>{
 const jobs=await source.run(replay()),audit=jobs[0].nativeCollectionEvidence
 assert.equal(jobs.length,15);assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.failures.length,3);assert.equal(audit.sourceScopeComplete,false)
})
test('a role removed or renamed at closing is withheld while the other qualified native roles survive',async()=>{
 const jobs=await source.run(replay(true)),audit=jobs[0].nativeCollectionEvidence
 assert.equal(jobs.length,14);assert.equal(audit.closingInventoryMatches,false)
 assert.ok(audit.failures.some(row=>row.failureKind==='native-closing-role-removed-or-changed'))
})
test('fresh public WordPress data distinguishes two formatting-only Senior headings from two semantic Market/Marketing conflicts',()=>{
 const listings=source.extractIndiaListings(fresh.find(row=>row.key==='careers').body)
 for(const row of fresh.filter(row=>row.key.startsWith('rest-')&&row.key!=='rest-7944')){
  const rest=JSON.parse(row.body),html=fresh.find(row=>row.url===rest.link).body,listing=listings.find(row=>row.sourceUrl===rest.link)
  assert.ok(rest.title.rendered&&rest.content.rendered)
  const job=source.extractJobDetail({listing,html})
  if(row.key==='rest-11136'||row.key==='rest-11139'){
    assert.equal(job.sourceDetailComplete,true)
    assert.equal(job.sourceNativeVisibleHeadingFormattingOnly,true)
    assert.match(job.rawNativeRoleEvidence.detailHeading,/Manager, & Digital/)
  }else assert.equal(job.sourceDetailFailureKind,'identity-mismatch')
 }
 const dateRole=fresh.find(row=>row.key==='senior-sales-business-development-jd1345')
 assert.throws(()=>source.extractJobDetail({listing:listings.find(row=>row.sourceUrl===dateRole.url),html:dateRole.body}),error=>error.code==='AMICORP_NATIVE_PUBLICATION_DATE_CONFLICT'&&error.listingDate==='2026-02-05'&&error.detailDate==='2025-02-05')
})
test('formatting tolerance cannot remove an extra Senior heading duty or seniority word',()=>{
 const row=fresh.find(row=>row.key==='senior-manager-digital-insights-analytics-client-data-experience-mumbai-jd')
 const listing=source.extractIndiaListings(fresh.find(row=>row.key==='careers').body).find(item=>item.sourceUrl===row.url)
 const changed=row.body.replace(/(<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/,(_all,start,heading,end)=>start+heading.replace('Data</span>','Data Executive</span>')+end)
 assert.notEqual(changed,row.body)
 const result=source.extractJobDetail({listing,html:changed})
 assert.equal(result.sourceDetailComplete,false)
 assert.equal(result.sourceDetailFailureKind,'identity-mismatch')
})
test('Amicorp caller cancellation settles a public fetch override which ignores its signal',async()=>{
 const controller=new AbortController(),reason=Error('stop Amicorp')
 await assert.rejects(source.run({signal:controller.signal,fetchText:()=>{controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason)
})
