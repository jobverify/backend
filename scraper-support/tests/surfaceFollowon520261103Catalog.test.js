import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {nativeFixture} from '../../scraper/bizongo/nativeFixture.js'
const ids=['bizongo','avalontechnologies','bootlabstechnologies','brihaspathi']
for(const source of ids)test(source+' registered current metadata keeps counts runtime-only and enforces native evidence',async()=>{
 const provider=getScraperCatalog().find(p=>p.source===source),fixture=nativeFixture(new URL('../../scraper/'+source+'/script.js',import.meta.url))
 assert.ok(provider);assert.equal(provider.zeroResultPolicy,'evidence-required');assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.verifiedOn,null)
 const reports=[],scraper=createCatalogScraper(provider),options={fetchPage:fixture.fetchPage,requestIntervalMs:0,dryRun:true,persist:false,enqueueAlerts:false,onAudit:r=>reports.push(r)}
 if(source==='bizongo'){
  const reason=Object.assign(TypeError('fetch failed'),{cause:{code:'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR'}})
  options.fetchPage=async url=>{if(url==='https://careers.bizongo.com/')throw reason;return fixture.fetchPage(url)}
  await assert.rejects(scraper.run(options),e=>e===reason);assert.equal(reports[0].sourceScopeComplete,false);assert.equal(reports[0].nativeFailure.inventoryUnavailable,true)
 }else{
  const jobs=await scraper.run(options);assert.equal(jobs.length,0);assert.equal(reports.length,1)
  const evidence=readInventoryEvidence(jobs)
  if(source==='brihaspathi'){assert.equal(evidence.status,'verified-empty');assert.equal(evidence.reportedTotal,0);assert.equal(reports[0].sourceScopeComplete,false);assert.equal(reports[0].declaredBoardComplete,true);assert.equal(reports[0].companyGlobalTotal,null);assert.equal(reports[0].companyIndiaTotal,null)}
  else{assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(readSourceObservationEvidence(jobs,source).observedVacancyCount,0)}
 }
})
