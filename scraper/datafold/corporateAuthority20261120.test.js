import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import test from'node:test';import assert from'node:assert/strict';import{readHome,HOME}from'./currentProgrammeData.js';
const text=gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-20261120.html.gz',import.meta.url))).toString(),sha=value=>createHash('sha256').update(value).digest('hex'),manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/corporate-20261120.manifest.json',import.meta.url)));
assert.equal(sha(text),manifest.sha256);
const read=body=>readHome({url:HOME,text:body,hash:sha(body),status:200});
test('actual current corporate publication keeps its exact active native all-jobs programme',()=>{
 const proof=read(text);assert.equal(proof.account,'datafold');assert.equal(proof.programmeScriptSHA256,'f1da389f5a20d560fc6835bcba51c569cd67f338685d08165af20645d386684a');assert.equal(proof.marketingEmptyMessageUsedAsEvidence,false);
});
test('unrelated corporate comments do not alter declared native recruitment authority',()=>assert.equal(read(text+'<!-- unrelated publication -->').account,'datafold'));
for(const[label,change]of[
 ['wrong native account',s=>s.replace('const ASHBY_ORG = "datafold"','const ASHBY_ORG = "other"')],
 ['inactive native programme',s=>s.replace('(function(){const ASHBY_ORG','(function(){const ASHBY_ORG').replace('<script>(function(){const ASHBY_ORG','<script type="application/json">(function(){const ASHBY_ORG')],
 ['hidden unique native mount',s=>s.replace('id="careers-jobs-root"','hidden id="careers-jobs-root"')],
 ['duplicate native mount',s=>s.replace('id="careers-jobs-root"','id="careers-jobs-root"></div><div id="careers-jobs-root"')],
])test('corporate authority holds '+label,()=>{
 const changed=change(text);assert.notEqual(changed,text,'Mutation must target actual current carrier');assert.throws(()=>read(changed),/programme|mount|carrier|active|corporate|authority/i);
});

for(const[label,extra]of[
 ['additional declared recruitment route','<a href="https://careers.datafold.com/">Engineering</a>'],
 ['additional own native JobPosting','<script type="application/ld+json">{"@type":"JobPosting","jobLocation":{"address":{"addressCountry":"India"}}}</script>'],
 ['additional graph native JobPosting','<script type="application/ld+json">{"@graph":[{"@type":["Thing","JobPosting"],"identifier":"new-own-role"}]}</script>'],
])test('additional corporate native publication holds '+label,()=>assert.throws(()=>read(text.replace('</body>',extra+'</body>')),/corporate.*(?:programme|publication)/i));
test('inert non-recruitment examples do not add current publication authority',()=>assert.equal(read(text.replace('</body>','<template><a href="https://careers.datafold.com/">Example</a><script type="application/ld+json">{"@type":"JobPosting"}</script></template></body>')).account,'datafold'));
