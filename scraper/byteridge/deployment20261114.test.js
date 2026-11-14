import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {corporateContract,FRAME_URL} from './nativeContract.js'
const html=gunzipSync(readFileSync(new URL('./test-data/deployment-20261114/corporate.gz',import.meta.url))).toString()
test('current Byteridge careers declaration retains the visible native delegation after removing media-player styles',()=>{
 const value=corporateContract(html);assert.deepEqual(value.frames,[FRAME_URL]);assert.deepEqual(value.reasons,[])
})
test('current Byteridge qualification still rejects hidden delegation and any additional unknown style',()=>{
 assert.throws(()=>corporateContract(html.replace('<iframe id="dynamic-iframe"','<iframe hidden id="dynamic-iframe"')),/missing visible/)
 assert.throws(()=>corporateContract(html.replace('</head>','<style>#dynamic-iframe{display:none}</style></head>')),/unreviewed corporate stylesheet/)
})
