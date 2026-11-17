import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parseCheckmarxBoard} from './nativeContract.js'
import {readNativeData} from './nativeData.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/deployment-20261116.json.gz',import.meta.url))))
const html=Buffer.from(capture.responses[0].bodyBase64,'base64').toString('utf8')
const options={now:capture.completedAt}
const rows=readNativeData(html,'COMPANY_POSITIONS_DATA')
const changed=mutate=>html.replace(/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/,(_match,before,line)=>{
 const value=structuredClone(rows),row=value.find(row=>row.uid==='BF.475')
 mutate(row)
 return before+JSON.stringify(value).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||'')
})

test('Checkmarx current Singapore referral query keeps 31 native records and the two explicitly typed India roles',()=>{
 const board=parseCheckmarxBoard(html,options)
 assert.equal(board.rows.length,31)
 assert.deepEqual(board.rows.filter(row=>row.location.country==='IN').map(row=>row.uid),['5D.474','C7.471'])
 const foreign=board.rows.find(row=>row.uid==='BF.475')
 assert.equal(foreign.location.country,'SG')
 assert.equal(foreign.is_internal,false)
 assert.equal(new URL(foreign.url_comeet_hosted_page).search,'')
})

for(const[label,mutate]of[
 ['changed referral bytes',row=>{row.url_active_page+='&unqualified=true';row.url_detected_page=row.url_active_page}],
 ['different native country',row=>{row.location.country='IN'}],
])test('Checkmarx current referral exception rejects '+label,()=>{
 assert.throws(()=>parseCheckmarxBoard(changed(mutate),options),/Checkmarx native contract:/)
})
