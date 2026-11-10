import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readRole} from '../scraper/stantec.workday/nativeModels.js'
import {json} from '../scraper/stantec.workday/nativeDeclarations.js'

const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261110/stantec-state-location.json.gz',import.meta.url))))
const rows=packets.filter(row=>row.url.includes('/search?')&&row.url.includes('location=ind')).flatMap(row=>json(row.body).jobs)
const roleURL='https://microsites.dejobs.org/stantec-jobs/data/DD8859677F6D4E0993680CBF004F1184.json'
const packet=packets.find(row=>row.url===roleURL),original=json(packet.body),listing=rows.find(row=>row.guid===original.guid)
const at=Date.parse('2026-11-10T01:34:01.312Z')

// Requiring exactly country/city loses this genuine role once the publisher
// adds a state between the explicit India country and its native city.
test('Stantec reads an explicit India state and city worksite from its genuine current full role',()=>{
 assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.bodySha256)
 const role=readRole(original,listing,at)
 assert.equal(role.eligible,true);assert.equal(role.ghost,true)
 assert.deepEqual(role.bodyWorksites,['India | Pune','India | Andhra Pradesh | Visakhapatnam'])
 assert.equal(role.model.country,'India');assert.equal(role.model.country_short,'IND')
 assert.equal(role.model.city_exact,'Visakhapatnam');assert.equal(role.model.html_description,original.html_description)
 assert.ok(role.description.includes('India | Andhra Pradesh | Visakhapatnam'))
 assert.ok(role.description.length>1000)
})

for(const[name,replacement]of[
 ['a foreign country','Canada | Andhra Pradesh | Visakhapatnam'],
 ['an unresolved country','Remote | Andhra Pradesh | Visakhapatnam'],
 ['an unknown or foreign region','India | Ontario | Visakhapatnam'],
 ['a country used as the state','India | Canada | Visakhapatnam'],
 ['an empty state','India | | Visakhapatnam'],
 ['an empty city','India | Andhra Pradesh |'],
 ['an extra location component','India | Andhra Pradesh | Visakhapatnam | Canada'],
])test('Stantec still refuses '+name+' in a three-component worksite',()=>{
 const model=structuredClone(original)
 model.html_description=model.html_description.replace('India | Andhra Pradesh | Visakhapatnam',replacement)
 assert.notEqual(model.html_description,original.html_description)
 assert.throws(()=>readRole(model,listing,at),/body work-country conflicts or is unresolved/)
})

test('Stantec keeps each structured country alias mandatory for a body with an India state',()=>{
 assert.throws(()=>readRole({...original,country_short:'CAN'},listing,at),/role own country differs/)
})
