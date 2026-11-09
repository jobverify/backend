import assert from 'node:assert/strict'
import test from 'node:test'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {literalRecruitmentPageData} from '../scraper-support/utils/recruitmentPageData.js'

// Amedisys and SiriusXM publish two identical searchConfig assignments in the
// same active response. This control retains only their declaration shape.
const config={stretchDefault:10,stretchOptions:[{value:'0',display:'UI.EXACT'}],
 contextSettings:{defaultContext:'careers',currentContext:'careers',currentClient:'example',
 contextDefinitions:[{name:'careers',urlPath:'/careers',displayName:'Example Careers'}]},
 hideCurrentLocation:false,logoutRedirectUrl:''}
const page=(second=config,name='searchConfig')=>readNativeDocument('<script>var '+name+'='+JSON.stringify(config)+';</script>'
 +'<script>window.'+name+'='+JSON.stringify(second)+';</script>')

test('identical current public search settings are one data contract',()=>{
 const data=literalRecruitmentPageData(page(),'searchConfig')
 assert.deepEqual(data,{config,ddo:null})
})

test('different public search settings remain ambiguous',()=>{
 assert.throws(()=>literalRecruitmentPageData(page({...config,hideCurrentLocation:true}),'searchConfig'),/ambiguous/)
})

test('public search declaration repetition cannot relax native account ambiguity',()=>{
 for(const name of ['phApp','workday','_jibe','khConfig'])assert.throws(()=>literalRecruitmentPageData(page(config,name),name),/ambiguous/)
})

test('duplicate declarations cannot turn executable search settings into native data',()=>{
 const doc=readNativeDocument('<script>var searchConfig='+JSON.stringify(config)+';</script><script>window.searchConfig=chooseSettings();</script>')
 assert.throws(()=>literalRecruitmentPageData(doc,'searchConfig'),/literal/)
})


test('an identical pair cannot hide a conflicting third active declaration',()=>{
 const doc=readNativeDocument('<script>var searchConfig='+JSON.stringify(config)+';</script>'
  +'<script>window.searchConfig='+JSON.stringify(config)+';</script>'
  +'<script>searchConfig='+JSON.stringify({...config,logoutRedirectUrl:'/private'})+';</script>')
 assert.throws(()=>literalRecruitmentPageData(doc,'searchConfig'),/ambiguous/)
})

test('inert conflicting copies do not change identical active public settings',()=>{
 const active='<script>window.searchConfig='+JSON.stringify(config)+';</script>'
 const conflict='<script>window.searchConfig='+JSON.stringify({...config,hideCurrentLocation:true})+';</script>'
 const doc=readNativeDocument(active+'<template>'+conflict+'</template><div hidden>'+conflict+'</div>'+active)
 assert.deepEqual(literalRecruitmentPageData(doc,'searchConfig'),{config,ddo:null})
})

test('inert search settings cannot grant a native search contract',()=>{
 const doc=readNativeDocument('<template><script>window.searchConfig='+JSON.stringify(config)+';</script></template>')
 assert.equal(literalRecruitmentPageData(doc,'searchConfig'),null)
})

test('repeated public settings cannot hide duplicate native object keys',()=>{
 const doc=readNativeDocument('<script>var searchConfig='+JSON.stringify(config)+';</script>'
  +'<script>window.searchConfig={hideCurrentLocation:false,hideCurrentLocation:false};</script>')
 assert.throws(()=>literalRecruitmentPageData(doc,'searchConfig'),/duplicate/)
})
