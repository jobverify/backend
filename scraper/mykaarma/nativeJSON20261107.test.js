import test from 'node:test'
import assert from 'node:assert/strict'
import {currentFixture} from './replayCurrent20261107.js'
import {listing,role,board,E} from './nativeContract20261107.js'
const f=currentFixture(),embed=f.packets.find(p=>p.requestedURL===E),e=Buffer.from(embed.bodyBase64,'base64').toString(),g=listing(e).groups.find(g=>g.country==='IN'),html=Buffer.from(f.packets.find(p=>p.requestedURL===g.identity.url).bodyBase64,'base64').toString()
for(const [name,change]of [
 ['duplicate company',s=>s.replace('"companyName":"myKaarma"','"companyName":"Foreign employer","companyName":"myKaarma"')],
 ['escaped duplicate company',s=>s.replace('"companyName":"myKaarma"','"company\\u004eame":"Foreign employer","companyName":"myKaarma"')],
 ['duplicate unlisted status',s=>s.replace('"unlistedFromSearch":false','"unlistedFromSearch":true,"unlistedFromSearch":false')],
 ['nested duplicate description',s=>s.replace('"description":{"company":','"description":{"company":"Additional mandatory foreign eligibility","company":')],
 ])test('own raw native JSON rejects '+name,()=>assert.throws(()=>role(change(html),g,'role',f.expected.nativeCollectionEvidence.startedAt),/duplicate.*JSON|JSON.*duplicate/i))
test('raw listing rejects duplicate typed country before genuine India',()=>assert.throws(()=>listing(e.replace('"country":"India"','"country":"United States","country":"India"')),/duplicate.*JSON|JSON.*duplicate/i))
for(const [name,change]of [
 ['port444',u=>{u.port='444'}],['credentials',u=>{u.username='unreviewed'}],['otherorigin',u=>{u.hostname='foreign.example'}],
 ])test('native graphic rejects '+name,()=>{const b=structuredClone(f.expected.nativeCollectionEvidence.nativeOpeningListing.board),u=new URL(b.logo.url);change(u);b.logo.url=u.href;assert.throws(()=>board(b),/graphic authority/)})

import {parseNativeJSON} from './nativeJSON20261107.js'
import {extractIndiaJobsFromEmbed} from './script.js'
for(const [name,input]of [
 ['root duplicate',String.raw`{"country":"US","country":"India"}`],
 ['escaped ASCII duplicate',String.raw`{"country":"US","\u0063ountry":"India"}`],
 ['escaped nested status',String.raw`{"nested":{"unlistedFromSearch":true,"unlistedFrom\u0053earch":false}}`],
 ['Unicode key duplicate',String.raw`{"\uD83D\uDE00":1,`+JSON.stringify(String.fromCodePoint(0x1f600))+`:2}`],
 ['prototype key duplicate',String.raw`{"__proto__":1,"__proto__":2}`],
 ])test('decoded object key uniqueness rejects '+name,()=>assert.throws(()=>parseNativeJSON(input),/Duplicate native JSON/))
for(const input of ['', ' ', '{}x', '{} {}', '{"a":1,}', '[1,]', '[,1]', '{a:1}', "{'a':1}", '{"a" 1}', '{"a":}', 'truex', 'undefined', 'NaN', 'Infinity', '+1', '01', '-01', '1.', '.1', '1e', '1e+', '0x1', '/*comment*/{}', '\ufeff{}', String.raw`"bad\x41"`, String.raw`"bad\u12G4"`, '"unterminated', '"raw\nnewline"'])test('strict JSON grammar rejects '+JSON.stringify(input),()=>assert.throws(()=>parseNativeJSON(input),/JSON grammar/))
for(const input of [
 '{}','[]','null','true','false','-0','1e400','1.125e-2','[1,-2,3e4]',
 '{"left":{"country":"India"},"right":{"country":"United States"}}',
 String.raw`{"text":"embedded \"country\":\"US\",\"country\":\"India\" remains a string","path":"\\folder\/name","unicode":"\uD83D\uDE00"}`,
 '{"__proto__":{"country":"India"}}', ' \r\n\t {"a":1} \n',
 ])test('strict preflight preserves JSON.parse semantics '+input.slice(0,35),()=>assert.deepEqual(parseNativeJSON(input),JSON.parse(input)))
test('genuine complete native SSR payloads preserve every JSON model/number/string',()=>{let n=0;for(const p of f.packets){if(!p.contentType?.includes('text/html'))continue;const m=Buffer.from(p.bodyBase64,'base64').toString().match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);if(m){assert.deepEqual(parseNativeJSON(m[1]),JSON.parse(m[1]));n++}}assert.equal(n,23)})
test('nesting is bounded at128 without changing valid JSON semantics',()=>{const valid='['.repeat(128)+'0'+']'.repeat(128);assert.deepEqual(parseNativeJSON(valid),JSON.parse(valid));assert.throws(()=>parseNativeJSON('['.repeat(129)+'0'+']'.repeat(129)),/nesting bound/);assert.throws(()=>parseNativeJSON(' '.repeat(3000001)),/input bound/)})
test('historical pure helper also rejects raw duplicate native country before returning briefs',()=>assert.throws(()=>extractIndiaJobsFromEmbed(e.replace('"country":"India"','"country":"United States","country":"India"')),/JSON|payload|native/i))
for(const [name,change]of [
 ['all copies duplicate business fields',s=>s.replaceAll('"companyName":"myKaarma"','"companyName":"Foreign employer","companyName":"myKaarma"').replaceAll('"country":"India"','"country":"United States","country":"India"').replaceAll('"unlistedFromSearch":false','"unlistedFromSearch":true,"unlistedFromSearch":false')],
 ['all copies foreign logo port',s=>s.replaceAll('https://secured-assets.ripplingcdn.com/','https://secured-assets.ripplingcdn.com:444/')],
 ])test('entire source rejects '+name+' before publishing any record',async()=>{const {replayCurrent}=await import('./replayCurrent20261107.js');try{await replayCurrent({strictOrder:false,change:ps=>{for(const p of ps)if(p.contentType?.includes('text/html'))p.body=Buffer.from(change(p.body.toString()))}});assert.fail('Unsafe full workflow accepted')}catch({error}){assert.match(error.message,/Duplicate native JSON|graphic authority/)}})
