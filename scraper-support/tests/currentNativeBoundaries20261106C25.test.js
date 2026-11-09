import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parseExpressionAt} from 'acorn'
import * as detect from '../../scraper/detecttechnologies/script.js'
import * as e2logy from '../../scraper/e2logysoftwaresolutions/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C25/capture.json.gz',import.meta.url))))
const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/currentNative20261106C25/description-expectations.json',import.meta.url)))
const index='https://detecttechnologies.com/current-openings',corporate='https://e2logy.com/careers'
const detectRows=detect.extractSearchResults(fixture.documents[index].body),e2Rows=e2logy.extractListings(fixture.documents[corporate].body)
const onlyText=value=>value.replace(/\s/g,''),sha=value=>createHash('sha256').update(value).digest('hex')
const page=async url=>{const item=fixture.documents[url];assert.ok(item,'Only declared fixture URLs');return {status:item.status,url:item.finalUrl,headers:item.headers,body:item.body,bodyUnavailable:item.bodyUnavailable}}
const changedRecord=(html,mutate)=>{
 const marker=html.indexOf('var jobs = JSON.parse(');assert.ok(marker>0)
 const start=html.indexOf('(',marker)+1,literal=parseExpressionAt(html,start,{ecmaVersion:'latest'})
 assert.equal(literal.type,'Literal');assert.equal(typeof literal.value,'string')
 const data=JSON.parse(literal.value);assert.equal(data.length,1);mutate(data[0])
 const changed=html.slice(0,literal.start)+JSON.stringify(JSON.stringify(data))+html.slice(literal.end)
 assert.notEqual(changed,html);return changed
}
const separateScript=(html,program,{beforeData=false}={})=>{
 const at=beforeData?html.indexOf('<head>')+'<head>'.length:html.lastIndexOf('</head>')
 assert.ok(at>0)
 if(!beforeData)assert.ok(at>html.indexOf('var jobs = JSON.parse('),'The mutation executes after the native data declaration')
 const changed=html.slice(0,at)+'<script>'+program+'</script>'+html.slice(at)
 assert.ok(changed!==html);return changed
}
test('all nine Detect role descriptions preserve every original richtext block and native publication date',()=>{
 for(const listing of detectRows){
  const job=detect.extractJobDetail(fixture.documents[listing.sourceUrl].body,listing),wanted=expected.detect[listing.sourceUrl]
  assert.equal(onlyText(job.jobDescription),wanted.completeDescriptionWithoutWhitespace)
  assert.equal(job.sourceNativeRoleEvidence.nativeDescriptionBlocks,wanted.criteriaBlocks)
  assert.equal(job.postingDate,wanted.nativeDatePosted);assert.equal(job.requisitionId,null);assert.equal(job.closingDate,null)
 }
 assert.equal(detectRows.filter(row=>row.country===null).length,8)
 assert.equal(detectRows.find(row=>row.title.endsWith(' India')).country,null,'Country in the role title does not establish workplace country')
 assert.equal(detectRows.find(row=>row.location==='Houston, Texas').country,null,'A city/state pair does not establish country')
})
test('both E2logy full criteria match the independent Python escape decoder and HTML parser',()=>{
 for(const listing of e2Rows){
  const job=e2logy.extractJobDetail(fixture.documents[listing.sourceUrl].body,listing),wanted=expected.e2logy[job.jobId]
  assert.equal(onlyText(job.jobDescription),wanted.completeDescriptionWithoutWhitespace)
  assert.equal(sha(job.sourceDescriptionHTML),wanted.originalHTMLSHA256)
  assert.equal(job.nativeDateOpened,wanted.nativeDateOpened);assert.equal(job.postingDate,null);assert.equal(job.requisitionId,null)
 }
})
test('Detect rejects a hidden additional native card rather than silently dropping it from observed inventory',()=>{
 const html=fixture.documents[index].body,cardStart=html.indexOf('<div class="job-listing-card"')
 assert.ok(cardStart>0)
 const changed=html.slice(0,cardStart)+html.slice(cardStart).replace('<div class="job-listing-card"','<div hidden class="job-listing-card"')
 assert.notEqual(changed,html)
 assert.throws(()=>detect.extractSearchResults(changed),/native.*(?:Hidden|scope|card)/i)
})
test('Detect rejects missing full native criteria hidden inside a surviving richtext block',()=>{
 const listing=detectRows.find(row=>row.title==='QA Engineer 3'),html=fixture.documents[listing.sourceUrl].body
 const scope=html.indexOf('class="job-rtf w-richtext"'),target=html.indexOf('JMeter',scope)
 assert.ok(scope>0&&target>scope,'The mutation must target an actual native criteria word')
 assert.ok(detect.extractJobDetail(html,listing).jobDescription.includes('JMeter'))
 const changed=html.slice(0,target)+'<span hidden>JMeter</span>'+html.slice(target+'JMeter'.length)
 assert.throws(()=>detect.extractJobDetail(changed,listing),/native.*(?:criteria|hidden|incomplete)/i)
})
test('Detect cannot qualify a different structured hiring organization under its current branded title',()=>{
 const listing=detectRows[0],html=fixture.documents[listing.sourceUrl].body
 const matches=[...html.matchAll(/"name"\s*:\s*"Detect Technologies"/g)];assert.equal(matches.length,1)
 const changed=html.replace(/"name"\s*:\s*"Detect Technologies"/,'"name":"Different Company"');assert.ok(changed!==html)
 assert.throws(()=>detect.extractJobDetail(changed,listing),/native.*hiring organization/i)
})
test('Detect rejects a conflicting native Webflow item slug despite unchanged canonical and visible title',()=>{
 const listing=detectRows[0],html=fixture.documents[listing.sourceUrl].body
 const token='data-wf-item-slug="'+listing.jobId+'"';assert.equal(html.split(token).length,2)
 assert.equal(detect.extractJobDetail(html,listing).jobId,listing.jobId)
 const changed=html.replace(token,'data-wf-item-slug="different-native-role"')
 assert.throws(()=>detect.extractJobDetail(changed,listing),/native.*(?:slug|item|identity)/i)
})
for(const notice of ['This job is no longer available.','This position has been filled.']){
 test('Detect rejects an explicit visible closed-role notice: '+notice,()=>{
  const listing=detectRows[0],html=fixture.documents[listing.sourceUrl].body,headings=[...html.matchAll(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi)]
  assert.equal(headings.length,1)
  const heading=headings[0],at=heading.index+heading[0].length
  assert.ok(heading.index>html.indexOf('class="job-grid"'))
  const changed=html.slice(0,at)+'<p role="status">'+notice+'</p>'+html.slice(at)
  assert.equal(changed.replace('<p role="status">'+notice+'</p>',''),html)
  assert.throws(()=>detect.extractJobDetail(changed,listing),/native.*closed/i)
 })
}
test('Detect closes full criteria, not only role IDs or short structured summaries',async()=>{
 const listing=detectRows[0],html=fixture.documents[listing.sourceUrl].body
 const changed=html.replace('dynamic Account Partner','experienced Account Partner');assert.notEqual(changed,html)
 assert.notEqual(detect.extractJobDetail(changed,listing).jobDescription,detect.extractJobDetail(html,listing).jobDescription)
 let hits=0
 await assert.rejects(detect.run({fetchPage:async url=>{
  const original=await page(url)
  return url===listing.sourceUrl&&++hits===2?{...original,body:changed}:original
 }}),/Closing native role criteria/i)
 assert.equal(hits,2)
})
test('E2logy rejects a native job ID that differs from its literal corporate link',()=>{
 const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body
 const changed=changedRecord(html,row=>{row.id='424443000011620017'})
 assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*ID\/title/i)
})
test('E2logy does not coerce a foreign native workplace back into the India corporate card',()=>{
 const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body
 const changed=changedRecord(html,row=>{row.Country='United States'})
 assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*metadata conflict/i)
})
for(const [field,value] of [['Publish',false],['Is_Locked',true]]){
 test('E2logy refuses native inactive/locked state: '+field,()=>{
  const listing=e2Rows[0],changed=changedRecord(fixture.documents[listing.sourceUrl].body,row=>{row[field]=value})
  assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*unpublished or locked/i)
 })
}
test('E2logy rejects partial hidden content in the native encoded criteria record',()=>{
 const listing=e2Rows[0],changed=changedRecord(fixture.documents[listing.sourceUrl].body,row=>{
  assert.ok(row.Job_Description.includes('Drupal'));row.Job_Description=row.Job_Description.replace('Drupal','<span hidden>Drupal</span>')
 })
 assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*criteria content.*hidden/i)
})
test('E2logy retains first document identity despite the reviewed empty stylesheet wrapper head',()=>{
 const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body
 const changed=html.replace('<head>','<head><link rel="canonical" href="https://unrelated.invalid/">');assert.notEqual(changed,html)
 assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*canonical/i)
})
test('E2logy rejects a base declaration in object fallback before accepting native role metadata',()=>{
 const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body
 const changed=html.replace('<head>','<head><object><base href="https://unrelated.invalid/"></object>');assert.notEqual(changed,html)
 assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*base/i)
})
test('E2logy cannot trust original native values after a separate executable script overwrites them',()=>{
 const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body
 assert.equal(e2logy.extractJobDetail(html,listing).jobId,listing.jobId)
 const changed=separateScript(html,'jobs[0].Country="United States";')
 assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*(?:reassign|override|carrier|authority|job data)/i)
})
for(const program of ['window.jobs[0].Country="United States";',
 'meta.org_info.company_name="Different Company";',
 'var JSON={parse(){return []}};',
 'var jobs; jobs[0].Country="United States";']){
 test('E2logy rejects a separate executable script overriding native authority: '+program,()=>{
  const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body
  assert.equal(e2logy.extractJobDetail(html,listing).jobId,listing.jobId)
  const changed=separateScript(html,program,{beforeData:program.startsWith('var JSON=')})
  assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*(?:reassign|override|carrier|authority|job data)/i)
 })
}
for(const program of [String.raw`j\u006fbs[0].Publish=false;`,
 String.raw`m\u0065ta.org_info.company_name="Different Company";`,
 'const selectedNativeRole=jobs[0]; selectedNativeRole.Publish=false;',
 'Reflect.set(jobs[0],"Publish",false);',
 'eval("jobs[0].Publish=false;");',
 'window["jo"+"bs"][0].Publish=false;']){
 test('E2logy inline profile rejects unreviewed executable authority: '+program,()=>{
  const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body
  assert.equal(e2logy.extractJobDetail(html,listing).sourceNativeJobRecord.Publish,true)
  assert.throws(()=>e2logy.extractJobDetail(separateScript(html,program),listing),/native.*(?:authority|reassign|override|mutat)/i)
 })
}
test('E2logy inline profile rejects an alias mutation added inside the original carrier',()=>{
 const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body
 const start=html.indexOf('var jobs = JSON.parse('),end=html.indexOf('</script>',start)
 assert.ok(start>0&&end>start)
 const changed=html.slice(0,end)+'\nconst selectedNativeRole=jobs[0]; selectedNativeRole.Publish=false;\n'+html.slice(end)
 assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*(?:authority|reassign|override|mutat)/i)
})
test('E2logy inline profile rejects a changed external program declaration without reading that program',()=>{
 const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body,match=/<script\b[^>]*\bsrc="([^"]+)"/i.exec(html)
 assert.ok(match)
 const at=match.index+match[0].lastIndexOf(match[1]),changed=html.slice(0,at)+'https://unreviewed.invalid/program.js'+html.slice(at+match[1].length)
 assert.notEqual(changed,html)
 assert.throws(()=>e2logy.extractJobDetail(changed,listing),/native.*(?:authority|program|declaration)/i)
})
test('E2logy inline profile permits request-specific literal token changes without using the token',()=>{
 const listing=e2Rows[0],html=fixture.documents[listing.sourceUrl].body,marker=html.indexOf('csrfToken = ')
 assert.ok(marker>0)
 const start=marker+'csrfToken = '.length,value=parseExpressionAt(html,start,{ecmaVersion:'latest'})
 assert.equal(value.type,'Literal');assert.equal(typeof value.value,'string')
 const changed=html.slice(0,value.start)+JSON.stringify('synthetic-unused-request-token')+html.slice(value.end)
 const original=e2logy.extractJobDetail(html,listing),job=e2logy.extractJobDetail(changed,listing)
 assert.deepEqual(job,original)
 assert.equal(JSON.stringify(job).includes('synthetic-unused-request-token'),false)
})
test('E2logy current collection uses only literal role GETs with genuine full closing reads',async()=>{
 const requested=[],jobs=await e2logy.run({fetchPage:async(url,options)=>{requested.push({url,method:options.method});return page(url)}})
 assert.deepEqual(requested.map(row=>row.url),[corporate,...e2Rows.map(row=>row.sourceUrl),...e2Rows.map(row=>row.sourceUrl),corporate])
 assert.ok(requested.every(row=>row.method==='GET'));assert.equal(jobs.length,2)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,2)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch,true)
})
test('both current collectors preserve an exact pre-aborted caller reason with zero acquisition',async()=>{
 for(const module of [detect,e2logy]){
  const controller=new AbortController(),reason={message:'exact caller reason'};controller.abort(reason);let reads=0
  await assert.rejects(async()=>module.run({signal:controller.signal,fetchPage:async()=>{reads++;throw Error('not reached')}}),error=>error===reason)
  assert.equal(reads,0)
 }
})
test('output limits preserve complete observed cohorts and never authorize company cleanup',async()=>{
 for(const [module,observed,unknown] of [[detect,9,8],[e2logy,2,0]]){
  const jobs=await module.run({maxJobs:1,fetchPage:page});assert.equal(jobs.length,1)
  assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,observed)
  assert.equal(jobs.nativeCollectionEvidence.unknownCountryCount,unknown)
  assert.equal(jobs.nativeCollectionEvidence.sourceExplicitOutputLimit,1)
  assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 }
})
