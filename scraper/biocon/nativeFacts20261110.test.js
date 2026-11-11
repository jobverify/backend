import assert from 'node:assert/strict'
import test from 'node:test'
import {extractSearchResults,extractDwrSearchResults,extractJobDetail,run,CAREERS_PAGE_URL,SUCCESSFACTORS_BOARD_URL} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

// Deliberately synthetic boundary controls; these are not historical captures.
const summary=(country,{department='Quality',id='1001'}={})=>`<title>Career Opportunities</title><p>Search Results</p><a href="${SUCCESSFACTORS_BOARD_URL}">Board</a><p>1 Jobs match the selections</p><tr class="jobResultItem"><td><a class="jobTitle">Scientist</a>${[id,'Posted on 11/09/2026','BIOCON LIMITED',department,country??''].map(value=>`<span class="jobContentEM">${value}</span>`).join('')}</td></tr>`
const dwr=country=>`throw 'allowScriptTagRemoting is false.';dwr.engine._remoteHandleCallback('0','0',${JSON.stringify({results:{postingCount:1,postings:[{id:1001,title:'Scientist',postingDate:'11/09/2026',otherValues:[[{fieldId:'legalEntity_obj',shortVal:'BIOCON LIMITED'},...(country===undefined?[]:[{fieldId:'filter1',shortVal:country}])]]}]}})});`
const detail=({country,location='Remote',id='1001',title='Scientist',criteria=true}={})=>`<h1>Career Opportunities: ${title} (${id})</h1><div>Requisition ID ${id} - Posted 11/09/2026 - BIOCON LIMITED - Quality${country?' - '+country:''}</div><h2>Job Location: ${location}</h2>${criteria?`<div><h2>Role Summary</h2></div><div><p>${'Develop pharmaceutical research and validate scientific methods. '.repeat(3)}</p></div></div><div><h2>Key Responsibilities</h2></div><div><p>${'Perform experiments, document evidence and maintain quality standards. '.repeat(3)}</p></div></div>`:''}`
const row=country=>({title:'Scientist',requisitionId:'1001',country})

for(const country of [undefined,''])test('Biocon HTML summary retains unknown country '+String(country),()=>{
 assert.equal(extractSearchResults(summary(country))[0].country,null)
})
for(const country of [undefined,''])test('Biocon DWR summary retains unknown country '+String(country),()=>{
 assert.equal(extractDwrSearchResults(dwr(country))[0].country,null)
})
test('Biocon empty department cannot shift the native country field',()=>{
 const value=extractSearchResults(summary('Malaysia',{department:''}))[0]
 assert.equal(value.country,'Malaysia')
 assert.equal(value.department,null)
})
test('Biocon full native detail preserves explicit foreign country',()=>{
 const value=extractJobDetail(detail({country:'Malaysia',location:'Penang, Malaysia'}),row('Malaysia'))
 assert.equal(value.country,'Malaysia')
 assert.equal(value.location,'Penang, Malaysia')
})
test('Biocon detail cannot invent India from missing country and remote location',()=>{
 const value=extractJobDetail(detail(),row(null))
 assert.equal(value.country,null)
 assert.equal(value.location,'Remote')
})
test('Biocon reconciles native country in its own requisition header',()=>{
 assert.equal(extractJobDetail(detail({country:'India',location:'Hyderabad'}),row(null)).country,'India')
})
test('Biocon conflicting native countries remain unresolved',()=>{
 assert.equal(extractJobDetail(detail({country:'Ireland',location:'Dublin, Ireland'}),row('India')).country,null)
})
test('Biocon native requisition and title must match the listing',()=>{
 assert.throws(()=>extractJobDetail(detail({country:'India',id:'9999'}),row('India')),/requisition|identity/i)
 assert.throws(()=>extractJobDetail(detail({country:'India',title:'Other role'}),row('India')),/title|identity/i)
})
test('Biocon location metadata cannot replace missing role criteria',()=>{
 assert.equal(extractJobDetail(detail({country:'India',criteria:false}),row('India')).jobDescription,null)
})
const careers=`<title>Careers at Biocon - Put your passion for science into practice</title><p>chance at Biocon to work alongside some of the brightest minds</p><a href="${SUCCESSFACTORS_BOARD_URL}">Now Hiring</a>`
const replay=country=>run({fetchText:async url=>url===CAREERS_PAGE_URL?careers:detail({country,location:country==='Malaysia'?'Penang, Malaysia':'Remote'}),getSearchPages:async()=>[summary(country)]})
test('Biocon registered source output cannot relabel a foreign role as India',async()=>{
 const jobs=await replay('Malaysia')
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'Malaysia')
})
test('Biocon retains unknown native rows as observations and holds cleanup',async()=>{
 const jobs=await replay(undefined)
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'biocon').observedVacancyCount,1)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

