import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import {readReviewedTensorGoChunks} from './currentChunks.js'
// Historical body fixtures prove programme/data compatibility. They are not
// recast as new HTTP captures or fresh full-detail closing reads.
export function registerHistoricalProgrammeTests(url,label){const fixture=JSON.parse(gunzipSync(fs.readFileSync(url))),rows=fixture.responses.map(row=>({...row,url:row.requestedURL??row.requestedUrl??row.url,text:row.bodyBase64?Buffer.from(row.bodyBase64,'base64').toString():row.body})),main=rows.find(r=>/\/main\.[^/]+\.js$/.test(r.url)),html=rows.find(r=>typeof r.text==='string'&&/<script\b/.test(r.text)&&r.text.includes(new URL(main.url).pathname)).text
 const run=(change=(_url,text)=>text)=>readReviewedTensorGoChunks({html,asset:new URL(main.url),bundle:change(main.url,main.text),readText:async url=>{const row=rows.find(r=>r.url===url);assert.ok(row,'Only original historical declared programme');return change(url,row.text)}})
 test(label+' original historical body digests and native API records remain intact',()=>{for(const row of rows)if(row.sha256)assert.equal(createHash('sha256').update(row.text).digest('hex'),row.sha256);const api=JSON.parse(rows.find(r=>r.url==='https://api.humains.one/api/jobs').text);assert.equal(api.items.length,10)})
 test(label+' recruitment semantics remain supported independently of complete client fingerprints',async()=>{const result=await run();assert.equal(result.semantics.employer.legalName,'TensorGo Software Private Limited');assert.equal(result.semantics.api.listPath,'/api/jobs');assert.equal(result.semantics.application.nativeRoleSlugBound,true)})
 test(label+' unrelated main comment and card styling do not become source qualification gates',async()=>{const result=await run((url,text)=>url===main.url?text+'\n/* incidental marketing change */':url.includes('/803.')?text.replaceAll('space-y-6','space-y-8'):text);assert.equal(result.semantics.application.nativeRoleSlugBound,true)})
 for(const[kind,from,to]of[['employer','legalName:"TensorGo Software Private Limited"','legalName:"Other Employer"'],['country','addressCountry:"IN"','addressCountry:"US"'],['API authority','"https://api.humains.one"','"https://other.invalid"']])test(label+' changed '+kind+' is held before API acquisition',async()=>{await assert.rejects(run((url,text)=>url===main.url?text.replaceAll(from,to):text),/native recruitment contract/)})
 test(label+' changed native role application target cannot inherit programme proof',async()=>{await assert.rejects(run((url,text)=>url.includes('/803.')?text.replace('}/applications`','}/unreviewed`'):text),/native recruitment contract/)})
}
