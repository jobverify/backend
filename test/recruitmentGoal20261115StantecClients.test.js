import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readBoard,readNativeClientContracts,verifyClient} from '../scraper/stantec.workday/nativeDeclarations.js'

const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261115/stantec-current-clients.json.gz',import.meta.url))))
const board=Buffer.from(current.packets.find(p=>p.requestedURL==='https://stantec.jobs/').bodyBase64,'base64').toString('utf8')

test('Stantec accepts the reviewed current entry with the same native account and search declarations',()=>{
  const result=readBoard(board)
  assert.equal(result.origin,'stantec.jobs')
  assert.equal(result.jobFolder,'stantec-jobs')
  assert.equal(result.effectiveCountrySource,'solr')
  assert.equal(result.numItems,50)
  assert.equal(result.buildID,'acefd374-cb56-4645-9fa1-bd35ac3ddc55')
})

test('Stantec current entry does not qualify an unknown or ambiguous active application build',()=>{
  assert.throws(()=>readBoard(board.replaceAll('/_nuxt/CmsqKLby.js','/_nuxt/unreviewed.js')),/reviewed Nuxt entry/)
  assert.throws(()=>readBoard(board.replace('</head>','<script type="module" src="/_nuxt/CPrYy6Dg.js"></script></head>')),/reviewed Nuxt entry/)
})

for(const type of ['MODULE','MoDuLe']) test('Stantec rejects an extra case-insensitive module entry '+type,()=>{
  assert.throws(()=>readBoard(board.replace('</head>','<script type="'+type+'" src="/_nuxt/unreviewed.js"></script></head>')),/reviewed Nuxt entry/)
})

test('Stantec no-importmap application profile cannot redirect reviewed module dependencies',()=>{
  const map='<script type="importmap">{"imports":{"https://stantec.jobs/_nuxt/D3KNJQhc.js":"https://unrelated.invalid/modified.js"}}</script>'
  assert.throws(()=>readBoard(board.replace('</head>',map+'</head>')),/importmap/)
})

test('Stantec current client receipts retain exact original native bytes',()=>{
  const contracts=readNativeClientContracts(board)
  assert.equal(contracts.length,6)
  for(const contract of contracts){
    const packet=current.packets.find(p=>p.requestedURL===contract.url)
    assert.ok(packet,'Missing independently captured client '+contract.url)
    const bytes=Buffer.from(packet.bodyBase64,'base64')
    assert.equal(bytes.length,packet.bytes)
    assert.equal(contract.sha256,packet.sha256)
    verifyClient(bytes,contract)
    assert.throws(()=>verifyClient(Buffer.concat([bytes,Buffer.from('/* unreviewed change */')]),contract),/contract changed/)
  }
})
