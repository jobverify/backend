import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import AdminAudit from '../src/models/AdminAudit.js';
import PipelineRun from '../src/models/PipelineRun.js';
import { defaultConfiguration } from '../src/pipeline/policy.js';
import { failPipeline } from '../src/pipeline/execution.js';
import { redactLog, localLogPath } from '../src/pipeline/local.js';
import JSZip from 'jszip';

test('pipeline API authorizes configuration, exact dispatch, tracking and conflicts',{timeout:300000},async t=>{
 const mongo=await MongoMemoryServer.create({binary:{version:'8.2.6',downloadDir:fileURLToPath(new URL('../.cache/mongodb-binaries/',import.meta.url))}});
 await mongoose.connect(mongo.getUri());t.after(async()=>{await mongoose.disconnect();await mongo.stop();});
 const oldEnv={...process.env};
 Object.assign(process.env,{JWT_SECRET:'pipeline-test-only-jwt-secret-with-32-characters',GITHUB_PAT:'test-only-token',GITHUB_REPO:'owner/repository',PIPELINE_LOCAL_ENABLED:'false'});
 t.after(()=>{for(const key of ['JWT_SECRET','GITHUB_PAT','GITHUB_REPO','PIPELINE_LOCAL_ENABLED']){if(oldEnv[key]===undefined)delete process.env[key];else process.env[key]=oldEnv[key];}});
 t.mock.method(User,'findById',id=>({select:async()=>({_id:id,role:id==='admin'?'admin':'user'})}));
 t.mock.method(BlacklistedToken,'findOne',async()=>null);t.mock.method(AdminAudit,'create',async()=>({}));
 const nativeFetch=globalThis.fetch,calls=[];
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  if(!String(url).startsWith('https://api.github.com/'))return nativeFetch(url,options);
  const pathname=new URL(url).pathname;calls.push({pathname,body:options.body?JSON.parse(options.body):null});
  if(pathname.endsWith('/owner/repository'))return Response.json({default_branch:'main'});
  if(pathname.endsWith('/contents/.github/workflows/scraper.yml')) {
   if(options.method==='PUT')return Response.json({content:{sha:'b'.repeat(40)}});
   return Response.json({sha:'a'.repeat(40),encoding:'base64',content:Buffer.from("on:\n  schedule:\n    - cron: '0 17 * * *'\n  workflow_dispatch:\njobs:\n").toString('base64')});
  }
  if(pathname.endsWith('/commits/main'))return Response.json({sha:'a'.repeat(40)});
  if(pathname.endsWith('/dispatches'))return new Response(null,{status:204});
  if(pathname.endsWith('/runs'))return Response.json({workflow_runs:[]});
  if(pathname.includes('/actions/workflows/'))return Response.json({state:'active'});
  throw new Error('Unexpected mocked request');
 });
 const {default:routes}=await import('../src/routes/adminRoutes.js');
 const app=express();app.use(express.json());app.use('/api/admin',routes);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=async(path,{method='GET',body,id='admin'}={})=>{
  const res=await nativeFetch(`http://127.0.0.1:${server.address().port}/api/admin/${path}`,{method,headers:{'Content-Type':'application/json',...(id?{Authorization:'Bearer '+jwt.sign({id},process.env.JWT_SECRET)}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,body:await res.json()};
 };
 assert.equal((await request('pipeline/status',{id:null})).status,401);
 assert.equal((await request('pipeline/status',{id:'member'})).status,403);
 for(const method of ['GET','PUT']) {
  assert.equal((await request('pipeline/schedule',{method,id:null})).status,401);
  assert.equal((await request('pipeline/schedule',{method,id:'member'})).status,403);
 }
 assert.equal((await request('pipeline/schedule')).body.data.time,'08:30');
 assert.equal((await request('pipeline/schedule',{method:'PUT',body:{time:'24:00',revision:0}})).status,400);
 const schedule=await request('pipeline/schedule',{method:'PUT',body:{time:'02:08',revision:0}});
 assert.equal(schedule.status,200);assert.equal(schedule.body.data.revision,1);
 assert.equal((await request('pipeline/runs/missing/download',{id:null})).status,401);
 assert.equal((await request('pipeline/runs/missing/download',{id:'member'})).status,403);
 assert.equal((await request('pipeline/runs/missing/download')).status,404);
 const first=await request('pipeline/status');assert.deepEqual(first.body.data.configuration,defaultConfiguration());
 assert.equal(first.body.data.capabilities.local,false);
 const bad=await request('pipeline/configuration',{method:'PUT',body:{stages:[]}});assert.equal(bad.status,400);
 const config={stages:[{key:'classification',enabled:true},{key:'scraper',enabled:false},{key:'rewrite',enabled:true}]};
 assert.equal((await request('pipeline/configuration',{method:'PUT',body:config})).status,200);
 const started=await request('pipeline/trigger',{method:'POST',body:{target:'github'}});assert.equal(started.status,202);
 const run=started.body.data;assert.equal(run.stages[0].status,'queued');assert.equal(run.stages[1].status,'disabled');
 const dispatch=calls.find(c=>c.pathname.endsWith('/dispatches'));
 assert.match(dispatch.pathname,/classify-jobs.yml/);assert.equal(dispatch.body.inputs.pipeline_id,run._id);assert.equal(dispatch.body.ref,'main');
 assert.equal(dispatch.body.inputs.pipeline_sha,'a'.repeat(40));
 const conflict=await request('pipeline/trigger',{method:'POST',body:{target:'github'}});assert.equal(conflict.status,409);assert.equal(conflict.body.activeRun._id,run._id);
 await request('pipeline/configuration',{method:'PUT',body:defaultConfiguration()});
 assert.equal((await PipelineRun.findById(run._id).lean()).stages[0].key,'classification');
 assert.equal((await request(`pipeline/runs/${run._id}`)).body.data._id,run._id);
 assert.equal((await request('pipeline/runs')).body.data.length,1);
 assert.equal((await request(`pipeline/runs/${run._id}/logs/classification`)).status,404);
 assert.equal((await request('pipeline/trigger',{method:'POST',body:{target:'local'}})).status,403);
 assert.equal((await request('scrape/trigger',{method:'POST'})).status,410);
 const downloaded=await nativeFetch(`http://127.0.0.1:${server.address().port}/api/admin/pipeline/runs/${run._id}/download`,{headers:{Authorization:'Bearer '+jwt.sign({id:'admin'},process.env.JWT_SECRET)}});
 assert.equal(downloaded.status,200);assert.match(downloaded.headers.get('content-type'),/application\/zip/);
 assert.match(downloaded.headers.get('content-disposition'),new RegExp(`pipeline-[0-9TZ-]+\\.zip`));
 assert.equal(downloaded.headers.get('cache-control'),'no-store');
 const archive=await JSZip.loadAsync(await downloaded.arrayBuffer());
 assert.equal(JSON.parse(await archive.file('manifest.json').async('string')).pipelineId,run._id);
 for(const kind of ['logs','artifacts']){
  const response=await nativeFetch(`http://127.0.0.1:${server.address().port}/api/admin/pipeline/runs/${run._id}/download?kind=${kind}`,{headers:{Authorization:'Bearer '+jwt.sign({id:'admin'},process.env.JWT_SECRET)}});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-disposition'),new RegExp(`pipeline-${kind}-[0-9TZ-]+\\.zip`));
  const zip=await JSZip.loadAsync(await response.arrayBuffer());
  assert.equal(JSON.parse(await zip.file('manifest.json').async('string')).kind,kind);
 }
 assert.equal((await request(`pipeline/runs/${run._id}/download?kind=invalid`)).status,400);
 for(const stage of ['scraper','rewrite','classification']){
  const response=await nativeFetch(`http://127.0.0.1:${server.address().port}/api/admin/pipeline/runs/${run._id}/download?stage=${stage}`,{headers:{Authorization:'Bearer '+jwt.sign({id:'admin'},process.env.JWT_SECRET)}});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-disposition'),new RegExp(`${stage==='classification'?'classify':stage}-[0-9TZ-]+\\.zip`));
  const zip=await JSZip.loadAsync(await response.arrayBuffer());
  const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
  assert.deepEqual(manifest.stages.map(entry=>entry.key),[stage]);
  assert.equal(manifest.kind,'all');
 }
 assert.equal((await request(`pipeline/runs/${run._id}/download?stage=invalid`)).status,400);
 await failPipeline(run._id,'cancelled','Test cleanup');
});

test('local logs cannot choose filesystem paths and secrets are redacted',()=>{
 assert.throws(()=>localLogPath('../anything','rewrite'));
 assert.throws(()=>localLogPath('a'.repeat(36),'../../.env'));
 const text=redactLog('mongodb+srv://user:pass@cluster/db ghp_abc123 SECRET_VALUE',{API_TOKEN:'SECRET_VALUE'});
 assert.doesNotMatch(text,/user:pass|ghp_abc123|SECRET_VALUE/);
});
