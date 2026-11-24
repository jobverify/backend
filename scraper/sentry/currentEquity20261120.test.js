import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCorporateInventory} from './native.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
const html=gunzipSync(fs.readFileSync(new URL('./test-data/current-corporate-20261120.html.gz',import.meta.url))).toString('utf8')
const mutate=change=>html.replace(/(\bprops=")([^"]*)(")/,(_m,before,raw,after)=>{const props=JSON.parse(decodeNativeEntities(raw));change(props);return before+JSON.stringify(props).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')+after})
test('current42 Sentry corporate roles retain the new boolean equity compensation criterion',()=>{
 assert.equal(createHash('sha256').update(html).digest('hex'),'76361f16d48113b9b3857640e4113392c14901c4cb1f4486986beda2e09fd379')
 const result=readCorporateInventory(html)
 assert.equal(result.rows.size,42)
 assert.equal([...result.rows.values()].filter(r=>r.info.offersEquity===true).length,39)
 assert.equal([...result.rows.values()].filter(r=>r.info.offersEquity===false).length,3)
 assert.equal(result.rows.get('ee7542d4-f478-4aa0-8da9-3583845d8269').info.offersEquity,false)
})
for(const value of ['true',1,null,{},['yes']])test('Sentry rejects an unreviewed equity compensation shape '+JSON.stringify(value),()=>{
 const changed=mutate(props=>{props.jobs[1][0][1].info[1].offersEquity=[0,value]})
 assert.throws(()=>readCorporateInventory(changed),/equity|Astro|compensation|criteria/)
})
test('Sentry still rejects an unknown mandatory role criterion',()=>{
 const changed=mutate(props=>{props.jobs[1][0][1].info[1].securityClearance=[0,'Mandatory']})
 assert.throws(()=>readCorporateInventory(changed),/unreviewed native role criteria field/)
})
test('Sentry never accepts a foreign application account in the new current hydration',()=>{
 const changed=mutate(props=>{props.jobs[1][0][1].info[1].applyLink=[0,'https://jobs.ashbyhq.com/foreign/'+props.jobs[1][0][1].id[1]]})
 assert.throws(()=>readCorporateInventory(changed),/employer|identity/)
})
