import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {assertSpecializedBatchExtraction,assertSpecializedBatchDenial} from './helpers/replaySpecializedRecruitmentBatch.js'

for(const source of ['onsemiconductor','lennoxinternational']){
  test(source+' registered batch route consumes its complete genuine current workflow',async t=>{
    t.mock.method(globalThis,'fetch',()=>assert.fail('Uncontrolled HTTP refused'))
    const provider=getScraperCatalog().find(row=>row.source===source)
    assert.ok(provider)
    await assertSpecializedBatchExtraction(t,provider)
  })
  test(source+' registered batch route preserves primary HTTP denial and unknown scope',async t=>{
    t.mock.method(globalThis,'fetch',()=>assert.fail('Uncontrolled HTTP refused'))
    const provider=getScraperCatalog().find(row=>row.source===source)
    assert.ok(provider)
    await assertSpecializedBatchDenial(t,provider)
  })
}
