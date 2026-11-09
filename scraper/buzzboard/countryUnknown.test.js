import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {extractOfficialOpenings,extractJobDetail,run,CAREERS_URL,BOARD_URL} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/retained-http-20261029.json.gz',import.meta.url))))
const bytes=Buffer.from(fixture.bodyBase64,'base64'),html=bytes.toString('utf8')
assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.receipt.sha256)
const ids=['jfH34UBrb2','KHFbeOLhcc','zmoxkkH0MB','zZ5VZq3ojD','12dkkTUOj7','7Dbt9Ma4oG']

test('actual six Remote career observations preserve unknown country without a fabricated India location',()=>{
 assert.equal(/\bIndia\b/i.test(html),false,'CSS indian-rupee icon names are not a country label')
 const rows=extractOfficialOpenings(html)
 assert.deepEqual(rows.map(row=>row.jobId),ids)
 for(const row of rows){assert.equal(row.location,'Remote');assert.ok(Object.hasOwn(row,'country'));assert.equal(row.country,null);assert.equal(row.city,null);assert.equal(row.postingDate,null);assert.equal(row.jobDescription,null)}
})

test('registered actual careers-only replay audits six unknown observations before native board failure',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='buzzboard');assert.equal(provider.adapter,'script')
 const calls=[],audits=[],failure=Error('No authentic native board response retained')
 await assert.rejects(createCatalogScraper(provider).run({fetchText:async url=>{calls.push(url);if(url===CAREERS_URL)return html;assert.equal(url,BOARD_URL);throw failure},onAudit:audit=>audits.push(audit)}),error=>error===failure)
 assert.deepEqual(calls,[CAREERS_URL,BOARD_URL]);assert.ok(audits.length>=1)
 const audit=audits.at(-1)
 assert.equal(audit.originalCareersHTML,html);assert.equal(audit.observations.length,6)
 assert.deepEqual(audit.unknownCountryRoleIds,ids);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.authoritativeSourceTotal,null);assert.equal(audit.authoritativeIndiaFacetCount,null)
 assert.equal(audit.noNativeDetailProof,true)
 for(const row of audit.observations){assert.equal(row.country,null);assert.equal(row.location,'Remote')}
})

const card=(id,title,location)=>`<article><h3>${title}</h3><p>${location}</p><a href="https://buzzboard.applytojob.com/apply/jobs/details/${id}?&">Apply</a></article>`
// These constructed adversarial snippets are NOT positive native source proof.
for(const location of ['Remote','Remote, United States','Hyderabad','Bengaluru','Current CTC?','Notice Period?'])test('no inferred India from role label '+location,()=>{
 const rows=extractOfficialOpenings(card('CASE123','Actual title',location))
 assert.equal(rows.length,1);assert.notEqual(rows[0].country,'India');assert.doesNotMatch(rows[0].location||'',/India/)
})

test('per-role contexts cannot borrow India from corporate HQ or another role',()=>{
 const document='<section><p>Headquarters: Hyderabad, India</p>'+card('ONE123','Role one','Remote')+card('TWO123','Role two','Hyderabad')+card('THREE123','Role three','Remote, India')+'</section>'
 const rows=extractOfficialOpenings(document)
 assert.equal(rows.length,3);assert.equal(rows[0].country,null);assert.equal(rows[1].country,null)
 assert.equal(rows[2].country,'India','Explicit role-owned India label is distinct from country defaults; constructed test only')
})

test('CTC/notice-period/HQ questions in detail cannot establish an India country',()=>{
 const detail='<main><h2>BuzzBoard</h2><h1>Actual title</h1><p>Headquarters in India</p><p>Job Description: Build source systems.</p><p>Current Annual CTC?</p><p>Expected CTC?</p><p>Notice Period?</p><p>Apply for this position</p><p>Powered by JazzHR</p></main>'
 const row={title:'Actual title',location:'Remote',city:null,country:null,sourceUrl:'https://buzzboard.applytojob.com/apply/CASE123/title'}
 const job=extractJobDetail(detail,row)
 assert.equal(job.country,null);assert.equal(job.location,'Remote')
 assert.equal(job.sourceNativeDetailHTML,detail,'All constructed application questions retained as raw observations, not inferred requirements')
})

test('already-aborted caller cannot perform even careers transport',async()=>{
 const c=new AbortController(),reason=Error('Stop BuzzBoard');c.abort(reason);let calls=0
 await assert.rejects(run({signal:c.signal,fetchText:async()=>{calls++;return html}}),error=>error===reason)
 assert.equal(calls,0)
})

test('audit cancellation cannot be swallowed into continued board/detail requests',async()=>{
 const c=new AbortController(),reason=Error('Stop audit');let calls=0
 await assert.rejects(run({signal:c.signal,fetchText:async url=>{calls++;assert.equal(url,CAREERS_URL);return html},onAudit:()=>c.abort(reason)}),error=>error===reason)
 assert.equal(calls,1)
})

// Counterfactual location-only mutations of the authentic six-card page; not live evidence.
for(const label of ['Remote, outside India','Remote, not India','Remote, anywhere except India'])test('exclusion label stays unknown in extraction and registered audit: '+label,async()=>{
 const changed=html.replaceAll('Remote \u00b7 Full Time',label+' \u00b7 Full Time')
 assert.notEqual(changed,html)
 const rows=extractOfficialOpenings(changed)
 assert.equal(rows.length,6)
 for(const row of rows){assert.equal(row.country,null);assert.equal(row.location,label);assert.equal(row.sourceNativeLocationLine,label+' \u00b7 Full Time')}
 const audits=[],failure=Error('No authentic native board retained')
 const provider=getScraperCatalog().find(row=>row.source==='buzzboard')
 await assert.rejects(createCatalogScraper(provider).run({fetchText:async url=>{if(url===CAREERS_URL)return changed;assert.equal(url,BOARD_URL);throw failure},onAudit:audit=>audits.push(audit)}),error=>error===failure)
 assert.deepEqual(audits.at(-1).unknownCountryRoleIds,ids)
 assert.ok(audits.at(-1).observations.every(row=>row.country===null&&row.location===label))
})
