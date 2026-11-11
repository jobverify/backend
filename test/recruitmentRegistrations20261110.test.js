import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {remainingRecruitmentBatchProviders} from '../scraper-support/utils/remainingRecruitmentBatch20261103.js'

test('three reviewed registration corrections preserve the other1030 provider records exactly',()=>{
  const providers=remainingRecruitmentBatchProviders()
  assert.equal(providers.length,1033)
  const others=providers.filter(row=>!['pncfinancial','onsemiconductor','lennoxinternational'].includes(row.source))
  assert.equal(others.length,1030)
  assert.equal(createHash('sha256').update(JSON.stringify(others)).digest('hex'),
    'aa8d5793358379fbc0edefd8c16988902f520be0f2cb43d2e7f190d620dbc838')
})

test('corrected source binding dates retain null inventory totals and cleanup prohibitions',()=>{
  const providers=new Map(remainingRecruitmentBatchProviders().map(row=>[row.source,row]))
  for(const [source,date] of [['onsemiconductor','2026-11-10'],['lennoxinternational','2026-11-11'],['pncfinancial',null]]){
    const row=providers.get(source)
    assert.equal(row.verifiedOn,date,source)
    assert.equal(row.verifiedIndiaJobCount,null,source)
    assert.equal(row.verifiedPublicJobCount,null,source)
    assert.equal(row.sourceScopeComplete,false,source)
    assert.equal(row.lifecycleCleanupAllowed,false,source)
  }
})
