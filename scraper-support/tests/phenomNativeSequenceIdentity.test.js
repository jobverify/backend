import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {run} from '../../scraper/rocketindia/script.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/phenom/rocket-native-sequence-listing.json',import.meta.url),'utf8'))
const html = readFileSync(new URL('./fixtures/phenom/rocket-native-sequence-detail.html',import.meta.url),'utf8')
const page = listing => '<script>phApp.ddo = ' + JSON.stringify({eagerLoadRefineSearch:{status:200,totalHits:1,hits:1,
  data:{jobs:[listing],aggregations:[{field:'country',value:{India:1}}]}}}) + '</script>'
const replay = (detailHtml,listing=fixture.listing) => run({fetchText:async url => {
  if (url.endsWith('/search-results')) return page(listing)
  assert.equal(url,fixture.nativeDetailURL)
  return detailHtml
}})

test('exact current native Rocket sequence corroborates the canonical while public identity remains stable',async () => {
  const jobs = await replay(html)
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].jobId,fixture.listing.jobId)
  assert.equal(jobs[0].requisitionId,fixture.listing.reqId)
  assert.equal(jobs[0].title,fixture.listing.title)
  assert.equal(jobs[0].sourceUrl,fixture.nativeDetailURL)
  assert.equal(jobs[0].applyUrl,fixture.listing.applyUrl)
  assert.equal(jobs[0].country,'India')
  assert.ok(jobs[0].jobDescription.length>2500)
})

test('a detail cannot change its native sequence even when canonical uses the expected requisition',async () => {
  const altered = html.replaceAll('"jobSeqNo":"'+fixture.listing.jobSeqNo+'"','"jobSeqNo":"wrong-native-sequence"')
    .replaceAll('/job/'+fixture.listing.jobSeqNo+'/','/job/'+fixture.listing.reqId+'/')
  const jobs = await replay(altered)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].sourceDetailFailureKind,'identity-mismatch')
})

test('an uncorroborated listing sequence cannot authenticate a different native canonical',async () => {
  const jobs = await replay(html,{...fixture.listing,jobSeqNo:'wrong-listing-sequence'})
  assert.equal(jobs[0].sourceDetailComplete,false)
})

test('the canonical sequence cannot override a conflicting native requisition',async () => {
  const jobs = await replay(html.replaceAll('"reqId":"'+fixture.listing.reqId+'"','"reqId":"wrong-requisition"'))
  assert.equal(jobs[0].sourceDetailComplete,false)
})

test('a different canonical sequence remains blocked behind matching native role identities',async () => {
  const jobs = await replay(html.replaceAll('/job/'+fixture.listing.jobSeqNo+'/','/job/wrong-canonical/'))
  assert.equal(jobs[0].sourceDetailComplete,false)
})

const alternate = JSON.parse(readFileSync(new URL('./fixtures/phenom/rocket-alternate-full-location-listing.json',import.meta.url),'utf8'))
const alternateHtml = readFileSync(new URL('./fixtures/phenom/rocket-alternate-full-location-detail.html',import.meta.url),'utf8')
const replayAlternate = detailHtml => run({fetchText:async url => url.endsWith('/search-results') ? page(alternate.listing) : detailHtml})
const replaceNative = (html,oldValue,newValue) => {
  const escaped = oldValue.replace(/[^\x00-\x7f]/g,char=>'\\u'+char.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'))
  return html.replaceAll(oldValue,newValue).replaceAll(escaped,newValue)
}

test('current native full cityStateCountry corroborates matching short location and retains misleading ML evidence',async () => {
  const jobs = await replayAlternate(alternateHtml)
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].country,'India')
  assert.ok(jobs[0].jobDescription.length>3000)
  assert.equal(jobs[0].sourceNativeCountryEvidence.country,'India')
  assert.equal(jobs[0].sourceNativeCountryEvidence.standardisedCountry,'India')
  assert.equal(jobs[0].sourceNativeCountryEvidence.ml_country,'Nepal')
  assert.equal(jobs[0].sourceNativeCountryEvidence.derivedCountryConflict,true)
})

