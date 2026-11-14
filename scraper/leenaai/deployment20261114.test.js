import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {validateCurrentPublisher} from './nativeCurrentWorkable.js'
const load=file=>gunzipSync(readFileSync(new URL(file,import.meta.url))).toString()
const html=load('./test-data/deployment-20261114/corporate.gz'),client=load('./test-data/deployment-20261113/client.gz')
test('current Leena publisher recognizes the reviewed manifest deployment with unchanged full career factory',()=>{
 const result=validateCurrentPublisher(html,client)
 assert.equal(result.bundleSHA256,'378ca87d08ba1705fd9e81af142fc3fff753867c101d712bf1705768861b2842')
 assert.equal(result.browserEquivalenceClaimed,false)
})
test('current Leena publisher still rejects modified manifests, markup, or job factory bytes',()=>{
 for(const changed of [html.replace('2KTP-RzvGs8LpgTmW4czh','unreviewed-manifest-id'),html.replace('<body>','<body id="unreviewed">')]){
  assert.notEqual(changed,html);assert.throws(()=>validateCurrentPublisher(changed,client),/profile/)
 }
 assert.throws(()=>validateCurrentPublisher(html,client+'/* changed */'),/whole-program/)
})
