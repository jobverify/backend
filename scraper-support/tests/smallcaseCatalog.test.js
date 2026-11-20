import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import {fileURLToPath} from 'node:url'
import companyAliases from '../providers/companyAliases.json' with {type:'json'}
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
import {hydrateProviderCatalogEntry} from '../providers/index.js'
import SMALLCASE_CATALOG from '../../scraper/smallcase/catalog.js'
import {createSmallcaseScraper,PROVIDER_METADATA} from '../../scraper/smallcase/script.js'
test('Smallcase current local metadata requires live exact native configured collection assessment and holds all stale counts/cleanup',()=>{const p=hydrateProviderCatalogEntry(SMALLCASE_CATALOG);assert.equal(p.source,'smallcase');assert.equal(p.companyName,'Smallcase');assert.equal(p.officialBrandName,'smallcase');assert.equal(p.adapter,'script');assert.equal(p.companyCareerPage,'https://www.smallcase.com/about');assert.equal(p.authoritativeCurrentPublication,true);assert.equal(p.backfillMode,'live-parser');assert.equal(p.scraperTimeoutMs,180000);assert.equal(p.verifiedOn,null);for(const f of['verifiedPublicJobCount','verifiedGlobalJobCount','verifiedIndiaJobCount'])assert.equal(p[f],null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false);assert.equal(p.modulePath,path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../scraper/smallcase/script.js'));assert.equal(PROVIDER_METADATA,SMALLCASE_CATALOG);assert.equal(Object.hasOwn(companyAliases,'Smallcase'),false)})
test('Smallcase exact original company row is still matched directly without parent or employer aliases',()=>{const r=generateCompanyCoverageReport({csvText:'Smallcase\n',catalog:[hydrateProviderCatalogEntry(SMALLCASE_CATALOG)]});assert.equal(r.matchedCount,1);assert.equal(r.unmatchedCount,0);assert.deepEqual(r.matched.map(x=>[x.companyName,x.source,x.provider?.companyName]),[['Smallcase','smallcase','Smallcase']])})
test('Normal Smallcase factory requires original Response metadata before any old fetchPage callback',async()=>{let called=0;await assert.rejects(createSmallcaseScraper().run({fetchPage:()=>{called++;return {}}}),/original native Responses required/);assert.equal(called,0)})
