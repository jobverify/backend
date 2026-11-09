import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import {getScraperCatalog,hydrateProviderCatalogEntry} from '../providers/index.js'
import {VALTECH_INDIA_SYSTEMS_CATALOG,default as catalog} from '../../scraper/valtechindiasystems/catalog.js'
const modulePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../scraper/valtechindiasystems/script.js')
test('Valtech local and effective registered catalog use the current native employer and evidence-required scope',()=>{
 assert.equal(catalog,VALTECH_INDIA_SYSTEMS_CATALOG)
 const local=hydrateProviderCatalogEntry({...catalog,modulePath}),registered=getScraperCatalog().find(p=>p.source==='valtechindiasystems')
 for(const p of[local,registered]){
 assert.equal(p.companyName,'Valtech India Systems');assert.equal(p.officialBrandName,'Valtech');assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'greenhouse-eu+first-party-joblist');assert.equal(p.modulePath,modulePath);assert.equal(p.nativeBoardId,4003061101);assert.equal(p.nativeBoardUrl,'https://job-boards.eu.greenhouse.io/valtech');assert.equal(p.indiaCountryTag,'india');assert.equal(p.verifiedOn,'2026-10-27');assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.zeroResultPolicy,'evidence-required');assert.match(p.verifiedSurfaceSummary,/partial/i);assert.match(p.verifiedSurfaceSummary,/legal employer/i)
 }
})
test('exact backlog Valtech India Systems row resolves without treating it as proven legal employer',()=>{
 const report=generateCompanyCoverageReport({csvText:'Valtech India Systems\n',catalog:[hydrateProviderCatalogEntry({...catalog,modulePath})],aliasMap:{}})
 assert.equal(report.matchedCount,1);assert.equal(report.unmatchedCount,0);assert.equal(report.matched[0].source,'valtechindiasystems')
})
