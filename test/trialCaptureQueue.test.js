import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {runTrialCaptureQueue} from '../rewriting/trialCaptureQueue.js';
test('capture processing begins while scraping runs and drains captures arriving during inference',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'job-description-captures-'));try{
 const raw=path.join(dir,'raw-captures');let settled=false,calls=0;
 const publish=async source=>{await fs.mkdir(path.join(raw,source),{recursive:true});await fs.writeFile(path.join(raw,source,'1.jobs.json'),JSON.stringify({source,type:'capture',capturedAt:new Date().toISOString(),jobs:[{title:'Network Engineer',company:'Example',location:'Pune, India',city:'Pune',applyUrl:'https://example.com/'+source,description:'Responsibilities:\nInstall and maintain computer networks for internal teams.\nMonitor network performance and resolve connectivity incidents.\nRequired qualifications:\nAt least 3 years of experience with TCP/IP and routers.'}]}));};
 await publish('first');const report={captures:{},cases:{},summary:{jobsReviewed:0,generated:0,draftsPassedChecks:0,sourceRetained:0}};
 const client={generate:async()=>{calls++;if(calls===1){assert.equal(settled,false);await publish('second');settled=true;}return {value:{overview:'The role involves maintaining computer networks for internal teams. You will monitor network performance and resolve connectivity incidents to keep the networks running.',evidenceIds:[0,1]},finishReason:'stop'};}};
 await runTrialCaptureQueue({runDir:dir,outputDir:path.join(dir,'rewrites'),catalog:[{source:'first'},{source:'second'}],report,client,isScrapeSettled:()=>settled,save:async()=>{},pollMs:1});
 assert.equal(calls,2);assert.equal(report.summary.jobsReviewed,2);assert.ok(report.captures['second/1.jobs.json'].finished);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('ready companies take turns while generation remains sequential',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'job-description-fair-'));try{
 for(const [source,count] of [['first',2],['second',1]]){
 const destination=path.join(dir,'raw-captures',source);await fs.mkdir(destination,{recursive:true});
 await fs.writeFile(path.join(destination,'1.jobs.json'),JSON.stringify({source,type:'capture',capturedAt:new Date().toISOString(),jobs:Array.from({length:count},(_,i)=>({title:source+' job '+i,company:'Example',location:'Pune, India',city:'Pune',applyUrl:'https://example.com/'+source+'/'+i,description:'Responsibilities:\nInstall and maintain computer networks for internal teams.\nMonitor network performance and resolve connectivity incidents.\nRequired qualifications:\nAt least 3 years of experience with TCP/IP and routers.'}))}));
 }
 const order=[],report={captures:{},cases:{},summary:{jobsReviewed:0,generated:0,draftsPassedChecks:0,sourceRetained:0}};
 await runTrialCaptureQueue({runDir:dir,outputDir:path.join(dir,'rewrites'),catalog:[{source:'first'},{source:'second'}],report,isScrapeSettled:()=>true,save:async()=>{},pollMs:1,client:{generate:async input=>{order.push(input.facts.title);return {value:{overview:'The role involves maintaining computer networks for internal teams. You will monitor network performance and resolve connectivity incidents to keep the networks running.',evidenceIds:[0,1]},finishReason:'stop'};}}});
 assert.deepEqual(order,['first job 0','second job 0','first job 1']);
 }finally{assert.ok(path.basename(dir).startsWith('job-description-fair-'));await fs.rm(dir,{recursive:true,force:true});}
});
