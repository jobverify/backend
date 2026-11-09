import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,buildScrapers} from '../../scraper-support/providers/index.js'
const expected={balajitelefilms:['Balaji Telefilms','https://www.balajitelefilms.com/career-opportunity.php'],amberenterprises:['Amber Enterprises','https://www.ambergroupindia.com/careers/'],avglogistics:['AVG Logistics','https://avglogistics.com/careers'],bharatforge:['Bharat Forge','https://www.bharatforge.com/careers/careers']}
test('current four public-boundary overrides win exact employer/module identity without static counts, stale dates or cleanup',()=>{
 const catalog=getScraperCatalog(),scrapers=buildScrapers()
 for(const[source,[name,url]]of Object.entries(expected)){
  const row=catalog.find(row=>row.source===source),scraper=scrapers.find(row=>row.name===source)
  assert.equal(row.companyName,name);assert.equal(row.companyCareerPage,url);assert.equal(row.adapter,'script');assert.equal(row.countryFilter,'India');assert.equal(row.sourceCurrentPublicContractReviewedOn,'2026-11-03')
  assert.ok(row.modulePath.replaceAll('\\','/').endsWith('/scraper/'+source+'/script.js'));assert.equal(typeof scraper.run,'function')
  for(const key of['verifiedOn','verifiedAt','verifiedPublicJobCount','verifiedIndiaJobCount','verifiedPublicPostingCount','verifiedIndiaRoleCount'])assert.equal(row[key],null,source+':'+key)
  for(const key of['sourceScopeComplete','sourceCompanyWideScopeComplete','lifecycleCleanupAllowed'])assert.equal(row[key],false,source+':'+key)
 }
})
