import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../utils/activeNativeHtml.js'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/ats-followup-20261107/payoda.json.gz',import.meta.url))))
for(const row of [fixture.careers,...fixture.provenance])assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)

test('current Payoda has five native Bengaluru buttons and a declared state toggle, without role-country proof',()=>{
 const document=readNativeDocument(fixture.careers.body)
 const buttons=document.nodes(node=>node.tag==='button'&&document.hasClass(node,'role-toggle'))
 assert.equal(buttons.length,5)
 assert.equal(new Set(buttons.map(node=>node.attrs['aria-controls'])).size,5)
 assert.ok(buttons.every(node=>/Bengaluru/.test(document.text(node))&&node.attrs['aria-expanded']==='false'))
 const program=fixture.provenance.find(row=>row.requestUrl.endsWith('.js'))
 assert.ok(document.nodes(node=>node.tag==='script'&&node.attrs.src==='/_next/static/chunks/0fg64yqkli8uf.js').length===1)
 assert.match(program.body,/onClick:\(\)=>t\(i\?-1:n\)/)
 assert.match(program.body,/inert:!i/)
 const contact=fixture.provenance.find(row=>row.requestUrl.endsWith('/contact'))
 const offices=readNativeDocument(contact.body),text=offices.text(offices.nodes(node=>node.tag==='root')[0])
 assert.match(text,/Coimbatore/)
 assert.match(text,/Chennai/)
 assert.doesNotMatch(text,/Bengaluru|Bangalore/i)
 assert.doesNotMatch(fixture.careers.body,/\bIndia\b/i)
})

test('registered Payoda preserves unavailable current contract instead of manufacturing India observations',async()=>{
 const requests=[]
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(row=>row.source==='payoda')).run({fetchText:async url=>{
  requests.push(url);assert.equal(url,fixture.careers.requestUrl);return fixture.careers.body
 }}),/verified official public careers surface/)
 assert.deepEqual(requests,[fixture.careers.requestUrl])
})
