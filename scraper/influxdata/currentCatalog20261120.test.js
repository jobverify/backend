import test from 'node:test'
import assert from 'node:assert/strict'
import metadata from './catalog.js'
test('InfluxData current catalog binds the exact source to the current InfluxData publisher without legal-employer inference',()=>{assert.equal(metadata.source,'influxdata');assert.equal(metadata.companyName,'InfluxData');assert.equal(metadata.officialBrandName,'InfluxData');assert.equal(metadata.companyCareerPage,'https://www.influxdata.com/careers/');assert.equal(metadata.adapter,'script');assert.equal(metadata.authoritativeCurrentPublication,true);assert.equal(metadata.backfillMode,'live-parser');assert.equal(metadata.parser,'custom-script')})
test('InfluxData current assessment never reuses historical sentinel dates or zero counts',()=>{for(const field of['verifiedOn','verifiedPublicJobCount','verifiedGlobalJobCount','verifiedIndiaJobCount'])assert.equal(metadata[field],null,field)})
test('InfluxData configured collection scope holds company completeness and cleanup',()=>{assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false);assert.equal(metadata.scraperTimeoutMs,180000)})
