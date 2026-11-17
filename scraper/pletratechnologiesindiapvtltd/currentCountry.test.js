import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),html=i=>Buffer.from(fixture.originals[i].bodyBase64,'base64').toString()
import {parseCurrentPletraRows} from './currentNative20261117.js'
test('Pletra current no-location and bare-Pune titles never supply India country',()=>{const rows=parseCurrentPletraRows(html(1));assert.equal(rows[0].country,null);assert.equal(rows[1].country,null);assert.equal(rows[2].country,'Belgium')})
test('Pletra remote replacement remains unknown without city inference',()=>{const rows=parseCurrentPletraRows(html(1).replace('Salesforce Trainer- Location- Pune','Salesforce Trainer- Location- Remote'));assert.equal(rows[1].country,null);assert.equal(rows[1].city,null)})
test('Pletra native criteria identity duplication is held',()=>{assert.throws(()=>parseCurrentPletraRows(html(1).replaceAll('elementor-tab-title-2362','elementor-tab-title-2361')),/identity|binding|differs/)} )
