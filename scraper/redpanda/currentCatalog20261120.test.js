import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import metadata from './catalog.js'
import {createRedpandaScraper} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const oldFetch=globalThis.fetch
globalThis.fetch=async()=>{throw Error('Offline Redpanda catalog checks prohibit network')}
after(()=>{globalThis.fetch=oldFetch})
test('Redpanda source metadata requires live current proof and leaves company totals unknown',()=>{assert.equal(metadata.authoritativeCurrentPublication,true);assert.equal(metadata.backfillMode,'live-parser');assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false);assert.equal(metadata.verifiedOn,null);assert.equal(metadata.verifiedPublicJobCount,null);assert.equal(metadata.verifiedIndiaJobCount,null);assert.equal(metadata.parser,'custom-script');assert.equal(metadata.scraperTimeoutMs,180000)})
for(const undefine of[false,true])test('Redpanda registered source factory uses only actual connected own/feed responses'+(undefine?' and retains constructor transport when run fields are undefined':''),async()=>{
 const counts=new Map(),calls=[]
 const source=createRedpandaScraper({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const occurrence=counts.get(url)??0;counts.set(url,occurrence+1);calls.push(url);const row=fixture.responses.filter(row=>row.requestedUrl===url)[occurrence];assert.ok(row,'No board, compensation variant, application or guessed URL');return Object.defineProperties(new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers}),{url:{value:row.url},redirected:{value:row.redirected}})}})
 assert.equal(source.name,'redpanda')
 const jobs=await source.run(undefine?{now:undefined,fetchImpl:undefined}:{}),result=assessSoftFailureAcquisition(metadata,jobs)
 assert.equal(jobs.length,0);assert.equal(result.runnerOutcome.success,true);assert.equal(result.zeroJobEvidence,'fetched-zero');assert.equal(result.cleanupOptions.replaceExisting,false);assert.equal(calls.length,4);assert.deepEqual(calls.map(url=>new URL(url).hostname),['www.redpanda.com','api.ashbyhq.com','www.redpanda.com','api.ashbyhq.com'])
})
