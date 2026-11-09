import assert from'node:assert/strict'
import test from'node:test'
import{AIRASIA_INDIA_CATALOG}from'../../scraper/airasiaindia/catalog.js'
import{PROVIDER_METADATA}from'../../scraper/airasiaindia/script.js'
import{buildCompanyLookup,generateCompanyCoverageReport,getCompanyAliasMap}from'../providers/companyCoverage.js'
import{buildScrapers,getScraperCatalog}from'../providers/index.js'
test('historical AirAsia India local contract describes only the current legal successor AIX brand board',()=>{
 assert.equal(AIRASIA_INDIA_CATALOG.source,'airasiaindia');assert.equal(AIRASIA_INDIA_CATALOG.companyName,'Air India Express')
 assert.equal(AIRASIA_INDIA_CATALOG.legacyCompanyName,'AirAsia India');assert.equal(AIRASIA_INDIA_CATALOG.currentHiringBrand,'aix')
 assert.equal(AIRASIA_INDIA_CATALOG.relatedRegisteredSource,'airindia');assert.equal(AIRASIA_INDIA_CATALOG.canonicalSource,undefined)
 assert.equal(AIRASIA_INDIA_CATALOG.verifiedPublicJobCount,null);assert.equal(AIRASIA_INDIA_CATALOG.lifecycleCleanupAllowed,false)
 assert.deepEqual(PROVIDER_METADATA,AIRASIA_INDIA_CATALOG)
})
test('AirAsia India exact backlog source remains matched after official successor migration',()=>{
 const report=generateCompanyCoverageReport({csvText:'AirAsia India\n',catalog:getScraperCatalog()})
 assert.equal(report.matchedCount,1);assert.equal(report.unmatchedCount,0);assert.equal(report.matched[0].source,'airasiaindia')
})
test('migration aliases preserve exact original source lookup without conflating separate airline/employer sources',()=>{
 const lookup=buildCompanyLookup({catalog:getScraperCatalog(),aliasMap:getCompanyAliasMap()}).exactLookup
 assert.equal(lookup.get('airasia india'),'airasiaindia');assert.equal(lookup.get('aix connect'),'airasiaindia')
 assert.equal(lookup.get('accolite digital'),'accolitedigital');assert.equal(lookup.get('air india'),'airindia')
 assert.notEqual(lookup.get('airasia move'),'airasiaindia')
 const report=generateCompanyCoverageReport({csvText:'AirAsia India\nAIX Connect\nAccolite Digital\n',catalog:getScraperCatalog()})
 assert.equal(report.matchedCount,3);assert.deepEqual(report.matched.map(row=>row.source),['airasiaindia','airasiaindia','accolitedigital'])
})
test('registered AIX metadata stays separate from the registered Air India airline',()=>{
 const catalog=getScraperCatalog(),aix=catalog.find(item=>item.source==='airasiaindia'),airIndia=catalog.find(item=>item.source==='airindia')
 assert.equal(aix.companyName,'Air India Express');assert.equal(aix.companyCareerPage,'https://www.airindiaexpress.com/careers')
 assert.equal(aix.atsPlatform,'successfactors-aix-public-brand');assert.ok(airIndia);assert.equal(airIndia.companyName,'Air India')
 assert.equal(typeof buildScrapers().find(item=>item.name==='airasiaindia').run,'function')
})
