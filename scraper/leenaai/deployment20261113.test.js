import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {validateCurrentPublisher} from './nativeCurrentWorkable.js'
const fixture=name=>gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/'+name+'.gz',import.meta.url))).toString('utf8')
test('November 13 Leena publisher recognizes the reviewed page revision with unchanged career factory',()=>{
 const opening=validateCurrentPublisher(fixture('corporate'),fixture('client'))
 const closing=validateCurrentPublisher(fixture('corporate-second'),fixture('client'))
 assert.equal(opening.bundleSHA256,'378ca87d08ba1705fd9e81af142fc3fff753867c101d712bf1705768861b2842')
 assert.equal(opening.corporateProfileSHA256,closing.corporateProfileSHA256)
 assert.equal(opening.browserEquivalenceClaimed,false)
})
test('November 13 Leena publisher keeps every fixed markup and career program byte qualified',()=>{
 const original=fixture('corporate'),changed=original.replace('<body>','<body id="unreviewed">')
 assert.notEqual(changed,original)
 assert.throws(()=>validateCurrentPublisher(changed,fixture('client')),/profile/)
 assert.throws(()=>validateCurrentPublisher(fixture('corporate'),fixture('client')+'/* changed */'),/whole-program/)
})
