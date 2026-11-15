import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCargillOfficialRole,parseCargillRmkDetail,CargillSameCountryWorksiteDisagreement} from './nativeContract.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/brazil-office-20261115.json.gz',import.meta.url))))
const publicHTML=Buffer.from(fixture.public.bodyBase64,'base64').toString('utf8')
const nativeHTML=Buffer.from(fixture.native.bodyBase64,'base64').toString('utf8')
const official=(html=publicHTML)=>parseCargillOfficialRole(html,fixture.row,{now:fixture.capturedAt,deferIncompletePublicOffice:true})
const native=(html=nativeHTML)=>parseCargillRmkDetail(html,fixture.native.receipt.finalURL,official(),{now:fixture.capturedAt})

test('Cargill reads the current explicit Brazil and India public offices without extending India to Brazil',()=>{
  const role=official()
  assert.equal(role.requisitionId,'337666')
  assert.deepEqual(role.addresses.map(a=>a.addressCountry),['Brazil','India','Brazil'])
  assert.equal(role.addresses[0].addressLocality,'UBERLANDIA')
  assert.equal(role.addresses[1].addressLocality,'Bengaluru')
})

test('Cargill holds a Brazil-only native role even when its public recruitment copy includes an India office',()=>{
  assert.throws(()=>native(),error=>{
    assert.ok(error instanceof CargillSameCountryWorksiteDisagreement)
    assert.equal(error.validatedModel.nativeIndiaOfficeCorroborated,false)
    assert.equal(error.validatedModel.country,null)
    assert.deepEqual(error.validatedModel.locations,[])
    assert.deepEqual(error.validatedModel.nativeLocations,['Uberlandia, Minas Gerais, BR Brazil, 38402-350'])
    assert.ok(error.validatedModel.sourceDescription.length>1000)
    assert.equal(error.validatedModel.sourceScopeComplete,false)
    return true
  })
})

for(const [label,change] of [
  ['unknown public country',s=>s.replaceAll('"addressCountry":"Brazil"','"addressCountry":"Unknown"')],
  ['country code replacing a typed public country name',s=>s.replaceAll('"addressCountry":"Brazil"','"addressCountry":"BR"')],
]) test('Cargill Brazil support still rejects '+label,()=>{
  const changed=change(publicHTML)
  assert.notEqual(changed,publicHTML)
  assert.throws(()=>official(changed),/country or office/)
})

for(const [label,change] of [
  ['foreign native code conflict',s=>s.replaceAll('BR Brazil','IN Brazil')],
  ['native postal drift',s=>s.replaceAll('38402-350','38402350')],
  ['missing native country metadata',s=>s.replace('itemprop="addressCountry"','itemprop="unqualified-country"')],
  ['unrelated native requisition',s=>s.replaceAll('337666','999999')],
]) test('Cargill Brazil hold cannot swallow '+label,()=>{
  const changed=change(nativeHTML)
  assert.notEqual(changed,nativeHTML)
  assert.throws(()=>native(changed),error=>!(error instanceof CargillSameCountryWorksiteDisagreement))
})
