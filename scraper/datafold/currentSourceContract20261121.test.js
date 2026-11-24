import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import './currentLocalInvocation20261121.test.js'
import {HOME,BOARD,FEED,fixture,element,exact,replay,closing} from './currentConfiguredProjection20261121.test.js'
import * as source from './script.js'
import metadata from './catalog.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {runScraperWithTimeout} from '../../scraper-support/runner.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const criteria=markup=>closing(HOME,html=>element(html,node=>node.attrs.id==='careers-jobs-root',(original,node)=>original.slice(0,node.closeStart-node.start)+markup+original.slice(node.closeStart-node.start)))
for(const[label,value]of[['Country','India'],['Employer','Other Employer'],['Posting status','withdrawn'],['Application URL','https://other.example/apply'],['Location','Bengaluru, India']])test('Datafold own recruitment criterion '+label+' constrains current authority',()=>assert.rejects(replay(criteria('<section><label>'+label+'</label><span>'+value+'</span></section>')),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error'))

test('Datafold own recruitment coherent authored employer and publication remain accepted',async()=>assert.equal((await replay(criteria('<section><label>Employer</label><span>Datafold</span></section><section><span>Posting status</span><span>open</span></section><section><p>Application URL</p><p>'+BOARD+'</p></section>'))).evidence.status,'complete-inventory'))

test('Datafold current registration exposes source-specific factory and preserves explicit old programme entry',()=>{assert.equal(typeof source.createDatafoldScraper,'function');assert.equal(typeof source.createLegacyDatafoldScraper,'function');assert.equal(source.SOURCE,'datafold');assert.equal(source.COMPANY,'Datafold');assert.equal(source.CAREERS_URL,HOME)})

test('Datafold current registration has current source-local script metadata without cached historical totals',()=>{assert.equal(metadata.source,'datafold');assert.equal(metadata.companyName,'Datafold');assert.equal(metadata.officialBrandName,'Datafold');assert.equal(metadata.adapter,'script');assert.equal(metadata.parser,'custom-script');assert.equal(metadata.authoritativeCurrentPublication,true);assert.equal(metadata.scraperTimeoutMs,180000);for(const field of['verifiedOn','verifiedPublicJobCount','verifiedGlobalJobCount','verifiedIndiaJobCount'])assert.equal(metadata[field],null,field);assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false)})

test('Datafold current registration uses the ordinary default factory and unchanged assessor on ten original GETs',async t=>{
 t.mock.method(http,'request',()=>{throw Error('Real HTTP forbidden')});t.mock.method(https,'request',()=>{throw Error('Real HTTPS forbidden')})
 const counts=new Map(),calls=[],allowed=new Set([HOME,BOARD,FEED,...JSON.parse(Buffer.from(fixture.responses.find(row=>row.requestedURL===FEED).bodyBase64,'base64')).jobs.map(row=>row.jobUrl)])
 t.mock.method(globalThis,'fetch',async(url,init={})=>{url=String(url);assert.ok(allowed.has(url),'Only actual own, board, documented feed and full public-role GETs');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const phase=counts.get(url)??0;counts.set(url,phase+1);const original=fixture.responses.filter(row=>row.requestedURL===url)[phase];assert.ok(original,'No extra response beyond the original pair');calls.push(url);return Object.defineProperties(new Response(Buffer.from(original.bodyBase64,'base64'),{status:original.status,headers:original.headers}),{url:{value:original.finalURL},redirected:{value:false}})})
 const provider=getScraperCatalog().find(row=>row.source==='datafold');assert.equal(provider.adapter,'script');assert.equal(provider.authoritativeCurrentPublication,true)
 const jobs=await runScraperWithTimeout(createCatalogScraper(provider));assert.equal(calls.length,10);for(const count of counts.values())assert.equal(count,2);assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence,assessment=assessSoftFailureAcquisition(provider,jobs);assert.equal(evidence.status,'complete-inventory');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(audit.observations.length,2);assert.ok(audit.observations.every(phase=>phase.roles.length===2&&phase.roles.every(role=>role.country==='United States')));assert.equal(audit.currentRendererQualified,false);assert.equal(audit.ownGraphQLBackendResponseAcquired,false);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(assessment.runnerOutcome.success,true);assert.equal(assessment.indiaJobs,0);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('Datafold current registration retains the observed genuine programme without a whole source hash pin',async()=>{const result=await replay(closing(HOME,html=>exact(html,'</body>','<!-- source registration observation -->\n</body>')));assert.equal(result.audits[0].observations[0].authority.programme.nativePublicURLTemplate,BOARD+'/{native-job-id}');assert.equal(result.audits[0].nativeProgramsExecuted,false)})
