import assert from 'node:assert/strict'
import test from 'node:test'
import {run,OFFICIAL_CAREERS_URL} from './script.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

// Current direct official response, 2026-11-16: HTTP 200 is an Incapsula
// interstitial, not a publisher declaration or an empty career inventory.
const blocked='<html>\r\n<head>\r\n<META NAME="robots" CONTENT="noindex,nofollow">\r\n<script src="/_Incapsula_Resource?SWJIYLWA=5074a744e2e3d891814e9a2dace20bd4,719d34d31c8e3a6e6fffd425f7e032f3">\r\n</script>\r\n<body>\r\n</body></html>'

test('expired iValue binding reports the observed Incapsula block without requesting unbound ATS inventory',async()=>{
 const calls=[]
 await assert.rejects(run({now:()=> '2026-11-16T16:37:38.468Z',fetchText:async url=>{calls.push(url);return blocked},fetchJson:async()=>assert.fail('blocked corporate identity cannot authorize ATS acquisition')}),error=>{
  assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'})
  assert.equal(error.abortRetries,true)
  assert.equal(error.requestURL,OFFICIAL_CAREERS_URL)
  assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.failureEvidence.inventoryComplete,false)
  assert.equal(error.failureEvidence.observedListingCount,null)
  assert.equal(error.failureEvidence.bindingExpired,true)
  return true
 })
 assert.deepEqual(calls,[OFFICIAL_CAREERS_URL])
})

test('an unrelated changed official page remains a contract failure rather than an Incapsula block',async()=>{
 await assert.rejects(run({now:()=> '2026-11-16T16:37:38.468Z',fetchText:async()=>'<html><title>Unrelated company</title></html>'}),error=>{
  assert.notEqual(classifyScraperError(error).failureKind,'blocked_or_access_denied')
  assert.notEqual(error.softFailure,true)
  return true
 })
})
