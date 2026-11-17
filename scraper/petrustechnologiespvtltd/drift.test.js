import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),html=i=>Buffer.from(fixture.originals[i].bodyBase64,'base64').toString()
test('Petrus current original shell declares the captured actual product module',()=>{assert.ok(html(0).includes('/assets/index-CPUbk7Ng.js'));assert.ok(html(1).includes('Petrus Technologies'));assert.ok(html(1).includes('path:"/about-us"'));assert.ok(html(1).includes('path:"/contact-us"'))})
test('Petrus historical product callbacks cannot trigger six guessed job paths',async()=>{let calls=0;await assert.rejects(source.run({fetchPage:async()=>{calls++;return{status:200,html:html(0)}},fetchText:async()=>html(1)}),/metadata|unsupported/);assert.equal(calls,0)})
