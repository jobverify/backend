import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'

import {composeLeverDescription} from '../utils/leverDescription.js'

// Genuine unchanged full native models, captured before this content repair.
// US/AR records prove content preservation only, never current India eligibility.
const compressed=readFileSync(new URL('./fixtures/lever-description-asapp-20261115.json.gz',import.meta.url))
const sha=value=>createHash('sha256').update(value).digest('hex')
assert.equal(sha(compressed),'41b95326ca19a9d2522cd69239ee7ebb4357a769f66cedf2cd066c138a155a63')
const fixture=JSON.parse(gunzipSync(compressed))
assert.equal(fixture.packets.length,1)
const raw=Buffer.from(fixture.packets[0].bodyBase64,'base64')
assert.equal(raw.length,123367)
assert.equal(sha(raw),'0b12a8057cd46848edda867c7371ab12f96b8a3c63563b5866cb077965fc0ce2')
const rows=JSON.parse(raw)
assert.equal(rows.length,10)
const withSalary=rows.filter(row=>row.salaryDescriptionPlain?.trim())
assert.equal(withSalary.length,6)
// Golden hashes of the entire previous composition bind every introduction,
// responsibility/qualification list, additional clause and their exact order.
const previous={
 'fe798f4c-76ea-44c4-ac24-4de18fb4931d':'a242703a0e077b531ad217bd47093436d8775371c48919f1677a318e42a86746',
 '32ffad62-1dd9-4273-8902-f3b7a82fb35c':'4b480764cf6fe45c85300d853338e0a2ecdf1153936422f818ff834b7e8b81da',
 'e04969d2-f495-4d4a-bd4e-83d5b6bd0f8f':'6277af6292930f50977339f74b98e791c96d7f499d392ab2797ac73f4943f430',
 'e4d0d412-5ad0-49ec-bd25-9d56f6ba5572':'5d5beef8f70ec3c91cddc108ccf290173dfe5fa3bbd98baec3155b8990e1adc0',
 'bc27c0a9-9f84-4ed8-a7a8-7e8ea2426fae':'06664ee08532c9a86680637534a71b47ab15f1b9fac62528de121f98b9329486',
 '186188dd-2a70-4116-bf66-f99e95c3f38c':'8b5adb97860a61da4a7085390fa94d4d95612427ca6807a890172ad399aa7e01',
 '5f35e3f9-7885-4aad-9b0a-4b19740999f3':'baafb63aa3e052853f503f430bfffc7205ccb112cb10e0d718e9f57d7f9f7f9a',
 'a0d90971-fbe4-4245-bffc-516a2d3ca0c9':'be182dbe15ed0d3d44111a7361710f9c251533533082077b9d318607465c8fec',
 '3ad3aa9f-07d7-4af3-9997-fe3d1ae2f5c8':'a7f8cdea3b31287d7587f99cf7ee89034b0070900c24dc77845ee313972fdc7d',
 'd04a1f0c-6ea9-4253-aa29-62337e179980':'89a41e38399aadeea0141a612ab2d32d143846944179eba0fab9f58b28a10251',
}

for(const row of withSalary){
 test('genuine full native salary plus every prior criterion survives '+row.id,()=>{
  const original=structuredClone(row),salary=row.salaryDescription.trim(),output=composeLeverDescription(row)
  assert.equal(row.country,'US')
  assert.ok(output.endsWith('\n\n'+salary),'Missing complete native salary HTML')
  assert.equal(sha(output.slice(0,-('\n\n'+salary).length)),previous[row.id])
  assert.deepEqual(row,original)
 })
 test('an extra qualification in only the genuine plain variant holds '+row.id,()=>{
  const changed=structuredClone(row)
  changed.salaryDescriptionPlain+='\nAn additional professional qualification is required.'
  assert.equal(composeLeverDescription(changed),null)
 })
}
for(const row of rows.filter(row=>!row.salaryDescriptionPlain?.trim()))test('genuine absent salary preserves exact prior output '+row.id,()=>{
 const original=structuredClone(row)
 assert.equal(sha(composeLeverDescription(row)),previous[row.id])
 assert.deepEqual(row,original)
})

const base=()=>({descriptionPlain:'Original introduction.',description:'<p>Original introduction.</p>',
 lists:[{text:'Responsibilities',content:'<li>Keep every responsibility.</li>'},
 {text:'Required qualifications',content:'<li>Keep every required qualification.</li>'},
 {text:'Preferred qualifications',content:'<li>Keep every preferred qualification.</li>'}],
 additionalPlain:'Original benefits and employer conditions.'})
