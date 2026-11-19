import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const old=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const current=gunzipSync(readFileSync(new URL('./test-data/current-home-20261118.html.gz',import.meta.url))).toString()
const currentForm=gunzipSync(readFileSync(new URL('./test-data/current-form-20261118.html.gz',import.meta.url))).toString()
const currentClient=gunzipSync(readFileSync(new URL('./test-data/current-form-client-20261118.js.gz',import.meta.url))).toString()
const currentProgram='https://static.zohocdn.com/recruit/javascript/new-webform-render.5e1789cf0193bff12e8805c3fd83a57f.js'
const replay=(edit=value=>value)=>({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const p=old.responses.find(p=>p.url===String(url)&&(p.method??'GET')===init.method&&(p.requestBody??'')===(init.body??''))
  assert.ok(p,'Only declared public native request '+url)
  const body=p.requestedURL==='https://kanini.com/'?edit(current):Buffer.from(p.bodyBase64,'base64').toString()
  return Object.defineProperty(new Response(body,{status:p.status,headers:p.headers}),'url',{value:p.url})
}})

test('KANINI current WordPress emoji patch retains full native India acquisitions and the company hold',async()=>{
  const jobs=await run(replay())
  assert.equal(jobs.length,11)
  assert.equal(assessSoftFailureAcquisition({source:'kanini',companyName:'KANINI SOFTWARE SOLUTIONS'},jobs).runnerOutcome.success,true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('KANINI current explicitly advertised Zoho form deployment preserves native acquisition and complete question models',async()=>{
  const existing=replay(),oldFetch=existing.fetchImpl
  existing.fetchImpl=async(url,init)=>{
    if(String(url)===currentProgram)return Object.defineProperty(new Response(currentClient,{headers:{'content-type':'application/javascript'}}),'url',{value:String(url)})
    const p=old.responses.find(p=>p.url===String(url))
    if(String(url).startsWith('https://kanini.zohorecruit.in/forms/'))return Object.defineProperty(new Response(currentForm,{headers:p.headers}),'url',{value:p.url})
    return oldFetch(url,init)
  }
  const jobs=await run(existing)
  assert.equal(jobs.length,11)
  assert.equal(jobs[0].nativeApplicationModel.info.company,'KANINI Software Solutions')
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('KANINI emoji revision admission rejects executable changes beyond that finite current program',async()=>{
  for(const edit of [s=>s.replace('ver=6.8.13','ver=6.8.14'),s=>s.replace('ver=6.8.13','ver=6.8.13;unsafe'),
    s=>s.replace('wp-emoji-release.min.js?ver=6.8.13','unreviewed-runtime.js?ver=6.8.13')]) {
    await assert.rejects(run(replay(edit)),error=>error.failureKind==='parser_or_contract_error')
  }
})
