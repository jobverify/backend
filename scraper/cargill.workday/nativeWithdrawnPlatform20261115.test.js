import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCargillOfficialRole,parseCargillRmkDetail,CargillNativeWithdrawnRole} from './nativeContract.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-withdrawn-platform-20261115.json.gz',import.meta.url))))
const publicHTML=Buffer.from(fixture.packets[0].bodyBase64,'base64').toString('utf8')
const nativeHTML=Buffer.from(fixture.packets[1].bodyBase64,'base64').toString('utf8')
const official=()=>parseCargillOfficialRole(publicHTML,fixture.row,{now:fixture.capturedAt,deferIncompletePublicOffice:true})
const native=html=>parseCargillRmkDetail(html,fixture.packets[1].url,official(),{now:fixture.capturedAt})

test('Cargill holds the current identity-bound Platform Engineer filled notice without certifying an empty inventory',()=>{
  assert.throws(()=>native(nativeHTML),error=>{
    assert.ok(error instanceof CargillNativeWithdrawnRole)
    assert.equal(error.withdrawalProof.requisitionId,'328292')
    assert.equal(error.withdrawalProof.nativeRmkPublicId,'1363455457')
    assert.equal(error.withdrawalProof.nativeStatus,'filled')
    assert.equal(error.withdrawalProof.countryQualified,false)
    assert.equal(error.withdrawalProof.criteriaQualified,false)
    assert.equal(error.withdrawalProof.sourceScopeComplete,false)
    assert.equal(error.withdrawalProof.lifecycleCleanupAllowed,false)
    return true
  })
})

for(const [label,change] of [
  ['different native requisition',s=>s.replaceAll('328292-en_US','999999-en_US')],
  ['different employer integration',s=>s.replaceAll('urn:li:organization:2678','urn:li:organization:9999')],
  ['missing native filled notice',s=>s.replaceAll('Sorry, this position has been filled.','Current status is unavailable.')],
  ['contradictory active role metadata',s=>s.replace('</head>','<meta itemprop="addressCountry" content="IN"></head>')],
  ['uppercase JSON-LD role declaration',s=>s.replace('</head>','<script type="APPLICATION/LD+JSON">{"@type":"JobPosting","title":"Active conflicting role"}</script></head>')],
  ['parameterized JSON-LD role declaration',s=>s.replace('</head>','<script type="application/ld+json; charset=utf-8">{"@type":"JobPosting"}</script></head>')],
  ['trailing-slash JobPosting scope',s=>s.replace('</body>','<section itemscope itemtype="https://schema.org/JobPosting/"></section></body>')],
  ['JobPosting in multiple item types',s=>s.replace('</body>','<section itemscope itemtype="https://schema.org/JobPosting https://schema.org/Thing"></section></body>')],
  ['inert native requisition code',s=>s.replace(/<script\b[^>]*data-company-job-code="328292-en_US"[^>]*>[\s\S]*?<\/script>/,m=>'<template>'+m+'</template>')],
  ['inert frame-protection program',s=>s.replace(/<script\b[^>]*id="antiClickJackScript"[^>]*>[\s\S]*?<\/script>/,m=>'<template>'+m+'</template>')],
  ['inert frame-protection style',s=>s.replace(/<style\b[^>]*id="antiClickjack"[^>]*>[\s\S]*?<\/style>/,m=>'<template>'+m+'</template>')],
]) test('Cargill Platform Engineer withdrawal guard rejects '+label,()=>{
  const changed=change(nativeHTML)
  assert.notEqual(changed,nativeHTML)
  assert.throws(()=>native(changed),error=>!(error instanceof CargillNativeWithdrawnRole))
})