const originalOutput='Original introduction.\n\nResponsibilities\n<li>Keep every responsibility.</li>\n\nRequired qualifications\n<li>Keep every required qualification.</li>\n\nPreferred qualifications\n<li>Keep every preferred qualification.</li>\n\nOriginal benefits and employer conditions.'
const withVariants=(plain,html)=>({...base(),salaryDescriptionPlain:plain,salaryDescription:html})

test('the complete new salary section follows the unchanged original section order',()=>{
 assert.equal(composeLeverDescription(withVariants('Bonus and equity.','<p>Bonus and equity.</p>')),originalOutput+'\n\n<p>Bonus and equity.</p>')
})
test('a native plain-only salary section is retained verbatim',()=>{
 assert.equal(composeLeverDescription(withVariants('Qualification-dependent bonus.\nEquity follows vesting conditions.',undefined)),originalOutput+'\n\nQualification-dependent bonus.\nEquity follows vesting conditions.')
})
test('a native HTML-only salary section keeps original links, attributes and full criteria',()=>{
 const html='<p data-native-condition="full">Bonus and <a href="https://example.test/plan?type=equity&amp;year=2026">equity</a>.</p>'
 assert.equal(composeLeverDescription(withVariants(null,html)),originalOutput+'\n\n'+html)
})
test('equal plain/HTML variants retain the complete HTML once including every native link',()=>{
 const html='<p>Bonus &amp; equity: <a href="https://example.test/terms">review terms</a>.</p>'
 assert.equal(composeLeverDescription(withVariants('Bonus & equity: review terms.',html)),originalOutput+'\n\n'+html)
})
test('equivalent whitespace and a single native entity layer do not duplicate criteria',()=>{
 const html='<div>Bonus &amp; equity.</div><div>&nbsp;</div><div>Conditions apply.</div>'
 assert.equal(composeLeverDescription(withVariants('Bonus & equity.\n\u00a0\nConditions apply.\n',html)),originalOutput+'\n\n'+html)
})
test('a qualification added to both genuine variants is propagated in full',()=>{
 const row=structuredClone(withSalary[0]),extra='A qualification review is required before any equity grant.'
 row.salaryDescriptionPlain+='\n'+extra
 row.salaryDescription+='<div>'+extra+'</div>'
 const output=composeLeverDescription(row),salary=row.salaryDescription.trim()
 assert.ok(output.endsWith('\n\n'+salary))
 assert.equal(sha(output.slice(0,-('\n\n'+salary).length)),previous[row.id])
})

for(const [label,plain,html] of [
 ['different monetary amounts','The annual bonus is USD 100.','<p>The annual bonus is USD 1000.</p>'],
 ['opposite eligibility','You are eligible for commissions.','<p>You are not eligible for commissions.</p>'],
 ['a missing native benefit','Bonus and pension contributions.','<p>Bonus.</p>'],
 ['an additional HTML qualification','Bonus.','<p>Bonus.</p><p>A professional qualification is required.</p>'],
 ['an additional plain qualification','Bonus. A professional qualification is required.','<p>Bonus.</p>'],
 ['changed clause order','Bonus. Equity.','<p>Equity. Bonus.</p>'],
 ['double-encoded HTML is not silently decoded twice','Bonus & equity.','<p>Bonus &amp;amp; equity.</p>'],
 ['nonempty hidden HTML cannot reconcile active plain criteria','Bonus.','<p hidden>Bonus.</p>'],
 ['nonempty inert HTML cannot reconcile active plain criteria','Bonus.','<template><p>Bonus.</p></template>'],
])test('unreconciled salary variants hold: '+label,()=>assert.equal(composeLeverDescription(withVariants(plain,html)),null))

