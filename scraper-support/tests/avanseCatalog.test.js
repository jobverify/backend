import test from 'node:test'
import assert from 'node:assert/strict'
import{getScraperCatalog,buildScrapers}from'../providers/index.js'
import{generateCompanyCoverageReport}from'../providers/companyCoverage.js'

test('avanse current catalog override wins and retains unknown company totals and cleanup guards',()=>{const p=getScraperCatalog().find(p=>p.source==='avanse');assert.ok(p);assert.equal(p.adapter,'script');assert.equal(p.companyCareerPage,'https://www.avanse.com/career');assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null);assert.match(p.modulePath,/avanse[\\/]script\.js$/);assert.ok(!p.extractionStrategy.includes('return-empty'));assert.equal(p.catalogOverride,true)})
test('avanse retains runnable source identity, jobs output path and direct company coverage',()=>{const p=getScraperCatalog().find(p=>p.source==='avanse'),s=buildScrapers().find(s=>s.name==='avanse');assert.ok(s);assert.equal(typeof s.run,'function');assert.match(s.dryRunFile,/avanse[\\/]jobs\.json$/);const report=generateCompanyCoverageReport({csvText:p.companyName+'\n',catalog:[p]});assert.equal(report.matchedCount,1)})
