import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parseDetail} from './nativeContract.js'
import {readNativeDocument,nativeDescendants} from './nativeHtml.js'
import {createNativeRoleAvailability,readNativeRoleAvailability} from '../../scraper-support/utils/sourceAvailability.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/attractions-employer-20261125.json.gz',import.meta.url))))
const {packet,row,now}=fixture
const bytes=Buffer.from(packet.bodyBase64,'base64')
assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
assert.equal(bytes.toString('utf8'),packet.body)
assert.equal(packet.status,200)
assert.equal(packet.finalURL,row.url)
const d=readNativeDocument(packet.body),section=d.nodes(node=>node.attrs.id==='job-details-3')[0]
const witness=nativeDescendants(section,node=>node.tag==='p'&&/^This position is with/.test(d.text(node)))[0]
const rawWitness=packet.body.slice(witness.start,witness.end)
const inlineWitness=tag=>rawWitness.replace(/(<p\b[^>]*>)([\s\S]*)(<\/p>)$/i,(_whole,open,content,close)=>open+'<'+tag+'>'+content+'</'+tag+'>'+close)
const nestedWitness=rawWitness.replace(/(<p\b[^>]*>)([\s\S]*)(<\/p>)$/i,(_whole,open,content,close)=>open+'<span><q>'+content+'</q></span>'+close)

test('Disney qualifies its current Attractions Technology employer from the exact own-role business declaration',()=>{
 const job=parseDetail(packet.body,row,now)
 assert.equal(job.jobId,'10163097')
 assert.equal(job.nativeJobId,'103673916608')
 assert.equal(job.nativeLegalEmployer,'Walt Disney Attractions Technology LLC')
 assert.equal(job.nativePostingBrand,'Disney Experiences')
 assert.equal(job.country,'India')
 assert.equal(job.city,'Bengaluru')
 assert.equal(job.sourceDetailComplete,true)
 assert.equal(job.sourceListingComplete,false)
 assert.equal(job.sourceScopeComplete,false)
 assert.equal(job.nativeEmployerBinding.legalEmployer,'Walt Disney Attractions Technology LLC')
 assert.equal(job.nativeEmployerBinding.business,'Disney Experiences')
 assert.equal(job.nativeEmployerBinding.evidenceURL,row.url)
 assert.equal(job.nativeEmployerBinding.nativeDeclaration,'This position is with Walt Disney Attractions Technology LLC, which is part of a business we call Disney Experiences.')
})

for(const [label,replacement] of [
 ['missing',''],
 ['hidden','<div hidden>'+rawWitness+'</div>'],
 ['inert','<div inert>'+rawWitness+'</div>'],
 ['template','<template>'+rawWitness+'</template>'],
 ['quoted','<blockquote>'+rawWitness+'</blockquote>'],
 ['code','<pre>'+rawWitness+'</pre>'],
 ...['q','code','blockquote','pre'].map(tag=>['inline '+tag,inlineWitness(tag)]),
 ['nested inline quote',nestedWitness],
 ['other employer',rawWitness.replaceAll('Walt Disney Attractions Technology LLC','Unrelated Technology LLC')],
 ['other business',rawWitness.replaceAll('Disney Experiences','Unrelated Experiences')],
])test('Disney rejects the newly qualified employer when its own binding is '+label,()=>{
 assert.throws(()=>parseDetail(packet.body.replace(rawWitness,replacement),row,now),/employer|business|declaration/i)
})

test('Disney still rejects an unreviewed legal employer with otherwise matching native identity',()=>{
 assert.throws(()=>parseDetail(packet.body.replaceAll('Walt Disney Attractions Technology LLC','Unrelated Technology LLC'),row,now),/legal employer/i)
})

test('Disney requires the qualified business brand for Attractions Technology',()=>{
 const body=packet.body.replaceAll('data-tm-job-posting-brand="Disney Experiences"','data-tm-job-posting-brand="The Walt Disney Company (Corporate)"')
 assert.throws(()=>parseDetail(body,{...row,brand:'The Walt Disney Company (Corporate)'},now),/employer|business/i)
})

test('Disney employer qualification cannot override contradictory employer metadata',()=>{
 assert.throws(()=>parseDetail(packet.body.replace('content="391,Walt Disney Attractions Technology LLC"','content="391,Unrelated Technology LLC"'),row,now),/employer.*metadata/i)
})

test('Disney employer qualification retains the independent typed India country proof',()=>{
 assert.throws(()=>parseDetail(packet.body.replaceAll('Bengaluru~Karnataka~India','Bengaluru~Karnataka~United States'),row,now),/country|city|legal employer/i)
})

const availabilityJob=()=>({source:'disney',company:'Disney',jobId:'10163097',nativeRequisitionId:'10163097',nativeJobId:'103673916608',
 title:'Sr Software Engineer',sourceUrl:row.url,nativeLegalEmployer:'Walt Disney Attractions Technology LLC',nativePostingBrand:'Disney Experiences',
 nativeListingLocation:'Bengaluru, India',sourceDetailComplete:true,sourceDescription:d.text(nativeDescendants(section,node=>d.hasClass(node,'ats-description'))[0])})

test('Disney availability independently rebuilds the new qualified employer from its original full native snapshot',()=>{
 const job=availabilityJob()
 job.sourceAvailabilityEvidence=createNativeRoleAvailability(job,{state:'open',observedAt:now,evidenceHtml:packet.body})
 const result=readNativeRoleAvailability(job)
 assert.equal(result.validated,true)
 assert.equal(result.state,'open')
 assert.equal(result.employer,'Walt Disney Attractions Technology LLC')
})

for(const [label,body] of [
 ['missing business declaration',packet.body.replace(rawWitness,'')],
 ['hidden business declaration',packet.body.replace(rawWitness,'<div hidden>'+rawWitness+'</div>')],
 ['quoted business declaration',packet.body.replace(rawWitness,'<blockquote>'+rawWitness+'</blockquote>')],
 ...['q','code','blockquote','pre'].map(tag=>['inline '+tag+' business declaration',packet.body.replace(rawWitness,inlineWitness(tag))]),
 ['nested inline quote business declaration',packet.body.replace(rawWitness,nestedWitness)],
 ['contradictory business declaration',packet.body.replace(rawWitness,rawWitness.replace('Disney Experiences','Unrelated Experiences'))],
])test('Disney availability refuses new employer proof with '+label,()=>{
 assert.throws(()=>createNativeRoleAvailability(availabilityJob(),{state:'open',observedAt:now,evidenceHtml:body}),/employer|business|scope/i)
})

test('Disney availability refuses a cross-brand Attractions Technology role even with matching native header fields',()=>{
 const job={...availabilityJob(),nativePostingBrand:'The Walt Disney Company (Corporate)'}
 const body=packet.body.replaceAll('data-tm-job-posting-brand="Disney Experiences"','data-tm-job-posting-brand="The Walt Disney Company (Corporate)"')
 assert.throws(()=>createNativeRoleAvailability(job,{state:'open',observedAt:now,evidenceHtml:body}),/employer|business|brand|scope/i)
})
