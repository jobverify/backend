import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readIkeaAuthority,readIkeaHome,HOME,CAREERS,KEYWORD} from './nativeContract.js'
const sha=b=>createHash('sha256').update(b).digest('hex'),fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-home-20261120.json.gz',import.meta.url))))
const packet=url=>{const p=fixture.packets.find(p=>p.url===url);assert.ok(p);const b=Buffer.from(p.bodyBase64,'base64');assert.equal(sha(b),p.persistedSHA256);return{status:p.status,url:p.url,contentType:p.contentType,html:b.toString()}}
const home=packet(HOME),authority=packet(CAREERS),moduleName='Hero Hompage Search Form'
function hero(page){const d=readNativeDocument(page.html),f=d.nodes(n=>n.tag==='form'&&n.attrs['data-module-name']===moduleName);assert.equal(f.length,1);const tag=[...page.html.matchAll(/<form\b[^>]*>/gi)].map(m=>m[0]).find(t=>readNativeDocument(t).nodes(n=>n.tag==='form')[0]?.attrs.id===f[0].attrs.id);assert.ok(tag);const start=page.html.indexOf(tag),end=page.html.indexOf('</form>',start)+7;assert.ok(end>start);return{id:f[0].attrs.id,tag,block:page.html.slice(start,end)}}
function editTag(change){const h=hero(home),tag=change(h.tag);assert.notEqual(tag,h.tag);return{...home,html:home.html.replace(h.tag,tag)}}
function editBlock(change){const h=hero(home),block=change(h.block);assert.notEqual(block,h.block);return{...home,html:home.html.replace(h.block,block)}}
function rejects(page,pattern){assert.throws(()=>readIkeaHome(page),pattern)}
test('actual Nov20 own declaration and native home preserve the declared GET search despite rotated hero DOM id',()=>{
 assert.equal(fixture.observedAt,'2026-11-20T18:44:56.221Z');assert.equal(fixture.newNetworkRequests,0);assert.equal(fixture.packets.length,2)
 assert.equal(readIkeaAuthority(authority).nativeHome,HOME);const model=readIkeaHome(home);assert.equal(model.searchURL,KEYWORD);assert.equal(model.form.id,hero(home).id);assert.equal(model.controls.length,3)
})
test('a cosmetic unique hero DOM id rename preserves the same public native request',()=>{const id=hero(home).id,page={...home,html:home.html.replaceAll(id,'reviewed-hero-alias')};assert.equal(readIkeaHome(page).searchURL,KEYWORD)})
test('a changed hero public method is held',()=>rejects(editTag(t=>t.replace('<form','<form method="post"')),/native public GET form changed/))
test('a foreign hero action is held',()=>rejects(editTag(t=>t.replace('/en/search-jobs','https://foreign.invalid/search')),/native public GET form changed/))
test('duplicate native hero carriers are held',()=>rejects({...home,html:home.html.replace('</body>',hero(home).block+'</body>')},/missing or ambiguous native hero search form/))
test('hidden hero does not borrow the visible navigation form',()=>rejects(editTag(t=>t.replace('<form','<form hidden')),/missing or ambiguous native hero search form/))
test('disabled native tenant control cannot donate a GET query',()=>rejects(editBlock(b=>b.replace('name="orgIds"','disabled name="orgIds"')),/native successful form controls changed/))
test('a new named non-input successful control is retained as a query-contract hold',()=>rejects(editBlock(b=>b.replace('</form>','<select name="country"><option value="US" selected>US</option></select></form>')),/native successful form controls changed/))
test('a foreign native tenant value is held',()=>rejects(editBlock(b=>b.replace('value="22908"','value="99999"')),/native successful form controls changed/))
test('a required home client in an inert script type cannot establish native declaration',()=>{
 const src='//tbcdn.talentbrew.com/bundles/tb-corepack.js',tag=[...home.html.matchAll(/<script\b[^>]*>/gi)].map(m=>m[0]).find(t=>readNativeDocument(t).nodes(n=>n.tag==='script')[0]?.attrs.src===src);assert.ok(tag);rejects({...home,html:home.html.replace(tag,tag.replace('<script','<script type="application/json"'))},/native home client is not uniquely declared and active/)
})
