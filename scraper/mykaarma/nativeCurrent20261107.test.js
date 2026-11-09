import test from 'node:test'
import assert from 'node:assert/strict'
import {replayCurrent,currentFixture,mutateNext} from './replayCurrent20261107.js'
globalThis.fetch=()=>{throw Error('MYKAARMA NETWORK FORBIDDEN')}
test('actual32 full native own models qualify seven India records despite renewed graphic leases only',async()=>{const r=await replayCurrent();assert.equal(r.jobs.length,7);assert.equal(r.calls.length,32);assert.equal(r.output.nativeCollectionEvidence.observations.length,15);assert.equal(r.output.nativeCollectionEvidence.observedNativeLocationRows,20);for(const j of r.jobs){assert.equal(j.country,'India');assert.equal(j.nativeEmployer,'myKaarma');assert.equal(j.nativeLegalEmployer,null);assert.equal(j.postedAt,null);assert.equal(j.closingDate,null);assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.ok(j.jobDescription.length>3000);assert.ok(j.nativeApplicationRecord.jobPost.activeJobApplication.basicQuestions.length>=4);assert.equal(j.nativeRoleClosingReconciled,true)}})

import {listing,role,equalRecord,E} from './nativeContract20261107.js'
const packets=currentFixture().packets,embed=packets.find(p=>p.requestedURL===E),groups=listing(Buffer.from(embed.bodyBase64,'base64').toString()).groups,group=groups.find(g=>g.country==='IN'),original=packets.find(p=>p.requestedURL===group.identity.url)
function own(change=()=>{},htmlChange=s=>s){const p={...original,body:Buffer.from(original.bodyBase64,'base64')};mutateNext(p,change);p.body=Buffer.from(htmlChange(p.body.toString()));return role(p.body.toString(),group,'role',currentFixture().expected.nativeCollectionEvidence.startedAt)}
for(const [name,change] of [
 ['additional mandatory criteria',(_,a)=>{a.jobPost.description.mandatoryRequirements='A new mandatory certification is required'}],
 ['nested employer authority',(_,a)=>{a.jobPost.metadata={organization:{name:'Other employer'}}}],
 ['nested typed country',(_,a)=>{a.jobPost.metadata={country:{name:'India',code:'US'}}}],
 ['nested address country',(_,a)=>{a.jobPost.metadata={address:{addressCountry:'US'}}}],
 ['unlisted status',(_,a)=>{a.jobPost.unlistedFromSearch=true}],
 ['internal status',(_,a)=>{a.jobPost.isInternal=true}],
 ['closed status',(_,a)=>{a.jobPost.isClosed=true}],
 ['new publication carrier',(_,a)=>{a.jobPost.datePosted='2026-11-07T00:00:00Z'}],
 ['new closing carrier',(_,a)=>{a.jobPost.validThrough='2026-11-09T00:00:00Z'}],
 ['new structured role schema',(_,a)=>{a.jobPost.jsonLd={'@type':'JobPosting',jobLocation:{addressCountry:'US'}}}],
 ['missing required resume config',(_,a)=>{a.jobPost.activeJobApplication.basicQuestions.find(q=>q.oid==='resume').required=false}],
 ])test('full native own record holds '+name+' with original new carrier retained',()=>{const r=own(change);assert.ok(r.issues.length>0);assert.ok(r.a.jobPost)})
for(const [name,insert]of [
 ['hidden authored criteria','<div hidden>Additional mandatory qualification: certification required</div>'],
 ['name country metadata','<meta name="country" content="India">'],
 ['property address country metadata','<meta property="addressCountry" content="IN">'],
 ['itemprop country metadata','<meta itemprop="addressCountry" content="IN">'],
 ['itemtype employer metadata','<div itemtype="https://schema.org/Organization"></div>'],
 ['template authored criteria','<template>Additional mandatory qualification: certification required</template>'],
 ['noscript authored criteria','<noscript>Additional mandatory qualification: certification required</noscript>'],
 ])test('all retained authored role carriers hold '+name,()=>{assert.ok(own(()=>{},s=>s.replace('</body>',insert+'</body>')).issues.length>0)})
for(const [name,change]of [
 ['wrong own employer',(_,a)=>{a.jobPost.companyName='Other employer'}],
 ['wrong own UUID',(_,a)=>{a.jobPost.uuid='11111111-1111-1111-1111-111111111111'}],
 ['wrong own URL',(_,a)=>{a.jobPost.url='https://ats.rippling.com/other/jobs/'+group.identity.id}],
 ['impossible creation calendar',(_,a)=>{a.jobPost.createdOn='2026-02-30T00:00:00Z'}],
 ['foreign own workplace',(_,a)=>{a.jobPost.workLocations=['NOIDA, United States']}],
 ])test('native identity/calendar rejects '+name,()=>assert.throws(()=>own(change),/employer|UUID|URL|calendar|worksite/))
for(const [name,change]of [
 ['country name/code contradiction',l=>{l.country='India';l.countryCode='US'}],
 ['city-only missing typed country',l=>{l.country='';l.countryCode=''}],
 ['Indiana cannot infer India',l=>{l.country='Indiana';l.countryCode='IN'}],
 ['unknown nonempty nested country',l=>{l.address={country:{name:'India',code:'US'}}}],
 ])test('whole native listing retains and holds '+name,()=>{const p={body:Buffer.from(embed.bodyBase64,'base64')};mutateNext(p,n=>change(n.props.pageProps.dehydratedState.queries.find(q=>q.queryKey?.[2]==='job-posts').state.data.items[0].locations[0]));const g=listing(p.body.toString()).groups[0];assert.ok(g.issues.length>0);assert.ok(g.rows[0].locations[0])})
test('empty optional metadata remains raw uncertainty',()=>{const r=own((_,a)=>{a.jobPost.additionalCountry=null});assert.equal(r.a.jobPost.additionalCountry,null);assert.equal(r.issues.length,0)})
test('renewed graphic lease never hides another native business change',()=>{const a=currentFixture().expected.nativeCollectionEvidence.observations.find(o=>o.country==='IN').nativeOpeningRecord,b=structuredClone(a);b.jobPost.employmentType.id='Changed native employment contract';assert.equal(equalRecord(a,b,'negative',{graphicLeaseDifferences:[]}),false)})
test('closing native employment contract drift holds full actual raw role',async()=>{const r=await replayCurrent({strictOrder:false,change:ps=>{const rows=ps.filter(p=>p.requestedURL===group.identity.url);mutateNext(rows[1],(_,a)=>{a.jobPost.employmentType.id='Changed native employment contract'})}});assert.equal(r.jobs.length,6);const held=r.output.nativeCollectionEvidence.observations.find(o=>o.id===group.identity.id);assert.equal(held.disposition,'held-native-role');assert.equal(held.nativeClosingRecord.jobPost.employmentType.id,'Changed native employment contract');assert.ok(held.qualificationIssues.includes('own-role-closing-whole-model-contradiction'))})
