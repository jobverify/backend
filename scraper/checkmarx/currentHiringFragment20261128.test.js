import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parseCheckmarxBoard,BOARD} from './nativeContract.js'
import {readNativeData} from './nativeData.js'
import {run} from './script.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-hiring-fragment-20261128.json.gz',import.meta.url))))
for(const packet of capture.packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const packet=capture.packets.find(p=>p.requestedUrl===BOARD),html=packet.body
const original=readNativeData(html,'COMPANY_POSITIONS_DATA')
const options={now:capture.completedAt}
const changed=mutate=>html.replace(/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/,(_match,prefix,line)=>{
  const rows=structuredClone(original)
  mutate(rows.find(row=>row.uid==='CC.475'),rows)
  return prefix+JSON.stringify(rows).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||'')
})
const official=(row,mutate)=>{const url=new URL(row.url_active_page);mutate(url);row.url_active_page=url.href;row.url_detected_page=url.href}

test('genuine current Checkmarx public US Hiring fragments preserve all 22 raw native rows and both exact India identities',()=>{
  const board=parseCheckmarxBoard(html,options)
  assert.deepEqual(board.rows,original)
  assert.equal(board.rows.length,22)
  const fragments=board.rows.filter(row=>new URL(row.url_active_page).hash)
  assert.equal(fragments.length,6)
  assert.ok(fragments.every(row=>row.location.country==='US'&&row.is_internal===false&&new URL(row.url_active_page).hash==='#Hiring'))
  assert.deepEqual(board.rows.filter(row=>row.location.country==='IN').map(row=>row.uid),['5D.474','C7.471'])
  assert.equal(board.companyGlobalTotal,null)
  assert.equal(board.companyIndiaTotal,null)
})

test('current Checkmarx fragment support reaches the actual query-free India role without fabricating its uncaptured body',async()=>{
  const requested=[]
  await assert.rejects(run({now:capture.completedAt,fetchImpl:async url=>{
    requested.push(url)
    if(url!==BOARD)throw Error('CONTROLLED_UNCAPTURED_CURRENT_NATIVE_ROLE '+url)
    return Object.defineProperty(new Response(html,{status:200,headers:packet.headers}),'url',{value:BOARD})
  }}),/^Error: CONTROLLED_UNCAPTURED_CURRENT_NATIVE_ROLE /)
  assert.ok(requested.slice(1).every(url=>new URL(url).origin==='https://www.comeet.com'&&!new URL(url).hash&&!new URL(url).search))
})

for(const[label,mutate]of[
  ['unknown fragment',row=>official(row,url=>{url.hash='#Other'})],
  ['case-altered fragment',row=>official(row,url=>{url.hash='#hiring'})],
  ['encoded fragment',row=>official(row,url=>{url.hash='#%48iring'})],
  ['a fragment with country selectors',row=>official(row,url=>{url.hash='#Hiring?country=IN'})],
  ['a query combined with the fragment',row=>official(row,url=>{url.search='?country=IN'})],
  ['a foreign official host',row=>official(row,url=>{url.hostname='foreign.invalid'})],
  ['URL credentials',row=>official(row,url=>{url.username='unqualified'})],
  ['a different official role',row=>official(row,url=>{url.pathname='/job-openings/position/00.000/'})],
  ['employee-only visibility',row=>{row.is_internal=true}],
  ['another assigned foreign country',row=>{row.location.country='SG'}],
  ['an India-country substitution',row=>{row.location.country='IN'}],
  ['a native public URL fragment',row=>{row.url_comeet_hosted_page+='#Hiring';row.url_recruit_hosted_page=row.url_comeet_hosted_page}],
])test('Checkmarx retains exact identity/qualification guards for '+label,()=>{
  assert.throws(()=>parseCheckmarxBoard(changed(mutate),options),/Checkmarx native contract:/)
})
