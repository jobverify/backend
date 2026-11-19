import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {validateCurrentPublisher} from './nativeCurrentWorkable.js'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const load=name=>gunzipSync(readFileSync(new URL('./test-data/deployment-20261118/'+name+'.gz',import.meta.url))).toString()
const html=load('corporate'),client=load('client')
const capture=JSON.parse(load('native-capture.json'))
const replay=(change=(url,body)=>body)=>{
  const counts=new Map()
  return {fetchImpl:async(url,init)=>{
    assert.equal(init.method,'GET')
    const rows=capture.responses.filter(p=>p.requestedURL===String(url)),count=counts.get(String(url))||0
    assert.ok(rows.length>count,'Only exact current public requests '+url)
    counts.set(String(url),count+1)
    const p=rows[count],body=change(String(url),Buffer.from(p.bodyBase64,'base64').toString())
    return Object.defineProperty(new Response(body,{status:p.status,headers:p.headers}),'url',{value:p.url})
  }}
}
test('November 18 Leena publisher binds the current complete factory with the same explicit public careers feed',()=>{
  const proof=validateCurrentPublisher(html,client)
  assert.equal(proof.bundleSHA256,'c41f4d7591956790cb2731b7f0b54d8ca1eb893667ca66afd0cfe6e48f339596')
  assert.equal(proof.browserEquivalenceClaimed,false)
})

test('November 18 Leena default native path reconciles all selected public details and retains partial source scope',async()=>{
  const jobs=await run(replay())
  const assessment=assessSoftFailureAcquisition({source:'leenaai',companyName:'Leena AI'},jobs)
  assert.equal(jobs.length,6)
  assert.equal(assessment.eligibleJobs,3)
  assert.equal(assessment.runnerOutcome.success,true)
  assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,13)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('November 18 Leena publisher admission cannot override native account identity',async()=>{
  await assert.rejects(run(replay((url,body)=>{
    if(url==='https://apply.workable.com/api/v1/accounts/leena-ai'){
      const payload=JSON.parse(body)
      payload.uid='00000000-0000-0000-0000-000000000000'
      return JSON.stringify(payload)
    }
    return body
  })),/Leena AI native/)
})

test('November 18 Leena review rejects changed factory, fallback authority and unreviewed publisher fields',()=>{
  for(const changed of [client+';window.changed=true',client.replace('/api/website/careers/jobs','/api/website/careers/other'),
    client.replace('https://apply.workable.com/leena-ai/','https://apply.workable.com/other/')])assert.throws(()=>validateCurrentPublisher(html,changed))
  for(const changed of [html.replace('<body>','<body data-unreviewed="true">'),
    html.replaceAll('careers-15090a0f10f8bc12','careers-unreviewed'),html.replace("t:'MTc5NTAyNjExNg=='","t:'notbase64value=='")]) {
    assert.notEqual(changed,html)
    assert.throws(()=>validateCurrentPublisher(changed,client))
  }
})
