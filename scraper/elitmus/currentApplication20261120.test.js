import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readElitmusCareers,runCurrentPublications} from './currentNative20261120.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url)))),decode=p=>Buffer.from(p.bodyBase64,'base64').toString(),board='https://www.elitmus.com/careers',row=readElitmusCareers(decode(fixture.responses.find(p=>p.requestedUrl===board)),board).records[0],html=decode(fixture.responses.filter(p=>p.requestedUrl===row.url)[1]),form=document(html).nodes(n=>n.tag==='form'&&n.attrs.action==='/jobs_users/new')[0],tag=html.slice(form.start,form.openEnd)
for(const[action,name]of[['http://[','malformed'],['https://other.invalid/apply','foreign'],[null,'missing']])test('actual first LoginToApply '+name+' action cannot be skipped despite valid duplicate on native200 closing',async()=>{
 const changed=action===null?tag.replace(/ action="\/jobs_users\/new"/,''):tag.replace('action="/jobs_users/new"','action="'+action+'"');assert.notEqual(changed,tag);const body=html.slice(0,form.start)+changed+html.slice(form.openEnd),counts=new Map()
 const jobs=await runCurrentPublications({now:()=>fixture.observedAt,requestIntervalMs:0,fetchImpl:async url=>{const n=counts.get(url)??0;counts.set(url,n+1);const p=fixture.responses.filter(p=>p.requestedUrl===url)[n];assert.ok(p,'Genuine chronological source URL');return Object.defineProperties(new Response(Buffer.from(url===row.url&&n===1?body:decode(p)),{status:p.status,headers:p.headers}),{url:{value:p.url},redirected:{value:false}})}})
 assert.equal(jobs.length,2);assert.ok(!jobs.some(j=>j.jobId===row.id));assert.ok(jobs.every(j=>j.sourceDetailComplete===false));assert.ok(jobs.nativeCollectionEvidence.optionalRoleFailures.some(p=>p.id===row.id&&/native200|application|URL/i.test(p.reason)))
})
