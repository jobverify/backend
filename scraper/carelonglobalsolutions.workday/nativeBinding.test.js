import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyCarelonBinding,validateCarelonMappedJobs,HOME,CAREERS,BOARD} from './nativeBinding.js'
import {toPlainText} from '../../scraper-support/detailExtractors/shared.js'
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz',import.meta.url))))
const fetchPage=async url=>{const p=url===HOME?f.corporate:f.careers;return{status:p.status,url:p.finalURL,body:p.body}}
test('actual current regional corporate and careers pages actively bind the exact Carelon India board',async()=>{const b=await verifyCarelonBinding({fetchPage});assert.equal(b.boardURL,BOARD);assert.equal(b.companyScopeComplete,false);assert.equal(b.regionalEntity,'Carelon Global Solutions India LLP')})
for(const [name,change]of [['hidden',s=>'<div hidden>'+s+'</div>'],['inert',s=>'<div inert>'+s+'</div>'],['template',s=>'<template>'+s+'</template>'],['wrong board',s=>s.replaceAll('carelonglobal_in','ElevanceHealthCareers')],['wrong country scope',s=>s.replace('India careers','Philippines careers')]])test('current official handoff rejects '+name,async()=>{await assert.rejects(()=>verifyCarelonBinding({fetchPage:async url=>{const p=await fetchPage(url);return{...p,body:url===CAREERS?change(p.body):p.body}}}))})
test('HTTP403,202,redirect and caller abort cannot certify a board binding',async()=>{for(const change of [p=>({...p,status:403}),p=>({...p,status:202}),p=>({...p,url:'https://example.invalid/'})])await assert.rejects(()=>verifyCarelonBinding({fetchPage:async url=>change(await fetchPage(url))}));const c=new AbortController();c.abort(Error('caller cancelled'));await assert.rejects(()=>verifyCarelonBinding({fetchPage,signal:c.signal}),/cancelled/)})
const mapped=()=>f.details.map(p=>{const j=JSON.parse(p.body).jobPostingInfo;return{source:'carelonglobalsolutions',company:'Carelon Global Solutions',jobId:j.jobReqId,requisitionId:j.jobReqId,nativeEmployer:'Carelon Global Solutions India LLP',country:'India',sourceDescription:j.jobDescription,jobDescription:toPlainText(j.jobDescription),sourceDetailComplete:true,sourceListingComplete:false}})
test('all15 actual full native JDs retain exact legal employer and regional partial attribution',()=>{assert.equal(validateCarelonMappedJobs(mapped()).length,15)})
test('inert JD or changed legal employer cannot qualify through the shared adapter',()=>{for(const change of [j=>{j.nativeEmployer='Elevance Health Inc.'},j=>{j.sourceDescription='<div inert>'+j.sourceDescription+'</div>'},j=>{j.country='United States'}]){const jobs=mapped();change(jobs[0]);assert.throws(()=>validateCarelonMappedJobs(jobs))}})