const inactiveFrames=[['hidden','<div hidden>','</div>'],['template','<template>','</template>'],['aria-hidden','<div aria-hidden="true">','</div>'],['display-none','<div style="display:none">','</div>'],['inert','<div inert>','</div>']]
for(const [label,open,close] of inactiveFrames){
 test('Biocon ignores '+label+' role criteria in their original ancestor context',()=>{
  const html=detail({country:'India',criteria:false})+open+'<div><div><h2>Role Summary</h2></div><div><p>'+('Develop pharmaceutical research and validate scientific methods. '.repeat(3))+'</p></div></div>'+close
  assert.equal(extractJobDetail(html,row('India')).jobDescription,null)
 })
 test('Biocon ignores '+label+' location in its original ancestor context',()=>{
  const html=detail().replace('<h2>Job Location: Remote</h2>',open+'<h2>Job Location: Hyderabad, India</h2>'+close)
  const value=extractJobDetail(html,row(null))
  assert.equal(value.country,null)
  assert.equal(value.location,null)
 })
 test('Biocon preserves the positional field for '+label+' summary country',()=>{
  const html=summary('India').replace('<span class="jobContentEM">India</span>',open+'<span class="jobContentEM">India</span>'+close)
  assert.equal(extractSearchResults(html)[0].country,null)
 })
}
test('Biocon hidden department cannot shift an active native country field',()=>{
 const html=summary('Malaysia').replace('<span class="jobContentEM">Quality</span>','<span hidden class="jobContentEM">Quality</span>')
 const value=extractSearchResults(html)[0]
 assert.equal(value.department,null)
 assert.equal(value.country,'Malaysia')
})
test('Biocon ignores summary rows inside inactive ancestors',()=>{
 for(const [,open,close] of inactiveFrames)assert.deepEqual(extractSearchResults(open+summary('India')+close),[])
})
test('Biocon rejects contradictory active requisition headers',()=>{
 const html=detail({country:'India'})+'<div>Requisition ID 9999 - Posted 11/09/2026 - BIOCON LIMITED - Quality - Ireland</div>'
 assert.throws(()=>extractJobDetail(html,row('India')),/requisition|identity/i)
})
test('Biocon inactive contradictory requisition headers cannot alter active identity',()=>{
 for(const [,open,close] of inactiveFrames){
  const html=detail({country:'India'})+open+'<div>Requisition ID 9999 - Posted 11/09/2026 - BIOCON LIMITED - Quality - Ireland</div>'+close
  assert.equal(extractJobDetail(html,row('India')).requisitionId,'1001')
 }
})
test('Biocon rejects ambiguous active location headings even with a matching listing country',()=>{
 const html=detail({country:'India',location:'Hyderabad, India'})+'<h2>Job Location: Dublin, Ireland</h2>'
 assert.throws(()=>extractJobDetail(html,row('India')),/location|identity|ambiguous/i)
})
test('Biocon inactive additional location headings cannot replace its own active worksite',()=>{
 for(const [,open,close] of inactiveFrames){
  const html=detail({country:'India',location:'Hyderabad, India'})+open+'<h2>Job Location: Dublin, Ireland</h2>'+close
  const value=extractJobDetail(html,row('India'))
  assert.equal(value.country,'India')
  assert.equal(value.location,'Hyderabad, India')
 }
})
