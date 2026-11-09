import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {detailModel,jobCards} from './nativeModels.js'

const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url)))),listing=packets.filter(p=>p.url?.includes('/alljob/?o=1')).flatMap(p=>jobCards(p.html)).find(p=>p.detailId==='310424207'),html=packets.find(p=>p.url===listing.detailUrl).html,options={stylesheets:packets.filter(p=>p.kind==='stylesheet').map(p=>({url:p.url,body:p.html}))}

test('Akulaku actual own-duty permanent stationing binds both foreign countries without choosing one',()=>{
 const job=detailModel(html,listing,options)
 assert.equal(job.location,'国外');assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,false);assert.equal(job.sourceNativeAllInterpretationsNonIndia,true)
 assert.deepEqual(job.sourceNativePermanentDutyWorksites.countries,['Germany','Spain']);assert.equal(job.sourceNativeCountryScopeResolution.kind,'generic-workplace-qualified-by-own-permanent-duty-clause')
 assert.ok(job.sourceNativeCountryInterpretations.some(model=>model.native==='国外'&&model.unresolved));assert.ok(job.sourceNativePermanentDutyWorksites.nativeClause.includes('常驻德国/西班牙'))
})

for(const value of['1.愿意常驻德国/西班牙，','1.赴德国/西班牙短期出差，','1.不常驻德国/西班牙，','1.负责相关业务，','1.常驻德国/Unpublished province，'])test('Akulaku nonstationing or unresolved own-duty wording never acquires a country: '+value,()=>{
 const changed=html.replace('1.常驻德国/西班牙，',value);assert.notEqual(changed,html)
 assert.equal(detailModel(changed,listing,options).sourceCountryScopeUnresolved,true)
})

test('Akulaku additional own-role worksite or duty-country conflicts cannot disappear behind permanent stationing',()=>{
 const field=html.replace('<div class="xiangqingtext">','<ul class="xiangqinglist"><li class="ntitle">工作国家：</li><li class="nvalue">India</li></ul><div class="xiangqingtext">')
 assert.notEqual(field,html);assert.equal(detailModel(field,listing,options).sourceCountryScopeUnresolved,true)
 const duty=html.replace('5.处理各类突发事件及其他相关工作。','5.工作地点：India；处理各类突发事件及其他相关工作。')
 assert.notEqual(duty,html);assert.equal(detailModel(duty,listing,options).sourceCountryScopeUnresolved,true)
 for(const alternative of['5.或在印度办公；','5.The role may work remotely from India;']){
  const changed=html.replace('5.处理各类突发事件及其他相关工作。',alternative+'处理各类突发事件及其他相关工作。');assert.notEqual(changed,html);assert.equal(detailModel(changed,listing,options).sourceCountryScopeUnresolved,true)
 }
})

test('Akulaku a structurally bound future explicit India stationing is a native public workplace fact',()=>{
 const changed=html.replace('1.常驻德国/西班牙，','1.常驻印度，');assert.notEqual(changed,html)
 const job=detailModel(changed,listing,options);assert.equal(job.country,'India');assert.equal(job.sourceCountryScopeUnresolved,false);assert.equal(job.sourceIndiaWorksiteQualified,true)
})
