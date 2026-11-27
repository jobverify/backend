import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readPublisher,readIndex,verifyCSS,HOME,CAREERS} from './currentDeclarations.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/current-declared.json.gz',import.meta.url))))
const body=url=>{const p=fixture.packets.find(p=>p.url===url);assert.ok(p);const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256);return bytes.toString()}
test('Great Learning current home marketing styles preserve own employer and existing careers renderer',()=>{
 const home=readPublisher(body(HOME),HOME),careers=readPublisher(body(CAREERS),CAREERS),index=readIndex(body(CAREERS))
 assert.equal(home.model.name,'Great Learning');assert.equal(careers.model.name,'Great Learning');assert.ok(index.cards.length>0)
 const css=fixture.packets.find(p=>p.url.endsWith('.css'));verifyCSS(Buffer.from(css.bodyBase64,'base64'))
})
test('Great Learning current home styles reject unreviewed hiding rules',()=>assert.throws(()=>readPublisher(body(HOME).replace('</head>','<style>.career-openings__list{display:none}</style></head>'),HOME),/renderer style inputs/))
test('Great Learning current reviewed style bytes cannot carry an extra rule',()=>assert.throws(()=>readPublisher(body(HOME).replace('.home-banner__suptitle{','.home-banner__suptitle{opacity:0;'),HOME),/renderer style inputs/))
test('Great Learning current styles retain the critical home ancestry',()=>assert.throws(()=>readPublisher(body(HOME).replace('<body ','<body hidden '),HOME),/ancestry|native body|native Organization/))
test('Great Learning current styles retain native employer qualification',()=>{
 let changed=false
 const html=body(HOME).replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script\s*>)/gi,(whole,start,text,end)=>{const model=JSON.parse(text);if(model['@type']!=='Organization')return whole;model.name='Foreign employer';changed=true;return start+JSON.stringify(model)+end})
 assert.equal(changed,true);assert.throws(()=>readPublisher(html,HOME),/organization identity/)
})
test('Great Learning current careers CSS cannot be replaced by a changed whole program',()=>{
 const css=fixture.packets.find(p=>p.url.endsWith('.css'));assert.throws(()=>verifyCSS(Buffer.concat([Buffer.from(css.bodyBase64,'base64'),Buffer.from('.job-opening__body{display:none}') ])),/stylesheet contract changed/)
})
