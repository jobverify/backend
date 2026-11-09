import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {evaluateTrialJobs} from '../rewriting/trialQueue.js';
const job=i=>({title:'Network Engineer '+i,company:'Example',location:'Pune',applyUrl:'https://example.com/jobs/'+i,description:'Responsibilities:\nInstall and maintain computer networks for internal teams.\nMonitor network performance and resolve connectivity incidents.\nRequired qualifications:\nAt least 3 years of experience with TCP/IP and routers.'});
const value={overview:'The role involves maintaining computer networks for internal teams. You will monitor network performance and resolve connectivity incidents to keep the networks running.',evidenceIds:[0,1]};
test('one request at a time; completed cases resume without inference',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'job-description-queue-'));try{
 let active=0,peak=0,calls=0;const client={generate:async()=>{active++;peak=Math.max(active,peak);calls++;await new Promise(r=>setTimeout(r,5));active--;return {value,finishReason:'stop'}}};
 const rows=[];await evaluateTrialJobs([job(1),job(2)],{source:'example',caseDir:dir,client,onResult:r=>rows.push(r)});
 assert.equal(peak,1);assert.equal(calls,2);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='draft_passed_checks'));
 await evaluateTrialJobs([job(1),job(2)],{source:'example',caseDir:dir,client});assert.equal(calls,2);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('interrupted inference leaves current job pending; source changes produce a fresh case',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'job-description-queue-'));try{
 const controller=new AbortController();const result=await evaluateTrialJobs([job(1)],{source:'example',caseDir:dir,signal:controller.signal,client:{generate:async()=>{controller.abort();return {value,finishReason:'stop'}}}});
 assert.equal(result.interrupted,true);assert.equal(result.nextIndex,0);assert.deepEqual(await fs.readdir(dir),[]);
 let calls=0;const client={generate:async()=>{calls++;return {value,finishReason:'stop'}}};await evaluateTrialJobs([job(1)],{source:'example',caseDir:dir,client});
 await evaluateTrialJobs([{...job(1),description:job(1).description+'\nEmployment details: Full-time.'}],{source:'example',caseDir:dir,client});assert.equal(calls,2);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
