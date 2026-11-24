import fs from 'node:fs';
import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {createWonksknowScraper} from './script.js';
import {originalPacket,replay,firstRoleURL,changeSelected,digest,fixtureFile} from './fixtures/currentReplay20261121.js';

let originalFetch;
before(()=>{originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Live network is fenced; default current factory must use native fetchImpl');};});
after(()=>{globalThis.fetch=originalFetch;});

test('genuine Wonksknow fixture retains32 actual responses with inherited opening provenance and unmodified bytes',()=>{
 assert.equal(digest(fs.readFileSync(fixtureFile)),'8c6647905160258f924d2127cec1b503ad9dc9002169edc95fb3202bc844a807');
 assert.equal(originalPacket.responses.length,32);assert.equal(originalPacket.inheritedActualResponseCount,2);assert.equal(originalPacket.newlyAcquiredResponseCount,30);assert.equal(originalPacket.actualOriginalBytes,2493432);
 assert(originalPacket.responses.every(record=>digest(Buffer.from(record.bodyBase64,'base64'))===record.sha256));
});
test('current default discovers the real India Careers channel and reads all14 native roles in both genuine observations',async()=>{
 const out=await replay(createWonksknowScraper);assert.equal(out.error,null);assert.equal(out.jobs.length,14);assert.equal(out.readCount,32);
 assert(out.jobs.some(job=>job.title.toLowerCase()==='full stack developer'));assert(out.calls.every(call=>!call.url.includes('wonksknowllc')));
});
test('current publications use own India channel provenance while native country dates legal employer and formal requisition remain null',async()=>{
 const out=await replay(createWonksknowScraper);assert.equal(out.error,null);
 assert(out.jobs.every(job=>job.country==='India'&&job.nativeCountry===null&&job.postingDate===null&&job.closingDate===null&&job.requisitionId===null&&job.nativeLegalEmployer===null));
 assert(out.jobs.every(job=>job.sourceCountryEvidence.kind==='own-active-India-Careers-exact-native-account-membership'&&job.sourceCountryEvidence.inferredFromCity===false));
 assert(out.jobs.every(job=>job.sourceDetailComplete===false&&job.sourceDetailClosingQualified===false&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false));
 assert.equal(out.audit.companyIndiaTotal,null);assert.equal(out.audit.companyGlobalTotal,null);assert.equal(out.audit.sourceScopeComplete,false);
});
test('selected Python requirements exclude every OTHER ROLES card and preserve original selected markup',async()=>{
 const out=await replay(createWonksknowScraper);assert.equal(out.error,null);
 const job=out.jobs.find(job=>job.sourceUrl===firstRoleURL);assert(job);assert.match(job.minimumQualification,/B\.tech or Masters in Computer Science/);
 assert.doesNotMatch(job.minimumQualification,/OTHER ROLES|Adobe Illustrator|College\.dev|B2B clients/);
 assert.match(job.sourceRawRequirementsHtml,/B\.tech or Masters in Computer Science/);assert.match(job.sourceRawDescriptionHtml,/YoungWonks/);
 assert.equal(job.sourceNativeApplication.url,job.applyUrl);assert.equal(job.sourceNativeApplication.activationVerified,false);assert.equal(job.sourceNativeApplication.submitted,false);
});
test('a foreign country on one actual selected owner holds that role and preserves13 unrelated qualified partials',async()=>{
 const out=await replay(createWonksknowScraper,{mutate:(record,text)=>record.requestedUrl===firstRoleURL?changeSelected(text,record.url,fragment=>fragment.replace('<div ','<div data-country="United States" ')):text});
 assert.equal(out.error,null);assert.equal(out.jobs.length,13);assert(!out.jobs.some(job=>job.sourceUrl===firstRoleURL));assert.equal(out.audit.held.length,1);
});
test('a wrong-role application on the selected closing record holds only that role without visiting the application',async()=>{
 const out=await replay(createWonksknowScraper,{mutate:(record,text)=>record.requestedUrl===firstRoleURL&&record.phase==='closing'?changeSelected(text,record.url,fragment=>fragment.replace(/(job_application_organization_page\?job_id=)[^"']+/,(_all,prefix)=>prefix+'foreign-role')):text});
 assert.equal(out.error,null);assert.equal(out.jobs.length,13);assert(!out.jobs.some(job=>job.sourceUrl===firstRoleURL));assert.equal(out.readCount,32);
});
