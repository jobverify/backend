import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readNativeClientContracts,readBoard,verifyClient,searchURL,ROLE_BASE,json} from './nativeDeclarations.js'
import {readIndiaFacet,readIndiaPage,readRole,reconcileModels} from './nativeModels.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/deployment-20261120.json.gz',import.meta.url))))
const board=Buffer.from(fixture.packets.find(row=>row.requestedURL==='https://stantec.jobs/').bodyBase64,'base64').toString()
test('current original Stantec board retains its declared coherent Nuxt client deployment and native account',()=>{
 const contracts=readNativeClientContracts(board)
 assert.equal(contracts[0].url,'https://stantec.jobs/_nuxt/Bi2VLHgt.js')
 assert.equal(readBoard(board).origin,'stantec.jobs')
})

const packet=(url,index=0)=>fixture.packets.filter(row=>row.requestedURL===url)[index]
const original=(url,index=0)=>Buffer.from(packet(url,index).bodyBase64,'base64')
test('all current native client bytes belong to the coherent original deployment',()=>{
 for(const contract of readNativeClientContracts(board)){
  const bytes=original(contract.url);verifyClient(bytes,contract)
  assert.throws(()=>verifyClient(Buffer.concat([bytes,Buffer.from('\nchanged')]),contract),/published client contract changed/)
 }
})

const total=readIndiaFacet(json(original(searchURL(1,false)).toString())).value
const rows=[...readIndiaPage(json(original(searchURL(1)).toString()),1,total),...readIndiaPage(json(original(searchURL(2)).toString()),2,total)]
const first=rows[0],roleURL=ROLE_BASE+first.guid+'.json',model=json(original(roleURL).toString())
test('current native country pages and full paired role criteria keep original dates and scope',()=>{
 assert.equal(total,63);assert.equal(rows.length,total)
 const role=readRole(model,first,Date.parse(fixture.capturedAt))
 assert.ok(role.description.length>=200);assert.equal(role.model.date_added,model.date_added)
 reconcileModels(model,json(original(roleURL,1).toString()),'role')
})
for(const[name,change]of[
 ['foreign employer',value=>{value.company='Another Employer'}],
 ['foreign work country',value=>{value.country='Indonesia'}],
 ['unreviewed role schema',value=>{value.unknownNativeAuthority=true}],
 ['foreign criteria country',value=>{value.html_description+='<p>Country: Indonesia</p>'}],
 ['future native date',value=>{value.date_added='2099-01-01T00:00:00Z'}],
])test('current role guard rejects '+name,()=>{
 const changed=structuredClone(model);change(changed)
 assert.throws(()=>readRole(changed,first,Date.parse(fixture.capturedAt)),/Stantec native/)
})

for(const[name,change]of[
 ['another native account',html=>html.replaceAll('stantec.jobs','another.jobs')],
 ['ambiguous executable entry',html=>html.replace('</head>','<script type="module" src="/_nuxt/Bi2VLHgt.js"></script></head>')],
 ['inert entry',html=>html.replace('type="module"','type="module" nomodule')],
 ['unreviewed entry',html=>html.replace('src="/_nuxt/Bi2VLHgt.js"','src="/_nuxt/unreviewed.js"')],
])test('current Stantec declaration rejects '+name,()=>{
 const changed=change(board);assert.notEqual(changed,board)
 assert.throws(()=>readBoard(changed),/Stantec native/)
})
