import assert from 'node:assert/strict'
import test from 'node:test'
import {createLocusScraper} from './script.js'
const careers='<title>Careers in Locus | Be the force behind the Magic in Motion | </title><h1>The Software Machine</h1><p>Life at Locus</p><a href="https://locus.darwinbox.in/ms/candidate/careers">Explore Open Roles</a>'
test('Locus follows its verified current Darwinbox handoff and preserves India descriptions',async()=>{
 const jobs=await createLocusScraper().run({fetchText:async()=>careers,fetchListingPage:async()=>({status:'success',job_counts:2,data:[{id:'a1',title:'Engineer',country:'India',locations:'Bengaluru, India',jd:'Build and operate logistics optimization systems',experience:'4 years'},{id:'a2',title:'Sales',country:'United States',locations:'San Francisco, United States',jd:'Develop accounts'}]})})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].company,'Locus')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].jobDescription,'Build and operate logistics optimization systems')
 assert.equal(jobs[0].sourceUrl,'https://locus.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a1')
})
test('Locus does not accept another Darwinbox tenant or replace access denial with zero jobs',async()=>{
 await assert.rejects(createLocusScraper().run({fetchText:async()=>careers.replace('locus.darwinbox.in','different.darwinbox.in'),fetchListingPage:async()=>({status:'success',job_counts:0,data:[]})}),/verified|handoff|careers/i)
 await assert.rejects(createLocusScraper().run({fetchText:async()=>careers,fetchListingPage:async()=>{throw Error('HTTP 403 for official Locus board')}}),/403|unavailable/i)
})

test('Locus retrieves every native page before India filtering and rejects incomplete or duplicate listings',async()=>{
 const pages=[]
 const jobs=await createLocusScraper().run({fetchText:async()=>careers,fetchListingPage:async({page})=>{pages.push(page);return {status:'success',job_counts:11,data:page===1?Array.from({length:10},(_,i)=>({id:'j'+i,title:'Engineer '+i,country:i===0?'India':'United States',locations:i===0?'Bengaluru, India':'United States',jd:'Build logistics systems'})):[{id:'j10',title:'Engineer 10',country:'India',locations:'Bengaluru, India',jd:'Build routing systems'}]}}})
 assert.deepEqual(pages,[1,2]);assert.equal(jobs.length,2)
 await assert.rejects(createLocusScraper().run({fetchText:async()=>careers,fetchListingPage:async()=>({status:'success',job_counts:11,data:[{id:'a1',title:'Engineer',country:'India',locations:'Bengaluru, India',jd:'Full description'}]})}),/incomplete|duplicate|count/i)
})
