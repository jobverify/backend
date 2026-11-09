import assert from 'node:assert/strict'
import test from 'node:test'
import {createDefaultFetchText,createFedilityInvestmentsScraper,hasOfficialJobsPageSignal,hasCloudflareChallengePageSignal} from './script.js'
const challenge='<title>Just a moment...</title>jobs.fidelity.com Enable JavaScript and cookies to continue'
test('challenge is diagnostic, never official Fidelity identity or accepted HTTP transport',async()=>{assert.equal(hasOfficialJobsPageSignal(challenge),false);assert.equal(hasCloudflareChallengePageSignal(challenge),true);let curlCalled=false;const fetchText=createDefaultFetchText({fetchImpl:async()=>({status:403,ok:false,text:async()=>challenge}),execFileImpl:()=>{curlCalled=true}});await assert.rejects(fetchText('https://jobs.fidelity.com/in/jobs/'));assert.equal(curlCalled,false)})
test('historical wrapper fails unknown on actual403 instead of extracting an old feed after challenge',async()=>{await assert.rejects(createFedilityInvestmentsScraper().run({fetchPage:async url=>({status:403,url,body:challenge})}),/unavailable/)})
