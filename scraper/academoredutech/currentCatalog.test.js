import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,buildScrapers} from '../../scraper-support/providers/index.js'
const ids=['academoredutech','amazecodes','anaptycodeemy','campussutra']
test('current LinkedIn overrides preserve source/profile identity and clear obsolete complete-search promises',()=>{
 const catalog=getScraperCatalog(),runners=buildScrapers()
 for(const source of ids){const row=catalog.find(row=>row.source===source);assert.equal(row.adapter,'script');assert.equal(row.sourceCurrentPublicContractReviewedOn,'2026-11-03');assert.equal(row.countryFilter,'India');assert.ok(row.modulePath.replaceAll('\\','/').endsWith('/scraper/'+source+'/script.js'));assert.equal(typeof runners.find(row=>row.name===source).run,'function');for(const key of['verifiedOn','verifiedAt','verifiedPublicJobCount','verifiedIndiaJobCount','verifiedPublicPostingCount','verifiedIndiaRoleCount'])assert.equal(row[key],null,source+':'+key);for(const key of['sourceScopeComplete','sourceCompanyWideScopeComplete','lifecycleCleanupAllowed'])assert.equal(row[key],false,source+':'+key)}
 assert.equal(catalog.find(row=>row.source==='anaptycodeemy').companyDomain,'codeemy.in')
})
