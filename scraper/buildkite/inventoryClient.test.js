import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readCurrentInventoryClient,buildkiteInventoryAsset} from './inventoryClient.js'
const fixture=source=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/native-country-20261103.json.gz',import.meta.url))))
const data=source=>{const f=fixture(source),html=f.responses.find(r=>r.url===(source==='buildkite'?'https://buildkite.com/about/careers/':'https://careers.tripadvisor.com/all-jobs')).body;return{html,js:source==='buildkite'?f.responses.find(r=>r.url.includes('/_astro/open-roles.')).body:readNativeDocument(html).nodes(n=>n.tag==='script'&&!n.attrs.src&&n.raw.includes('https://boards-api.greenhouse.io/v1/boards/tripadvisor/jobs?content=true'))[0].raw}}
test('actual executable public clients bind complete read-only native listing and active renderer',()=>{
 for(const source of['buildkite','tripadvisor']){const d=data(source),proof=readCurrentInventoryClient(source,d.html,d.js);assert.equal(proof.boardToken,source);assert.equal(proof.method,'GET');assert.equal(proof.body,null);assert.equal(proof.query,'content=true')}
 assert.equal(buildkiteInventoryAsset(data('buildkite').html),'https://buildkite.com/_astro/open-roles.BrmMSRwB.js')
})
test('comments, changed method/token, shadowed globals and duplicate inventory handlers are rejected',()=>{
 for(const source of['buildkite','tripadvisor']){const d=data(source);for(const js of['/*'+d.js+'*/',d.js.replaceAll('boards-api.greenhouse.io','evil.invalid'),'function fetch(){}\n'+d.js,'class Math {}\n'+d.js,d.js+'\nfetch=function(){};',d.js+'\nclass Other { static { fetch=()=>{} } }',d.js+'\nfunction AOS(){}'])assert.throws(()=>readCurrentInventoryClient(source,source==='tripadvisor'?d.html.replace(d.js,js):d.html,js),/public inventory client changed/)}
 const d=data('tripadvisor');assert.throws(()=>readCurrentInventoryClient('tripadvisor',d.html,d.js.replace('return fetch(','return fetch(').replace(').then((res) => res.json());',", {method:'POST'}).then((res) => res.json());")),/public inventory client changed/)
 assert.throws(()=>readCurrentInventoryClient('tripadvisor',d.html,d.js+'\nfunction getJobsData(){return []}'),/public inventory client changed/)
})
test('unrelated private form definitions do not gate the public inventory program',()=>{
 const d=data('tripadvisor'),js=d.js.replace('function renderSelectedFile() {','function renderSelectedFile() { throw new Error("Private form changed");')+'\nfunction unrelatedPrivateContactForm(){ return "a changed private form"; }'
 assert.equal(readCurrentInventoryClient('tripadvisor',d.html.replace(d.js,js),js).boardToken,'tripadvisor')
})
test('inactive, duplicate or hidden Buildkite islands cannot declare an active public inventory',()=>{
 const d=data('buildkite'),tag=d.html.match(/<astro-island\b[^>]*component-url="\/_astro\/open-roles\.[^>]+>/)[0];for(const html of[d.html.replace(tag,tag.replace('component-export="default"','component-export="different"')),d.html.replace(tag,tag.replace('client="load"','client="only"')),d.html.replace(tag,'<template>'+tag).replace('<div id="open-roles"','</template><div id="open-roles"')])assert.throws(()=>buildkiteInventoryAsset(html),/public inventory client changed/)
 const node=readNativeDocument(d.html).nodes(n=>n.tag==='astro-island'&&n.attrs['component-url']?.includes('open-roles'))[0];assert.throws(()=>buildkiteInventoryAsset(d.html+`<astro-island component-url="${node.attrs['component-url']}" component-export="default" client="load"></astro-island>`),/public inventory client changed/)
})
