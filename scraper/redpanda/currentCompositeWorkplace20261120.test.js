import test from 'node:test'
import assert from 'node:assert/strict'
import {currentAuthority} from './currentPublisher20261120.js'
import {currentFeed} from './currentCollection20261120.js'
import {fixture,FEED,body,html} from './currentSourceCore20261120.test.js'

const original=JSON.parse(body(FEED)),id='7fa05bc1-b3b6-4a9c-95e9-3aded4773ad2'
const read=change=>{const value=structuredClone(original),row=value.jobs.find(row=>row.id===id);assert.equal(row.location,'US/Canada - Eastern Region');change?.(row);return currentFeed(JSON.stringify(value),currentAuthority(html,fixture.observedAt),fixture.observedAt)}
test('Redpanda composite workplace: actual explicit US and Canada alternatives retain the original typed primary country',()=>{const value=read(),row=value.rows.find(row=>row.id===id);assert.deepEqual(row.countries,['United States','Canada']);assert.equal(row.workplaces[0].country,'United States');assert.equal(row.workplaces[0].originalAddress.postalAddress.addressCountry,'United States');assert.equal(row.originalRecord.location,'US/Canada - Eastern Region');assert.equal(value.rows.length,12)})
for(const[label,change]of[
 ['India alternative',row=>{row.location='US/India - Eastern Region'}],
 ['unresolved APAC alternative',row=>{row.location='US/APAC - Eastern Region'}],
 ['unknown country alternative',row=>{row.location='US/Atlantis - Eastern Region'}],
 ['typed primary absent from alternatives',row=>{row.location='Canada/United Kingdom - Eastern Region'}],
 ['single Canadian workplace conflicts with US address',row=>{row.location='Canada - Eastern Region'}],
 ['India typed country',row=>{row.address.postalAddress.addressCountry='India'}],
 ['missing typed country',row=>{delete row.address.postalAddress.addressCountry}],
 ['India same-address region',row=>{row.address.postalAddress.addressRegion='India'}],
 ['additional India workplace',row=>{row.secondaryLocations.push({location:'Bengaluru, India',address:{postalAddress:{addressCountry:'India'}}})}],
 ['explicit semantic India criterion',row=>{row.descriptionHtml+='<section><div>Country</div><div>India</div></section>'}]
])test('Redpanda composite workplace: '+label+' remains held',()=>assert.throws(()=>read(change),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error'))
