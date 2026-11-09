import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {run as runAmber} from '../amberenterprises/script.js'
const fixture=source=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/current-public-20261103.json.gz',import.meta.url))))
const C='https://www.balajitelefilms.com/career-opportunity.php'
const original=()=>fixture('balajitelefilms').responses.find(row=>row.url===C).body
const page=html=>async url=>({url,status:200,html})

test('current source supplied HTTP exceptions retain denial receipt/status/retry metadata and never trigger alternate transports',async()=>{
 const f=fixture('amberenterprises'),native=Object.assign(Error('denied'),{status:429,retryDelayMs:90000}),calls=[];let audit
 await assert.rejects(runAmber({fetchPage:async url=>{calls.push(url);if(new URL(url).hostname==='www.naukri.com')throw native;return{url,status:200,html:f.responses[0].body}},onAudit:value=>{audit=value}}),error=>error.status===429&&error.retryDelayMs===90000&&error.failureKind==='blocked_or_access_denied'&&error.upstreamOutage===true)
 assert.equal(calls.length,2);assert.equal(audit.responses.at(-1).status,429);assert.equal(audit.nativeFailure.retryDelayMs,90000)
})

test('a newly active Balaji native handoff remains unreviewed and cannot cause an arbitrary next-host read',async()=>{
 const html=original().replace('<!--<li><a href="http://www.careers.balajitelefilms.com/" target="_blank">Current Openings </a></li>-->','<li><a href="https://other-employer.invalid/openings">Current Openings</a></li>'),calls=[]
 assert.notEqual(html,original())
 await assert.rejects(run({fetchPage:async url=>{calls.push(url);if(url!==C)throw Error('Unreviewed host tripwire');return{url,status:200,html}}}),/current.*handoff.*unreviewed/i)
 assert.deepEqual(calls,[C])
})

test('current source observers are awaited with rejected identity and a bounded ignored promise',async()=>{
 const error=Error('observer refused')
 await assert.rejects(run({fetchPage:page(original()),onAudit:async()=>{throw error}}),caught=>caught===error)
 let entered=false
 await assert.rejects(run({collectionTimeoutMs:100,fetchPage:page(original()),onAudit:()=>{entered=true;return new Promise(()=>{})}}),error=>error.name==='TimeoutError')
 assert.equal(entered,true)
})

test('default denied body cancellation is not awaited and neither response body nor an alternate route is read',async()=>{
 let calls=0,bodyReads=0,cancels=0
 await assert.rejects(run({collectionTimeoutMs:100,fetchImpl:async url=>{calls++;return{url,status:429,headers:new Headers({'retry-after':'60'}),body:{cancel:()=>{cancels++;return new Promise(()=>{})}},arrayBuffer:async()=>{bodyReads++;return new ArrayBuffer(0)}}}}),error=>error.status===429&&error.retryDelayMs===60000&&error.abortRetries===true)
 assert.equal(calls,1);assert.equal(bodyReads,0);assert.equal(cancels,1)
})

test('current default transport applies public byte bounds and caller cancellation through an ignored body',async()=>{
 await assert.rejects(run({fetchImpl:async url=>({url,status:200,headers:new Headers(),arrayBuffer:async()=>Buffer.alloc(4*1024*1024+1,32)})}),/byte bound/)
 const controller=new AbortController(),reason={bodyCancelled:true}
 await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>({url,status:200,headers:new Headers(),arrayBuffer:()=>{controller.abort(reason);return new Promise(()=>{})}})}),error=>error===reason)
})
