import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {corporateContract,nativeShellContract,clientContract,BOARD_URL} from './nativeContract.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../byteridge/test-data/deployment-20261118.json.gz',import.meta.url))))
const board=fixture.packets.find(p=>p.url===BOARD_URL)
test('current Monocept stylesheet deployment keeps its visible official native handoff',()=>{
 const value=corporateContract(fixture.corporate);assert.ok(value.hiringLinks.includes(BOARD_URL));assert.ok(value.styles.stylesheets.some(url=>url.includes('fce9d8a1a.opt.min.css')))
})
test('current Monocept native tuple retains all fourteen whole public clients and company inventory hold',()=>{
 const value=nativeShellContract(board.body);assert.equal(value.publicClientURLs.length,14);assert.equal(value.companyScopeUnqualified,true)
 for(const url of value.publicClientURLs){const packet=fixture.packets.find(p=>p.url===url);assert.ok(packet,url);assert.equal(clientContract(url,packet.body),packet.sha256)}
})
test('current Monocept executable bytes and hidden handoff still fail closed',()=>{
 const main=fixture.packets.find(p=>p.url.includes('/main.'))
 assert.throws(()=>clientContract(main.url,main.body+'\n/* changed */'),/native client bytes/)
 assert.throws(()=>corporateContract(fixture.corporate.replaceAll('href="'+BOARD_URL+'"','hidden href="'+BOARD_URL+'"')),/visible official/)
})
