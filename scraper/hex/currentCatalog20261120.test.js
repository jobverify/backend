import assert from 'node:assert/strict'
import test from 'node:test'
import metadata from './catalog.js'
import {PROVIDER_METADATA,createHexScraper} from './script.js'
test('Current Hex catalog preserves exact source and native publisher',()=>{assert.equal(metadata.source,'hex');assert.equal(metadata.companyName,'Hex');assert.equal(metadata.companyCareerPage,'https://hex.tech/careers/');assert.equal(PROVIDER_METADATA,metadata);assert.equal(typeof createHexScraper().run,'function')})
test('Current Hex finite paired request budget has a matching ordinary source deadline',()=>assert.equal(metadata.scraperTimeoutMs,360000))
test('Current Hex catalog leaves company totals, whole-source completeness, and cleanup held',()=>{assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.sourceListingComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false);assert.equal(metadata.companyGlobalTotal,null);assert.equal(metadata.companyIndiaTotal,null)})
