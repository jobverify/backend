import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { createSybroxScraper } from '../../scraper/sybrox/script.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../utils/inventoryEvidence.js'
const root = new URL('./fixtures/sybrox-division/', import.meta.url)
const docs = Object.fromEntries(await Promise.all(['identity','home','careers','roles','it-form','hr-form'].map(async key => [key, await fs.readFile(new URL(key+'.html',root),'utf8')])))
const urls={identity:'https://in.linkedin.com/company/sybroxtech',home:'https://sybroxtech.com/',careers:'https://sybroxtech.com/sybrox%20careers',roles:'https://sybroxtech.com/explore%20sybrox','it-form':'https://forms.gle/zifYrSZj4MA1utAq8','hr-form':'https://forms.gle/ZBGy9QEpq4xupnQC6'}
const finals={'it-form':'https://docs.google.com/forms/d/e/1FAIpQLSeI7odXNq0XKmpS3W13m4r5haEnszJuKeQDV8WUtgshlY3hbw/viewform?usp=send_form','hr-form':'https://docs.google.com/forms/d/e/1FAIpQLSdBPQgCCmUtHe9PHqpmz0J9Ed-PlgPQC7lGJn7zPjVvWedBVQ/viewform?usp=send_form'}
const exercise=async({changes={},override,signal,maxJobs}={})=>createSybroxScraper({maxJobs}).run({signal,now:()=> '2026-10-09T00:40:00.000Z',fetchPage:async(url,options={})=>{const key=Object.keys(urls).find(k=>urls[k]===url);assert.ok(key,'Only observed current authority: '+url);const result={status:key.endsWith('form')?401:200,url:finals[key]||url,html:changes[key]??docs[key]};return (await override?.(key,result,options))??result}})
test('Sybrox recovers twelve employer-owned Chennai roles from its verified technology division and excludes RPO clients',async()=>{
 const jobs=await exercise();assert.equal(jobs.length,12);assert.deepEqual(jobs.slice(0,2).map(j=>j.jobId),['STIT-FDWD-001','STIT-BD-001']);assert.equal(jobs[0].title,'Frontend Application Developer');assert.equal(jobs[0].company,'Sybrox Tech Pvt. Ltd.');assert.equal(jobs[0].location,'Chennai');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].applyUrl,urls['it-form']);assert.equal(jobs[7].applyUrl,urls['hr-form']);assert.ok(jobs.every(j=>j.sourceListingComplete===false&&j.jobDescription.length>=300));
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.match(evidence.reason,/job-specific Chennai/);assert.match(evidence.reason,/applicant sign-in/);assert.equal(isVerifiedEmptyEvidence(evidence),false)
})

for(const [name,changes,pattern] of [
 ['foreign employer-authored handoff',{identity:docs.identity.replaceAll('"name":"Sybrox"','"name":"Unrelated"')},/employer-authored/],
 ['foreign profile canonical',{identity:docs.identity.replace('href="https://in.linkedin.com/company/sybroxtech"','href="https://in.linkedin.com/company/unrelated"')},/profile identity/],
 ['unrelated division relation',{identity:docs.identity.replaceAll('www.sybrox.com','www.unrelated.com')},/employer-authored/],
 ['commented identity publication',{identity:docs.identity.replace(/<script[\s\S]*?<\/script>/g,match=>'<!--'+match+'-->')},/employer-authored/],
 ['commented current careers handoff',{home:docs.home.replace(/<a[^>]*href="Sybrox Careers.html"[^>]*>[\s\S]*?<\/a>/g,match=>'<!--'+match+'-->')},/homepage or careers/],
 ['removed own vacancies handoff',{careers:docs.careers.replaceAll('Explore Sybrox.html','RPO Partner Vacancies.html')},/own careers/],
 ['client inventory instead of own company',{roles:docs.roles.replace('<title>Explore Sybrox</title>','<title>RPO Partner Vacancies</title>')},/own vacancy page/],
 ['duplicate native role identity',{roles:docs.roles.replace('STIT-BD-001','STIT-FDWD-001')},/malformed, duplicate/],
 ['unknown role workplace',{roles:docs.roles.replace('Chennai &nbsp;|','Remote &nbsp;|')},/unscoped/],
 ['mixed foreign role workplace',{roles:docs.roles.replace('Chennai &nbsp;|','Chennai, United States &nbsp;|')},/unscoped/],
 ['foreign explicit detail workplace',{roles:docs.roles.replace('<h4>Job Description</h4>','<p><strong>Location:</strong> Chennai, United States</p><h4>Job Description</h4>')},/conflicting native workplace/],
 ['foreign explicit detail employer',{roles:docs.roles.replace('<h4>Job Description</h4>','<p><strong>Company:</strong> Poonawalla Finance</p><h4>Job Description</h4>')},/conflicting native workplace or employer/],
 ['missing published description',{roles:docs.roles.replace(/(<h4>Job Description<\/h4>)[\s\S]*?(<div class="job-actions">)/,(_m,a,b)=>a+'<p>Unavailable</p>'+b)},/missing native own role/],
 ['missing published apply action',{roles:docs.roles.replace('class="apply-btn"','class="removed-apply"')},/missing native own role/],
 ['RPO client application substituted',{roles:docs.roles.replace('https://forms.gle/zifYrSZj4MA1utAq8','https://forms.gle/o43Zh9YvfH4sRCvo8')},/application/],
 ['closed native form',{'it-form':docs['it-form']+'<p>No longer accepting responses</p>'},/removed, closed/],
 ['removed native form',{'it-form':docs['it-form']+'<p>The form has been deleted</p>'},/removed, closed/],
 ['unrecognized sign-in response',{'it-form':'<html><p>Unauthorized</p></html>'},/not a verified form/],
 ['drifted card container',{roles:docs.roles.replace('class="job-card"','class="removed-card"')},/card structure/],
])test('Sybrox partial own-role path rejects '+name,async()=>await assert.rejects(exercise({changes}),pattern))

