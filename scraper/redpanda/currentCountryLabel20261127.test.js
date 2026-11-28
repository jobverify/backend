import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {currentAuthority,HOME,FEED} from './currentPublisher20261120.js'
import {currentFeed} from './currentCollection20261120.js'

const packets=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-country-label-20261127.json.gz',import.meta.url))))
const own=packets.find(packet=>packet.requestedUrl===HOME),feed=packets.find(packet=>packet.requestedUrl===FEED)
const at='2026-11-27T18:04:18.423Z',id='4c7f758f-3927-450e-8aa5-e10a9e81d7a7'
const authority=currentAuthority(own.body,at)
const originalRecord=JSON.parse(feed.body).jobs.find(record=>record.id===id)
function read(edit){
 const model=JSON.parse(feed.body),record=model.jobs.find(record=>record.id===id)
 assert.equal(record.location,'Spain - Remote')
 assert.equal(record.address,null)
 edit?.(record)
 return currentFeed(JSON.stringify(model),authority,at)
}

test('Redpanda preserves the current explicit Spain remote label when the native optional address is null',()=>{
 const collection=read(),row=collection.rows.find(row=>row.id===id)
 assert.equal(collection.rows.length,15)
 assert.deepEqual(row.countries,['Spain','Germany','United Kingdom'])
 assert.equal(row.workplaces[0].country,'Spain')
 assert.equal(row.workplaces[0].countrySource,'native-explicit-country-label')
 assert.equal(row.workplaces[0].address,null)
 assert.equal(row.workplaces[0].originalAddress,null)
 assert.equal(row.originalRecord.address,null)
 assert.equal(row.originalRecord.location,'Spain - Remote')
 assert.deepEqual(row.originalRecord,originalRecord)
 assert.deepEqual(row.originalCriteria,{originalHTML:originalRecord.descriptionHtml,originalPlain:originalRecord.descriptionPlain})
 assert.ok(row.originalCriteria.originalHTML.length>1000)
 assert.ok(collection.rows.every(row=>row.countries.length&&row.countries.every(country=>country!=='India')))
})

for(const[label,edit]of[
 ['city-only label',record=>{record.location='Madrid - Remote'}],
 ['unknown country label',record=>{record.location='Atlantis - Remote'}],
 ['India country label',record=>{record.location='India - Remote'}],
 ['worldwide country label',record=>{record.location='Worldwide - Remote'}],
 ['regional country label',record=>{record.location='EMEA - Remote'}],
 ['composite unknown primary country',record=>{record.location='Spain/India - Remote'}],
 ['remote flag contradiction',record=>{record.isRemote=false}],
 ['workplace type contradiction',record=>{record.workplaceType='OnSite'}],
 ['missing native address field',record=>{delete record.address}],
 ['present typed address without country',record=>{record.address={postalAddress:{'@type':'PostalAddress'}}}],
 ['typed primary country contradicts authored Spain',record=>{record.address={postalAddress:{addressCountry:'Germany'}}}],
 ['India secondary country',record=>{record.secondaryLocations[0].address.postalAddress.addressCountry='India'}],
 ['city-only secondary address',record=>{record.secondaryLocations.push({location:'Barcelona - Remote',address:null})}],
 ['explicit India role scope',record=>{record.workLocationCountry='India'}],
 ['different native employer',record=>{record.hiringOrganization={name:'Other Employer'}}],
 ['different native application',record=>{record.applyUrl='https://other.invalid/apply'}],
])test('Redpanda country labels still hold '+label,()=>{
 assert.throws(()=>read(edit),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')
})
