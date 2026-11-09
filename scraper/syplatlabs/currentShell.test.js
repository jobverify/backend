import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {hasOfficialHomepageShellSignal,hasVerifiedBundleRouteSignal,run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const home=await fs.readFile(new URL('./fixtures/current-home.html',import.meta.url),'utf8'),bundle=await fs.readFile(new URL('./fixtures/current-bundle.js',import.meta.url),'utf8')
test('SYplat accepts current first-party shell and exact fifteen-route inventory',()=>{assert.equal(hasOfficialHomepageShellSignal(home),true);assert.equal(hasVerifiedBundleRouteSignal(bundle),true)})
test('SYplat rejects altered partner identity and new careers route',()=>{assert.equal(hasOfficialHomepageShellSignal(home.replaceAll('SAP Build Partner.','Unverified Partner.')),false);assert.equal(hasVerifiedBundleRouteSignal(bundle+' path:"/careers"'),false)})
test('SYplat returns discovery-only evidence for a verified nonlisting shell',async()=>{const jobs=await run({fetchPage:async url=>({status:200,url,text:url.includes('/assets/')?bundle:home})});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)})
