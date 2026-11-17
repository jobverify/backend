import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),html=i=>Buffer.from(fixture.originals[i].bodyBase64,'base64').toString()
test('Pletra current original publisher declaration remains first party and specific',()=>{assert.ok(html(0).includes('PletraTech'));assert.ok(html(0).includes('https://pletratech.com/careers-pletra-technologies/'));assert.equal(source.CAREERS_URL,'https://pletratech.com/careers-pletra-technologies/')})
test('Pletra current foreign careers handoff is rejected before following it',async()=>{let calls=0;await assert.rejects(source.run({requestIntervalMs:0,fetchImpl:async url=>{calls++;const r=new Response(html(0).replaceAll('https://pletratech.com/careers-pletra-technologies/','https://example.org/careers'),{status:200,headers:fixture.originals[0].headers});Object.defineProperty(r,'url',{value:url});return r}}),/careers declaration/);assert.equal(calls,1)})
