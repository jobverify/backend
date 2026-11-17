import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from '../../scraper/petrustechnologiespvtltd/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/petrustechnologiespvtltd/test-data/current-native-20261117.json.gz',import.meta.url)))),html=i=>Buffer.from(fixture.originals[i].bodyBase64,'base64').toString()
test('Petrus current product route module remains an unqualified publisher original',()=>{assert.equal(source.SOURCE,'petrustechnologiespvtltd');assert.ok(html(0).includes('Transform Manufacturing with Industrial Intelligence'));assert.ok(html(1).includes('Petrus Technologies'))})
test('Petrus current metadata-free old component callbacks cannot certify company zero',async()=>{let calls=0;await assert.rejects(source.run({fetchPage:async()=>{calls++;return{status:200,html:html(0)}}}),/metadata|unsupported/);assert.equal(calls,0)})
test('Petrus current transport error remains exact with no guessed fallback',async()=>{const reason=Object.freeze({owner:'petrus-network'});let calls=0;await assert.rejects(source.run({requestIntervalMs:0,fetchImpl:async()=>{calls++;throw reason}}),error=>error===reason);assert.equal(calls,1)})
