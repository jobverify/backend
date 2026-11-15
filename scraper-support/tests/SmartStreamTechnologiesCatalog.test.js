import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import {getScraperCatalog,hydrateProviderCatalogEntry} from '../providers/index.js'
import {SMARTSTREAM_TECHNOLOGIES_CATALOG,default as defaultCatalog} from '../../scraper/smartstreamtechnologies/catalog.js'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
const modulePath=path.resolve(currentDir,'../../scraper/smartstreamtechnologies/nativeWorkable20261114.js')

test('SmartStream catalog retains own identity and advertises native data with explicit scope holds',async()=>{
 const provider=hydrateProviderCatalogEntry(SMARTSTREAM_TECHNOLOGIES_CATALOG)
 assert.equal(defaultCatalog,SMARTSTREAM_TECHNOLOGIES_CATALOG)
 assert.equal(provider.source,'smartstreamtechnologies')
 assert.equal(provider.companyName,'SmartStream Technologies')
 assert.equal(provider.officialBrandName,'Smartstream')
 assert.equal(provider.adapter,'script')
 assert.equal(provider.homepageUrl,'https://smart.stream/')
 assert.equal(provider.companyCareerPage,'https://smart.stream/careers/')
 assert.equal(provider.atsPlatform,'workable')
 assert.equal(provider.countryFilter,'India')
 assert.equal(provider.companyDomain,'smart.stream')
 assert.equal(provider.modulePath,modulePath)
 assert.equal(provider.verifiedOn,'2026-11-14')
 assert.match(provider.paginationStrategy,/four-reviewed-full-india-role-pairs;unvisited-pages-held/)
 assert.match(provider.extractionStrategy,/own-native-legal-employer/)
 assert.match(provider.verifiedSurfaceSummary,/corporate403/)
 assert.match(provider.verifiedSurfaceSummary,/native application URL\/action remain null\/unverified/)
 for(const field of ['sourceScopeComplete','lifecycleCleanupAllowed','sourceActivationComplete','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete'])assert.equal(provider[field],false)
 const report=generateCompanyCoverageReport({csvText:'SmartStream Technologies\n',catalog:[provider]})
 assert.equal(report.matchedCount,1);assert.equal(report.unmatchedCount,0)
 assert.equal(typeof(await import(pathToFileURL(provider.modulePath))).run,'function')
})

test('actual registered SmartStream selects its native entry and matches only the source-local contract fields',()=>{
 const actual=getScraperCatalog().find(row=>row.source==='smartstreamtechnologies')
 assert.equal(actual.modulePath,modulePath)
 for(const field of ['source','companyName','officialBrandName','adapter','companyDomain','homepageUrl','companyCareerPage','atsPlatform','paginationStrategy','extractionStrategy','verifiedOn','verifiedSurfaceSummary','sourceScopeComplete','lifecycleCleanupAllowed','sourceActivationComplete','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete'])assert.equal(actual[field],SMARTSTREAM_TECHNOLOGIES_CATALOG[field],field)
})
