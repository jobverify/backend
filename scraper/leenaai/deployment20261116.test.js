import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {validateCurrentPublisher} from './nativeCurrentWorkable.js'

const load=name=>gunzipSync(readFileSync(new URL('./test-data/deployment-20261116/'+name+'.gz',import.meta.url))).toString('utf8')
const client=gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/client.gz',import.meta.url))).toString('utf8')

test('November 16 Leena deployment reconciles the observed optional delivery beacon with its unchanged career factory',()=>{
 const first=validateCurrentPublisher(load('corporate'),client)
 const second=validateCurrentPublisher(load('corporate-second'),client)
 assert.equal(first.bundleSHA256,'378ca87d08ba1705fd9e81af142fc3fff753867c101d712bf1705768861b2842')
 assert.equal(first.corporateProfileSHA256,second.corporateProfileSHA256)
 assert.notEqual(first.corporateSHA256,second.corporateSHA256)
 assert.equal(first.browserEquivalenceClaimed,false)
})

test('reviewed Leena delivery variants still reject changed publisher markup, beacon, manifest, parameters and factory',()=>{
 const html=load('corporate')
 for(const changed of [html.replace('<body>','<body id="unreviewed">'),html.replaceAll('oY1X2N-ueA57SlznyFxqD','unreviewed-manifest-id'),html.replace('crossorigin="anonymous"','crossorigin="use-credentials"'),html.replace('a5b7ecdb5867d46c', 'a5b7ecdb5867d46d')]){
  assert.notEqual(changed,html)
  assert.throws(()=>validateCurrentPublisher(changed,client),/profile|parameter|layout/)
 }
 assert.throws(()=>validateCurrentPublisher(html,client+'/* changed */'),/whole-program/)
})