for (const [name,alter] of [
  ['different short city',html => replaceNative(replaceNative(html,'"location":"Chennai, Tamil Nādu"','"location":"Pune, Maharashtra"'),
    '"location":"Bangaluru, Karnātaka"','"location":"Pune, Maharashtra"')],
  ['different explicit city',html => html.replaceAll('"city":"Chennai"','"city":"Pune"').replaceAll('"city":"Bangaluru"','"city":"Pune"')],
  ['foreign short suffix',html => replaceNative(replaceNative(html,'"location":"Chennai, Tamil Nādu"','"location":"Chennai, Tamil Nadu, United States"'),
    '"location":"Bangaluru, Karnātaka"','"location":"Bangaluru, Karnataka, United States"')],
  ['foreign explicit office country',html => html.replaceAll('"country":"India"','"country":"United States"')],
  ['unresolved full label',html => replaceNative(replaceNative(html,'"cityStateCountry":"Chennai, Tamil Nādu, India"','"cityStateCountry":"Chennai, Unspecified Office"'),
    '"cityStateCountry":"Bangaluru, Karnātaka, India"','"cityStateCountry":"Bangaluru, Unspecified Office"')],
  ['conflicting JSON-LD country',html => html.replaceAll('"addressCountry":"India"','"addressCountry":"United States"')],
]) test('alternate native full location rejects '+name,async () => {
  const changed = alter(alternateHtml)
  assert.notEqual(changed,alternateHtml,'negative fixture must alter actual native fields')
  const jobs = await replayAlternate(changed)
  assert.equal(jobs[0].sourceDetailComplete,false)
})

test('absent optional JobPosting does not contradict fully corroborated native India offices',async () => {
  const current = JSON.parse(readFileSync(new URL('./fixtures/phenom/rocket-optional-jsonld-listing.json',import.meta.url),'utf8'))
  const currentHtml = readFileSync(new URL('./fixtures/phenom/rocket-optional-jsonld-detail.html',import.meta.url),'utf8')
  assert.ok(!currentHtml.includes('"@type":"JobPosting"'))
  const jobs = await run({fetchText:async url=>url.endsWith('/search-results')?page(current.listing):currentHtml})
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].country,'India')
  assert.equal(jobs[0].sourceNativeCountryEvidence.ml_country,'Nepal')
  assert.ok(jobs[0].jobDescription.length>3000)
})

test('derived-country override requires every explicit office country to agree',async () => {
  const changed = alternateHtml.replace('"multi_location":[{"country":"India"','"multi_location":[{"country":"United States"')
  assert.notEqual(changed,alternateHtml)
  const jobs = await replayAlternate(changed)
  assert.equal(jobs[0].sourceDetailComplete,false)
})

test('derived-country override requires every explicit office city to agree',async () => {
  const changed = alternateHtml.replace('"locationName":"Chennai, TN","city":"Chennai"','"locationName":"Chennai, TN","city":"Pune"')
  assert.notEqual(changed,alternateHtml)
  const jobs = await replayAlternate(changed)
  assert.equal(jobs[0].sourceDetailComplete,false)
})

const mutateNativeJob = change => {
  const assignment = /phApp\.ddo\s*=\s*/.exec(alternateHtml), start = assignment.index + assignment[0].length
  let depth=0,quoted=false,escaped=false,end
  for(let index=start;index<alternateHtml.length;index++) {
    const char=alternateHtml[index]
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false}
    else if(char==='"')quoted=true
    else if(char==='{')depth++
    else if(char==='}'&&--depth===0){end=index+1;break}
  }
  const model=JSON.parse(alternateHtml.slice(start,end))
  change(model.jobDetail.data.job)
  return alternateHtml.slice(0,start)+JSON.stringify(model).replaceAll('<','\\u003c')+alternateHtml.slice(end)
}
for(const [name,change] of [
  ['one contradictory state',job=>{job.multi_location[0].state='California'}],
  ['one malformed state',job=>{job.multi_location[0].state=['California']}],
  ['one contradictory cityState',job=>{job.multi_location[0].cityState='Seattle, Washington'}],
  ['one contradictory stateCountry',job=>{job.multi_location[0].stateCountry='Washington, United States'}],
  ['one contradictory cityCountry',job=>{job.multi_location[0].cityCountry='Seattle, India'}],
  ['changed primary country while ML agrees',job=>{job.country='Nepal'}],
  ['changed primary and standardised countries while ML agrees',job=>{job.country='Nepal';job.standardisedCountry='Nepal'}],
]) test('native country consistency rejects '+name+' even when another India office remains valid',async () => {
  const jobs=await replayAlternate(mutateNativeJob(change))
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].sourceDetailFailureKind,'identity-mismatch')
})
