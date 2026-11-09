import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PipelineRun from '../src/models/PipelineRun.js';
import { failPipeline } from '../src/pipeline/execution.js';

test('GitHub CLI registers direct roots, reports work and dispatches separate correlated stages',{timeout:300000},async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'pipeline-github-cli-'));
 const mongo=await MongoMemoryServer.create({binary:{version:'8.2.6',downloadDir:fileURLToPath(new URL('../.cache/mongodb-binaries/',import.meta.url))}});
 await mongoose.connect(mongo.getUri());
 t.after(async()=>{await mongoose.disconnect();await mongo.stop();await fs.rm(directory,{recursive:true,force:true});});
 const script=fileURLToPath(new URL('../scripts/pipelineGithub.js',import.meta.url));
 const hook=path.join(directory,'mock-github.mjs'),eventFile=path.join(directory,'event.json'),dispatchFile=path.join(directory,'dispatches.jsonl');
 await fs.writeFile(hook,`import fs from 'node:fs';
 globalThis.fetch=async(url,options={})=>{
  if(url.endsWith('/repos/owner/jobs'))return Response.json({default_branch:'main'});
  if(url.includes('/contents/.github/workflows/scraper.yml')) {
   const settings={hours:11,startAt:process.env.TEST_SCHEDULE_START};
   const minute=new Date(settings.startAt).getUTCMinutes();
   const source="on:\\n  schedule:\\n    - cron: '"+minute+" * * * *' # jobverify-interval "+JSON.stringify(settings)+"\\n  workflow_dispatch:\\n";
   return Response.json({sha:'b'.repeat(40),encoding:'base64',content:Buffer.from(source).toString('base64')});
  }
  if(url.includes('/actions/runs/'))return Response.json({id:Number(process.env.TEST_REMOTE_RUN_ID),status:'completed',conclusion:'success'});
  if(url.endsWith('/dispatches')){fs.appendFileSync(process.env.TEST_DISPATCH_LOG,JSON.stringify({url,body:JSON.parse(options.body)})+'\\n');return new Response(null,{status:204});}
  throw new Error('Unexpected mocked GitHub request');
 };`);
 const exec=promisify(execFile);
 const env={...process.env,MONGO_URI:mongo.getUri(),GH_TOKEN:'test-only',GITHUB_REPOSITORY:'owner/jobs',GITHUB_REF_NAME:'main',PIPELINE_DEFAULT_BRANCH:'main',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_PATH:eventFile,TEST_DISPATCH_LOG:dispatchFile,PIPELINE_ID:'',PIPELINE_DISPATCH_TOKEN:'',GITHUB_ENV:path.join(directory,'environment')};
 const run=async(command,key,id,extra={})=>exec(process.execPath,['--import',pathToFileURL(hook).href,script,command],{cwd:directory,windowsHide:true,env:{...env,PIPELINE_STAGE:key,GITHUB_RUN_ID:String(id),GITHUB_OUTPUT:path.join(directory,'outputs'),...extra}});
 const complete=async(key,name,id)=>{
  await fs.writeFile(eventFile,JSON.stringify({repository:{default_branch:'main'},workflow_run:{id,name,head_branch:'main',display_title:`${key} | |`}}));
  await run('complete',key,id,{TEST_REMOTE_RUN_ID:String(id)});
 };
 await run('register','scraper',1100);
 let record=await PipelineRun.findOne().lean();assert.equal(record.stages[0].githubRunId,1100);
 assert.ok((await fs.readFile(env.GITHUB_ENV,'utf8').catch(()=>'' )).includes(`PIPELINE_ID=${record._id}\n`));
 await fs.mkdir(path.join(directory,'.cache/scraper-actions'),{recursive:true});
 await fs.writeFile(path.join(directory,'.cache/scraper-actions/pipeline-scraper-summary.json'),JSON.stringify({failed:0,scanned:1}));
 await run('report','scraper',1100,{PIPELINE_JOB_RESULT:'success'});
 await complete('scraper','Jobverify Scraper Cron',1100);
 record=await PipelineRun.findById(record._id).lean();assert.equal(record.stages[1].status,'queued');
 await run('register','rewrite',1101,{PIPELINE_ID:record._id,PIPELINE_DISPATCH_TOKEN:record.stages[1].dispatchToken});
 await fs.writeFile(path.join(directory,'.cache/scraper-actions/description-summary.json'),JSON.stringify({queued:3103,published:2793,skipped:309,failed:1,warnings:1,pendingEstimate:0}));
 await run('report','rewrite',1101,{PIPELINE_JOB_RESULT:'success'});
 record=await PipelineRun.findById(record._id).lean();assert.equal(record.stages[1].summary.failed,1);assert.equal(record.stages[1].summary.warnings,1);
 // The matrix reporter must combine four independent artifacts before handoff.
 for(let shard=0;shard<4;shard++)await fs.writeFile(path.join(directory,`.cache/scraper-actions/description-summary-${shard}.json`),JSON.stringify({shard,shardCount:4,mode:'publish',outcome:'completed',queued:10,published:9,failed:1,warnings:1,pendingEstimate:0}));
 await run('report','rewrite',1101,{PIPELINE_JOB_RESULT:'success',JOB_DESCRIPTION_REWRITE_SHARD_COUNT:'4'});
 record=await PipelineRun.findById(record._id).lean();
 assert.equal(record.stages[1].summary.queued,40);assert.equal(record.stages[1].summary.published,36);
 assert.equal(record.stages[1].summary.failed,4);assert.equal(record.stages[1].summary.workers.length,4);
 // A one-partition plan still uses a suffixed artifact; larger dynamic plans
 // must be aggregated in the same registered workflow before classification.
 for(const shardCount of [1,32]) {
  for(let shard=0;shard<shardCount;shard++)await fs.writeFile(path.join(directory,`.cache/scraper-actions/description-summary-${shard}.json`),JSON.stringify({shard,shardCount,mode:'publish',outcome:'completed',queued:2,published:2,failed:0,warnings:0,pendingEstimate:0}));
  await run('report','rewrite',1101,{PIPELINE_JOB_RESULT:'success',JOB_DESCRIPTION_REWRITE_SHARD_COUNT:String(shardCount)});
  record=await PipelineRun.findById(record._id).lean();
  assert.equal(record.stages[1].summary.queued,shardCount*2);
  assert.equal(record.stages[1].summary.published,shardCount*2);
  assert.equal(record.stages[1].summary.workers.length,shardCount);
  const artifact=JSON.parse(await fs.readFile(path.join(directory,'.cache/scraper-actions/description-summary.json'),'utf8'));
  assert.equal(artifact.shardCount,shardCount);assert.equal(artifact.processingComplete,true);
 }
 await complete('rewrite','Jobverify Description Rewrite',1101);
 record=await PipelineRun.findById(record._id).lean();assert.equal(record.stages[2].status,'queued');
 assert.equal(record.stages[1].status,'completed');
 await run('register','classification',1102,{PIPELINE_ID:record._id,PIPELINE_DISPATCH_TOKEN:record.stages[2].dispatchToken});
 for(let shard=0;shard<4;shard++)await fs.writeFile(path.join(directory,`.cache/scraper-actions/classification-${shard}.json`),JSON.stringify({shard,shardCount:4,assigned:1,scanned:4,completed:1,failed:0}));
 await run('report','classification',1102,{PIPELINE_JOB_RESULT:'success'});
 await complete('classification','Jobverify Post-scrape Classification',1102);
 record=await PipelineRun.findById(record._id).lean();assert.equal(record.status,'completed');assert.equal(record.stages[2].summary.completed,4);
 assert.equal(record.stages[2].summary.scanned,4);assert.equal(record.stages[2].summary.identityScans,16);
 const dispatched=(await fs.readFile(dispatchFile,'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(dispatched.length,2);assert.match(dispatched[0].url,/rewrite-descriptions.yml/);assert.match(dispatched[1].url,/classify-jobs.yml/);
 assert.ok(dispatched.every(item=>item.body.inputs.pipeline_id===record._id&&item.body.inputs.pipeline_sha===env.GITHUB_SHA));
 // A lost completion event must not leave the next direct invocation locked out.
 await run('register','classification',1103);
 await run('report','classification',1103,{PIPELINE_JOB_RESULT:'success'});
 await run('register','classification',1104,{TEST_REMOTE_RUN_ID:'1103'});
 const recovered=await PipelineRun.findOne({'stages.githubRunId':1103}).lean();
 const replacement=await PipelineRun.findOne({activeKey:'database'}).lean();
 assert.equal(recovered.status,'completed');assert.equal(recovered.activeKey,undefined);
 assert.equal(replacement.stages[2].githubRunId,1104);
 await failPipeline(replacement._id,'cancelled','Scheduled CLI checks');
 const future='2099-01-01T00:00:00.000Z';
 await fs.writeFile(eventFile,JSON.stringify({schedule:'0 * * * *'}));
 const before=await PipelineRun.countDocuments();
 await run('register','scraper',1200,{GITHUB_EVENT_NAME:'schedule',TEST_SCHEDULE_START:future});
 assert.equal(await PipelineRun.countDocuments(),before);
 assert.match(await fs.readFile(path.join(directory,'outputs'),'utf8'),/should_run=false/);
 const dueDate=new Date(Date.now()-3600000);dueDate.setUTCMinutes(8,0,0);
 const due=dueDate.toISOString();
 const cron=new Date(due).getUTCMinutes()+' * * * *';
 // An old tick queued before a schedule change cannot start a pipeline.
 await run('register','scraper',1201,{GITHUB_EVENT_NAME:'schedule',TEST_SCHEDULE_START:due});
 assert.equal(await PipelineRun.countDocuments(),before);
 await fs.writeFile(eventFile,JSON.stringify({schedule:cron}));
 await run('register','scraper',1202,{GITHUB_EVENT_NAME:'schedule',TEST_SCHEDULE_START:due});
 // Every legacy GitHub cron tick is ignored after backend scheduling takes over.
 assert.equal(await PipelineRun.countDocuments(),before);
 await run('register','scraper',1203,{GITHUB_EVENT_NAME:'schedule',TEST_SCHEDULE_START:due});
 assert.equal(await PipelineRun.countDocuments({scheduleSlot:{$exists:true}}),0);
 await run('register','scraper',1204,{GITHUB_EVENT_NAME:'workflow_dispatch'});
 const manual=await PipelineRun.findOne({activeKey:'database'}).lean();
 assert.equal(manual.stages[0].githubRunId,1204);assert.equal(manual.scheduleSlot,undefined);
});
