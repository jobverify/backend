import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import {buildScrapers,getScraperCatalog} from '../providers/index.js'
import catalog from '../../scraper/amicableai/catalog.js'

test('Amicable catalog declares current native extraction without a static empty claim',()=>{
 assert.equal(catalog.source,'amicableai')
 assert.equal(catalog.companyName,'Amicable AI')
 assert.equal(catalog.officialBrandName,'amicable')
 assert.equal(catalog.atsPlatform,'screenloop-public-careers')
 assert.equal(catalog.companyCareerPage,'https://amicable.io/careers')
 assert.equal(catalog.officialScreenloopBoardUrl,'https://app.screenloop.com/careers/amicable')
 assert.equal(catalog.verifiedOn,null)
 assert.match(catalog.extractionStrategy,/same-ID-full-criteria/)
 assert.match(catalog.verifiedSurfaceSummary,/historical Amicable AI/)
 assert.match(catalog.verifiedSurfaceSummary,/private application forms/)
 assert.match(catalog.verifiedSurfaceSummary,/Company-wide recruitment absence/)
 assert.equal(path.basename(path.dirname(catalog.modulePath)),'amicableai')
 assert.equal(path.basename(catalog.modulePath),'script.js')
})
test('Amicable original backlog row still matches its configured local source',()=>{
 const report=generateCompanyCoverageReport({csvText:'Amicable AI\n',catalog:[catalog]})
 assert.equal(report.matchedCount,1)
 assert.equal(report.unmatchedCount,0)
 assert.equal(report.matched[0].source,'amicableai')
})
test('Amicable registered provider selects the current native script and keeps original source matching',()=>{
 const provider=getScraperCatalog().find(row=>row.source==='amicableai')
 const scraper=buildScrapers().find(row=>row.name==='amicableai')
 assert.ok(provider&&scraper)
 assert.equal(provider.companyName,'Amicable AI')
 assert.equal(provider.atsPlatform,'screenloop-public-careers')
 assert.equal(provider.verifiedOn,null)
 assert.equal(path.basename(path.dirname(scraper.dryRunFile)),'amicableai')
 assert.equal(path.basename(scraper.dryRunFile),'jobs.json')
 const report=generateCompanyCoverageReport({csvText:'Amicable AI\n',catalog:getScraperCatalog()})
 assert.equal(report.matchedCount,1)
 assert.equal(report.matched[0].source,'amicableai')
})
