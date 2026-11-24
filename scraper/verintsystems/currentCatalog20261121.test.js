import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import metadata from './catalog.js'

test('Verint current source metadata selects stable script factory and held publication metrics',()=>{
 assert.equal(path.resolve(metadata.modulePath),path.resolve('scraper/verintsystems/script.js'))
 assert.equal(metadata.source,'verintsystems');assert.equal(metadata.companyName,'Verint Systems');assert.equal(metadata.officialBrandName,'Verint')
 assert.equal(metadata.scraperTimeoutMs,180000);assert.equal(metadata.verifiedOn,null);assert.equal(metadata.verifiedAt,null)
 for(const field of['verifiedPublicJobCount','verifiedGlobalJobCount','verifiedIndiaJobCount'])assert.equal(metadata[field],null)
 assert.equal(metadata.authoritativeCurrentPublication,true);assert.equal(metadata.parser,'custom-script');assert.equal(metadata.backfillMode,'live-parser')
 assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false)
})
test('Verint historical Oracle parser metadata remains available as compatibility only',()=>{assert.equal(metadata.siteNumber,'CX');assert.equal(metadata.workspaceDomain,'fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com');assert.match(metadata.oracleCandidateExperienceUrl,/oraclecloud\.com/);assert.equal(metadata.companyCareerPage,'https://www.verint.com/careers/')})
