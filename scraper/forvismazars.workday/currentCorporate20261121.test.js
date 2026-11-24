import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createSourceConfig,CANONICAL_INDIA} from './parser.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const html=Buffer.from(fixture.packets[0].bodyBase64,'base64').toString()
const qualify=value=>{const config=createSourceConfig({now:()=>fixture.capturedAt});config.handoffs[0].verify(value);return config}

test('actual global careers publisher declares India via its visible labelled native country card',()=>{
 const config=qualify(html)
 assert.equal(config.handoffs[1].url,CANONICAL_INDIA)
 assert.doesNotThrow(()=>config.validateURL(config.handoffs[1].url))
 assert.ok(config.sameReadIdentity(CANONICAL_INDIA,CANONICAL_INDIA))
})

for(const[name,change]of[
 ['foreign canonical publisher',source=>source.replace('rel="canonical" href="https://careers.forvismazars.com/"','rel="canonical" href="https://another.example/"')],
 ['foreign native brand',source=>source.replace('content="Forvis Mazars Careers Group"','content="Another Employer Careers Group"')],
 ['foreign India native account',source=>source.replaceAll('https://careers-asia.forvismazars.com/india/','https://another.example/india/')],
 ['India link relabelled under Indonesia',source=>source.replace('id="locations-map-location-1" class="outer-space">India</h4>','id="locations-map-location-1" class="outer-space">Indonesia</h4>')],
 ['hidden native country link',source=>source.replace('href="https://careers-asia.forvismazars.com/india/"','style="display:none" href="https://careers-asia.forvismazars.com/india/"')],
 ['executable native country control',source=>source.replace('href="https://careers-asia.forvismazars.com/india/"','onclick="unknown()" href="https://careers-asia.forvismazars.com/india/"')],
 ['unbound country accessible name',source=>source.replace('aria-describedby="locations-map-location-1"','aria-describedby="locations-map-location-2"')],
 ['duplicate country identity',source=>source.replace('</body>','<h4 id="locations-map-location-1">India</h4></body>')],
])test('current native India declaration rejects '+name,()=>{
 const changed=change(html);assert.notEqual(changed,html)
 assert.throws(()=>qualify(changed),/Forvis Mazars|visible|native/i)
})
