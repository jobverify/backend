import assert from 'node:assert/strict'
import test from 'node:test'
import companyAliases from '../providers/companyAliases.json' with {type:'json'}
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import {buildScrapers,getScraperCatalog} from '../providers/index.js'
import {classifyProviderImplementation} from '../../scripts/reportScriptCatalogTopology.js'
import {buildPublishingGapReport} from '../../scripts/publishingGapReport.js'
test('Okta India remains a catalog alias of the one native Okta source',()=>{
 const catalog=getScraperCatalog(),provider=catalog.find(p=>p.source==='okta')
 assert.equal(provider.companyName,'Okta');assert.equal(provider.adapter,'script');assert.equal(provider.atsPlatform,'official-first-party-drupal-job-board')
 assert.equal(provider.companyCareerPage,'https://www.okta.com/company/careers/');assert.equal(provider.publicBoardUrl,'https://www.okta.com/company/careers/job-listing/')
 assert.equal(provider.verifiedIndiaOpeningCount,null);assert.equal(provider.verifiedPublicOpeningCount,null)
 assert.equal(provider.historicalVerification.verifiedOn,'2026-08-07');assert.equal(provider.historicalVerification.indiaOpeningCount,98)
 assert.equal(companyAliases['Okta India'],'okta');assert.equal(catalog.some(p=>p.source==='oktaindia'),false)
 assert.equal(buildScrapers().filter(s=>s.name==='okta').length,1)
 const report=generateCompanyCoverageReport({csvText:'company_name\nOkta\nOkta India\n',catalog,aliasMap:companyAliases})
 assert.equal(report.matchedCount,2);assert.equal(report.unmatchedCount,0)
 assert.deepEqual(report.matched.map(r=>r.source),['okta','okta'])
})
test('Auth0 current redirect wrapper retains canonical Okta attribution while historical catalog proof expires',()=>{
 const catalog=getScraperCatalog(),auth0=catalog.find(p=>p.source==='auth0'),okta=catalog.find(p=>p.source==='okta')
 assert.equal(auth0.inventoryDelegation.verified,true);assert.deepEqual(auth0.inventoryDelegation.sources,['okta'])
 assert.equal(auth0.inventoryDelegation.preservesChildSourceAndCompany,true);assert.equal(classifyProviderImplementation(auth0).type,'script')
 assert.equal(auth0.atsPlatform,'official-first-party-drupal-job-board')
 const now=new Date('2026-10-31T08:05:20.380Z'),report=buildPublishingGapReport({catalog:[auth0,okta],now,runtime:{databaseAvailable:true,generatedAt:now.toISOString(),publicCompanyNames:['Okta'],
  inventory:[{source:'auth0',savedJobs:0,visibleJobs:0,visibleCompanies:[]},{source:'okta',savedJobs:3,visibleJobs:3,visibleCompanies:['Okta']}],statuses:[]}})
 assert.equal(report.summary.distinctVisibleCompanies,1)
 const wrapper=report.rows.find(r=>r.source==='auth0');assert.equal(wrapper.implementationType,'script')
 assert.equal(wrapper.inventoryDelegation.evidenceFresh,false)
 assert.deepEqual(wrapper.inventoryDelegation.publicChildSources,[]);assert.equal(wrapper.visibleJobs,0)
 assert.equal(report.rows.find(r=>r.source==='okta').visibleJobs,3)
})
