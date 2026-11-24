import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {verifyPocketClientBinding} from './currentClientBinding.js'

const HOME='https://pocketfm.com/'
const PARENT='https://pocketfm.com/_next/static/chunks/2xh6tjf2c5fwa.js'
const FOOTER='https://pocketfm.com/_next/static/chunks/163mtopasvko5.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-binding-20261121.json.gz',import.meta.url))))
const bodies=new Map(fixture.packets.map(packet=>{
 const bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(bytes.length,packet.bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
 assert.equal(packet.bodyOriginalUnmodified,true)
 assert.deepEqual(packet.bodyRedactions,[])
 return[packet.phase,bytes.toString('utf8')]
}))
const verify=(phase='opening-home',edit=(_url,body)=>body)=>{
 const requests=[]
 const result=verifyPocketClientBinding(edit(HOME,bodies.get(phase)),async url=>{
  requests.push(url)
  assert.ok([PARENT,FOOTER].includes(url),'Only original current declared public assets: '+url)
  return edit(url,bodies.get(url===PARENT?'parent':'selected-footer'))
 })
 return{result,requests}
}
const replace=(body,from,to)=>{assert.ok(body.includes(from),'Original mutation target must exist');const changed=body.replace(from,to);assert.notEqual(changed,body);return changed}

for(const phase of ['opening-home','closing-home'])test('Pocket FM exact current '+phase+' binds the original selected footer with browser/company scope held',async()=>{
 const {result,requests}=verify(phase),proof=await result
 assert.deepEqual(requests,[PARENT,FOOTER])
 assert.equal(proof.parentURL,PARENT)
 assert.equal(proof.childURL,FOOTER)
 assert.equal(proof.loaderProgramSHA256,'a7ee5ee32d54522ababebad656896579db29656fbdd8bfb78ede3cf84414c3a2')
 assert.equal(proof.footerProgramSHA256,'554a4637c39dd9cf3d68f1cb04559c8fdcff81e1a43694b3ee46d3a5f5901f7b')
 assert.equal(proof.browserEquivalenceComplete,false)
 assert.equal(proof.sourceScopeComplete,false)
})

const mutations=[
 ['parent-extra-executable',PARENT,body=>body+';globalThis.unreviewedPublisher=true;'],
 ['parent-comment',PARENT,body=>body+'\n/* Unreviewed complete programme bytes. */'],
 ['cache-bound',PARENT,body=>replace(body,'o<3','o<99')],
 ['active-route-visibility',PARENT,body=>replace(body,'mode:h===I?"visible":"hidden"','mode:h===I?"hidden":"visible"')],
 ['validation-context',PARENT,body=>replace(body,'"u"<typeof window&&(N=','"u">typeof window&&(N=')],
 ['unselected-loader-target',PARENT,body=>replace(body,'t(244380)','t(999999)')],
 ['selected-footer-target',PARENT,body=>replace(body,'t(516114)','t(999999)')],
 ['debug-metadata',PARENT,body=>replace(body,'6983a774-f3b5-9c64-0d83-41031722f2e7','11111111-1111-4111-8111-111111111111')],
 ['footer-extra-executable',FOOTER,body=>body+';globalThis.unreviewedCriteria=true;'],
 ['footer-employer',FOOTER,body=>replace(body,'https://jobs.lever.co/pocketfm','https://jobs.lever.co/other-employer')],
 ['current-parent-location',HOME,body=>replace(body,'2xh6tjf2c5fwa.js','unreviewed-parent.js')],
 ['document-base',HOME,body=>replace(body,'<head>','<head><base href="https://other-employer.example/">')],
]
for(const [name,target,edit] of mutations)test('Pocket FM current complete release rejects '+name,async()=>{
 await assert.rejects(verify('opening-home',(url,body)=>url===target?edit(body):body).result,/binding|program|current|declared/i)
})

const selectedScript=/<script\b[^>]*\bsrc="\/_next\/static\/chunks\/2xh6tjf2c5fwa\.js"[^>]*><\/script>/g
for(const [name,edit] of [
 ['duplicate-script',script=>script+script],
 ['template-script',script=>'<template>'+script+'</template>'],
 ['comment-script',script=>'<!--'+script+'-->'],
 ['data-script',script=>script.replace('<script ','<script type="application/json" ')],
])test('Pocket FM current publisher rejects '+name,async()=>{
 const html=bodies.get('opening-home'),matches=[...html.matchAll(selectedScript)]
 assert.equal(matches.length,1)
 const changed=replace(html,matches[0][0],edit(matches[0][0]))
 await assert.rejects(verifyPocketClientBinding(changed,async()=>assert.fail('Invalid owning declaration cannot read a programme')),/binding|current/i)
})