test('supplied non-string salary variants hold rather than drop unknown criteria',()=>{
 for(const value of [0,100,false,{},[],['Bonus.']]){
  assert.equal(composeLeverDescription(withVariants(value,'<p>Bonus.</p>')),null)
  assert.equal(composeLeverDescription(withVariants('Bonus.',value)),null)
 }
})
test('absent, null, empty or markup-only salary sections preserve the exact prior output',()=>{
 for(const [plain,html] of [[undefined,undefined],[null,null],['',''],[' \n ','<p> </p>'],['','<!-- no salary -->'],['','<div>&nbsp;</div>']]){
  assert.equal(composeLeverDescription(withVariants(plain,html)),originalOutput)
 }
 assert.equal(composeLeverDescription(withVariants('Bonus.','<p><span> \u00a0<br></span></p>')),originalOutput+'\n\nBonus.')
 assert.equal(composeLeverDescription(),null)
})
test('salary range fields never fabricate a separate salary description',()=>{
 assert.equal(composeLeverDescription({...base(),salaryRange:{min:100,max:200,currency:'USD',interval:'year'}}),originalOutput)
})
test('salary terms alone cannot replace otherwise missing original role content',()=>{
 for(const row of[
  {salaryDescriptionPlain:'Bonus and equity are qualification dependent.'},
  {descriptionPlain:' ',lists:[],additional:'',salaryDescription:'<p>Bonus and equity are qualification dependent.</p>'},
  {lists:[{text:'Qualifications',content:''}],salaryDescriptionPlain:'Bonus.',salaryDescription:'<p>Bonus.</p>'},
 ])assert.equal(composeLeverDescription(row),null)
})
for(const [name,extra]of[
 ['hidden','<p hidden>Mandatory professional certification.</p>'],
 ['inert','<p inert>Mandatory professional certification.</p>'],
 ['aria-hidden','<p aria-hidden="true">Mandatory professional certification.</p>'],
 ['display:none','<p style="display:none">Mandatory professional certification.</p>'],
 ['visibility:hidden','<p style="visibility:hidden">Mandatory professional certification.</p>'],
 ['content-visibility:hidden','<p style="content-visibility:hidden">Mandatory professional certification.</p>'],
 ['template','<template><p>Mandatory professional certification.</p></template>'],
 ['object fallback','<object>Mandatory professional certification.</object>'],
 ['raw textarea','<textarea>Mandatory professional certification.</textarea>'],
 ['script','<script>window.mandatoryCertification=true</script>'],
 ['style','<style>.condition{display:none}</style>'],
 ['data value','<data value="Mandatory professional certification."></data>'],
 ['input value','<input value="Mandatory professional certification.">'],
 ['unknown semantic element','<certification-rule value="Mandatory professional certification."></certification-rule>'],
 ['unsupported tag','<condition!>Mandatory professional certification.</condition!>'],
])test('mixed active salary and unqualified '+name+' conditions hold',()=>{
 const html='<p>Bonus.</p>'+extra
 assert.equal(composeLeverDescription(withVariants('Bonus.',html)),null)
 assert.equal(composeLeverDescription(withVariants(null,html)),null)
})
test('malformed salary HTML returns null rather than an uncaught parser failure',()=>{
 for(const html of['<p title="unterminated>Bonus.</p>','<p title="&#999999999999999;">Bonus.</p>']){
  assert.equal(composeLeverDescription(withVariants('Bonus.',html)),null)
  assert.equal(composeLeverDescription(withVariants(null,html)),null)
 }
})
test('unsupported attribute-only or executable HTML cannot masquerade as an absent salary variant',()=>{
 for(const html of['<data value="Mandatory professional certification."></data>','<input value="Mandatory professional certification.">','<script>window.mandatoryCertification=true</script>','<style>.condition{display:none}</style>']){
  assert.equal(composeLeverDescription(withVariants('Bonus.',html)),null)
  assert.equal(composeLeverDescription(withVariants(null,html)),null)
 }
})
test('an otherwise empty salary element cannot discard its native required qualification attribute',()=>{
 const html='<p data-required-qualification="Native professional licence"></p>'
 for(const plain of['Bonus.',null])assert.equal(composeLeverDescription(withVariants(plain,html)),null)
})
test('an otherwise empty native salary link cannot discard its independent award conditions',()=>{
 const html='<a href="https://own.example/native-award-conditions"></a>'
 for(const plain of['Bonus.',null])assert.equal(composeLeverDescription(withVariants(plain,html)),null)
})
test('unknown fields and original country/location models remain unchanged',()=>{
 const row={...withVariants('Bonus.','<p>Bonus.</p>'),country:'US',categories:{location:'United States',allLocations:['United States','Unknown original alternative']},unknownNative:{criteria:['retain native original']}}
 const original=structuredClone(row)
 assert.equal(composeLeverDescription(row),originalOutput+'\n\n<p>Bonus.</p>')
 assert.deepEqual(row,original)
})