test('Sybrox rejects a final authority redirect even when copied valid content is returned',async()=>{await assert.rejects(exercise({override:(key,result)=>key==='home'?{...result,url:'https://unrelated.example/'}:undefined}),/final redirect changed/);await assert.rejects(exercise({override:(key,result)=>key==='it-form'?{...result,url:'https://docs.google.com/forms/d/e/foreign/viewform'}:undefined}),/different native form/)})
test('Sybrox preserves raw current DNS and certificate failures instead of returning empty jobs',async()=>{for(const code of ['ENOTFOUND','UNABLE_TO_GET_ISSUER_CERT_LOCALLY']){const error=Object.assign(new TypeError('fetch failed'),{cause:{code}});await assert.rejects(exercise({override:()=>{throw error}}),received=>received===error)}})
test('Sybrox rejects changed description or role application between current listing snapshots',async()=>{let n=0;await assert.rejects(exercise({override:(key,result)=>key==='roles'&&++n===2?{...result,html:result.html.replace('Frontend Application Developer','Changed Application Developer')}:undefined}),/listing changed during traversal/)})
test('Sybrox preserves incomplete array and job evidence when an output cap selects a subset',async()=>{const jobs=await exercise({maxJobs:1});assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(readInventoryEvidence(jobs).reason,/Configured output cap/)})
test('Sybrox caller cancellation stops the native traversal',async()=>{const controller=new AbortController(),error=new Error('Caller cancelled');await assert.rejects(exercise({signal:controller.signal,override:(key,_result,options)=>{assert.equal(options.signal,controller.signal);if(key==='roles')controller.abort(error)}}),received=>received===error)})
test('Sybrox strict native transport uses bounded request cancellation and propagates certificate failures',async()=>{const {defaultFetchPage}=await import('../../scraper/sybrox/script.js');const original=globalThis.fetch;try{const error=Object.assign(new TypeError('fetch failed'),{cause:{code:'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'}});globalThis.fetch=async(_url,options)=>{assert.ok(options.signal instanceof AbortSignal);assert.equal(Object.hasOwn(options,'dispatcher'),false);throw error};await assert.rejects(defaultFetchPage(urls.home),received=>received===error);const controller=new AbortController();controller.abort(error);globalThis.fetch=()=>assert.fail('Already cancelled transport must not request');await assert.rejects(defaultFetchPage(urls.home,{signal:controller.signal}),received=>received===error)}finally{globalThis.fetch=original}})

test('Sybrox does not trust a newly public form without reverified employer/workplace/form contract',async()=>{await assert.rejects(exercise({override:(key,result)=>key==='it-form'?{...result,status:200,html:'<h1>Sybrox Application</h1><p>Job Location: Chennai, United States</p><button>Submit</button>'}:undefined}),/not a verified form/)})
