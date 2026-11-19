import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import manifest from './test-data/manifest-current-20261119.js'
import {run,hasOfficialHomepageSignal,hasOfficialCareersSignal,extractPublicOpenings} from './script.js'

const hash=value=>createHash('sha256').update(value).digest('hex')
const zipped=fs.readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))
assert.equal(hash(zipped),manifest.fixtureSha256)
const rows=JSON.parse(gunzipSync(zipped))
for(const row of rows)assert.equal(hash(row.html),row.sha256)
const home='https://numerictech.com/',careers=home+'careers/united-states/'
const page=url=>{const row=rows.findLast(row=>row.requestedUrl===url);assert.ok(row,'Unexpected read '+url);return row}

test('Numeric current United States notices cannot revive historical SAP Analyst rows or imply India',async()=>{
 const reads=[]
 assert.equal(hasOfficialHomepageSignal(page(home).html),true)
 assert.equal(hasOfficialCareersSignal(page(careers).html),false)
 assert.throws(()=>extractPublicOpenings(page(careers).html),/United States careers/)
 await assert.rejects(run({fetchText:async url=>{reads.push(url);return page(url).html}}),/United States careers/)
 assert.deepEqual(reads,[home,home+'page-sitemap.xml',careers])
})

test('Numeric current notices preserve distinct named employers and the incomplete first application address',()=>{
 const raw=page(careers).html
 assert.match(raw,/<h1>\s*United States Careers\s*<\/h1>/)
 assert.match(raw,/November 16th, 2026/)
 const notices=raw.split(/<hr\s*\/?\s*>/i)
 assert.equal(notices.length,2)
 assert.match(notices[0],/Numeric Technologies Inc has openings for the position/)
 assert.match(notices[0],/SAP SD &amp; Integration Consultant|SAP SD & Integration Consultant/)
 assert.match(notices[0],/throughout the USA/)
 assert.match(notices[0],/e-mail:\s*jobs@numerictech(?!\.com)/)
 assert.doesNotMatch(notices[0],/mailto:jobs@numerictech\.com/)
 assert.match(notices[1],/Numeric Technologies &amp; Systems Integrator Inc/)
 assert.match(notices[1],/Senior SAP S\/4 HANA Consultant/)
 assert.match(notices[1],/mailto:jobs@numerictech\.com/)
})
