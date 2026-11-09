import test from 'node:test'
import assert from 'node:assert/strict'
import{getScraperCatalog,buildScrapers}from'../providers/index.js'
import{generateCompanyCoverageReport}from'../providers/companyCoverage.js'

test('angelone current catalog override wins and retains unknown company totals and cleanup guards',()=>{const p=getScraperCatalog().find(p=>p.source==='angelone');assert.ok(p);assert.equal(p.adapter,'script');assert.equal(p.companyCareerPage,'https://www.angelone.in/careers');assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null);assert.match(p.modulePath,/angelone[\\/]script\.js$/);assert.ok(!p.extractionStrategy.includes('return-empty'));assert.equal(p.catalogOverride,true)})
test('angelone retains runnable source identity, jobs output path and direct company coverage',()=>{const p=getScraperCatalog().find(p=>p.source==='angelone'),s=buildScrapers().find(s=>s.name==='angelone');assert.ok(s);assert.equal(typeof s.run,'function');assert.match(s.dryRunFile,/angelone[\\/]jobs\.json$/);const report=generateCompanyCoverageReport({csvText:p.companyName+'\n',catalog:[p]});assert.equal(report.matchedCount,1)})
