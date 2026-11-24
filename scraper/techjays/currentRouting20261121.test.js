import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_URL} from './script.js'
import {isReviewedCurrentSurface} from './currentPublication.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261121.json.gz',import.meta.url))))
const packets=[...fixture.pages,...fixture.assets]
for(const [name,change]of[
 ['missing all prior routing cues',text=>text.replace('<title>Careers</title>','<title>Careers | Techjays</title>').replace(/\sdata-dpl-id="[^"]*"/,'').replaceAll('20s-4ogx47ho1.js','unreviewed-new-programme.js')],
 ['forged retained legacy deployment identifier',text=>text.replace('<title>Careers</title>','<title>Careers | Techjays</title>').replace(/data-dpl-id="[^"]*"/,'data-dpl-id="dpl_34wgz9pq9BqkVrEStnLUvWTVVJKV"').replaceAll('20s-4ogx47ho1.js','unreviewed-new-programme.js')],
 ['removed native model and client declarations',text=>text.replace('<title>Careers</title>','<title>Careers | Techjays</title>').replace(/\sdata-dpl-id="[^"]*"/,'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')],
 ['unrecognized title and removed routing cues',text=>text.replace('<title>Careers</title>','<title>Unreviewed New Jobs</title>').replace(/\sdata-dpl-id="[^"]*"/,'').replaceAll('20s-4ogx47ho1.js','unreviewed-new-programme.js')],
])test('unknown Techjays deployment cannot publish fabricated India location: '+name,async()=>{
 const calls=[]
 await assert.rejects(run({onDiagnostic:()=>{},fetchPage:async url=>{
  calls.push(url);const packet=structuredClone(packets.find(row=>row.requestedUrl===url));assert.ok(packet)
  if(url===CAREERS_URL){const before=packet.html;packet.html=change(packet.html);assert.notEqual(packet.html,before)}
  if(url.startsWith(CAREERS_URL+'/'))packet.html=packet.html.replace('<h1 ','<span>Coimbatore</span><h1 ')
  return packet
 }}),/unreviewed|changed/)
 assert.equal(calls.length,2,'Hold before any unqualified role or asset read')
})
test('only the exact retained legacy board selects the old reader',()=>{
 const html=readFileSync(new URL('../../scraper-support/tests/fixtures/techjays/current-openings.html',import.meta.url),'utf8')
 assert.equal(isReviewedCurrentSurface(html),false)
 assert.equal(isReviewedCurrentSurface(html.replace('Coimbatore','Toronto')),true)
})
