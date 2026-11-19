import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import manifest from './test-data/manifest-current-20261119.js'
import {run,hasOfficialHomepageSignal,extractOpenPositions} from './script.js'
import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'

const hash=value=>createHash('sha256').update(value).digest('hex')
const zipped=fs.readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))
assert.equal(hash(zipped),manifest.fixtureSha256)
const rows=JSON.parse(gunzipSync(zipped))
for(const row of rows)assert.equal(hash(row.html),row.sha256)
const home='https://jkfenner.com/',careers=home+'about-us/careers'
const page=url=>{const row=rows.findLast(row=>row.requestedUrl===url);assert.ok(row,'Unexpected read '+url);return row}

test('JK Fenner current Next homepage is held instead of reviving the retired India table',async()=>{
 const reads=[]
 assert.equal(hasOfficialHomepageSignal(page(home).html),false)
 await assert.rejects(run({fetchText:async url=>{reads.push(url);return page(url).html}}),/official homepage.*no longer matches/)
 assert.deepEqual(reads,[home])
 assert.throws(()=>extractOpenPositions(page(careers).html),/careers table.*no longer matches/)
 assert.equal(page(home+'career-list/').status,404)
})

test('JK Fenner current Flight stream cannot certify inventory when a record identity conflicts',()=>{
 assert.throws(()=>readLiteralFlightRecords(page(careers).html),/conflicting record b/)
})

test('JK Fenner explicitly declared public ZingHR selection is empty without proving employer-wide empty inventory',()=>{
 const key='d810dada-6d41-4a51-8243-c748e3835713'
 const iframe='https://zingnext.zinghr.com/zingtalent/career-website-config?CareerClientKey='+key
 const corporateClient=page('https://jkfenner.com/_next/static/chunks/2vchakbec6u8i.js').html
 assert.ok(corporateClient.includes(iframe))
 const configuration=JSON.parse(page('https://mservices.zinghr.com/recruitmentnext/v1/CareerConfiguration/GetCareerConfigurationDetailsByKey?CareerKey='+key).html)
 assert.equal(configuration.code,1)
 assert.equal(configuration.data.careerKey,key)
 const listing=page('https://mservices.zinghr.com/recruitmentnext/v1/CareerConfiguration/GetCareerRequisitionList')
 assert.equal(listing.method,'POST')
 assert.deepEqual(JSON.parse(listing.requestBody),{filter:{industryIds:[],jobRoleIds:[],workIds:[],workExperience:{minRange:0,maxRange:60},freshness:0},pageIndex:1,pageSize:12,searchText:'',careerKey:key})
 const payload=JSON.parse(listing.html)
 assert.equal(payload.code,1)
 assert.deepEqual(payload.data,{requisitionList:[],count:0})
 assert.equal(configuration.data.companyName,undefined)
})
