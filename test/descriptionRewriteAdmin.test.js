import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import AdminAudit from '../src/models/AdminAudit.js';
process.env.JWT_SECRET='description-control-test-only-secret-at-least-32-characters';
const {default: adminRoutes}=await import('../src/routes/adminRoutes.js');
const adminId='507f1f77bcf86cd799439011';

async function harness(t,{variable=null,runs=[],configured=true,githubFailure=false,workflowMissing=false,repositoryMissing=false,variableDenied=false}={}){
 const env={pat:process.env.GITHUB_PAT,repo:process.env.GITHUB_REPO};
 if(configured){process.env.GITHUB_PAT='test-only-github-token';process.env.GITHUB_REPO='owner/jobs';}
 else{delete process.env.GITHUB_PAT;delete process.env.GITHUB_REPO;}
 t.after(()=>{for(const [key,value] of [['GITHUB_PAT',env.pat],['GITHUB_REPO',env.repo]])if(value===undefined)delete process.env[key];else process.env[key]=value;});
 t.mock.method(User,'findById',id=>({select:async()=>({_id:id,role:id===adminId?'admin':'user',email:'admin@example.test'})}));
 t.mock.method(BlacklistedToken,'findOne',async()=>null);
 const audits=t.mock.method(AdminAudit,'create',async()=>({}));
 const calls=[],realFetch=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  if(!String(url).startsWith('https://api.github.com/'))return realFetch(url,options);
  const request={url:String(url),method:options.method||'GET',body:options.body?JSON.parse(options.body):null};calls.push(request);
  assert.equal(options.headers.Authorization,'Bearer test-only-github-token');
  if(githubFailure)return new Response('private upstream details',{status:403});
  if(request.url.endsWith('/actions/variables/JOB_DESCRIPTION_REWRITE_AUTO_RUN')){
   if(variableDenied)return new Response(null,{status:403});
   if(request.method==='GET')return variable===null?new Response(null,{status:404}):Response.json({name:'JOB_DESCRIPTION_REWRITE_AUTO_RUN',value:variable});
   assert.equal(request.method,'PATCH');variable=request.body.value;return new Response(null,{status:204});
  }
  if(request.url.endsWith('/actions/variables')&&request.method==='POST'){variable=request.body.value;return new Response(null,{status:201});}
  if(request.url.includes('/actions/workflows/rewrite-descriptions.yml/runs'))return workflowMissing?new Response(null,{status:404}):Response.json({workflow_runs:runs});
  if(request.url.endsWith('/actions/workflows/rewrite-descriptions.yml/dispatches'))return new Response(null,{status:204});
  if(request.url==='https://api.github.com/repos/owner/jobs')return repositoryMissing?new Response(null,{status:404}):Response.json({default_branch:'trunk'});
  throw new Error('Unexpected GitHub request '+request.url);
 });
 const app=express();app.use(express.json());app.use('/api/admin',adminRoutes);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=async(endpoint,{method='GET',body,id=adminId}={})=>{
  const response=await realFetch('http://127.0.0.1:'+server.address().port+'/api/admin/description-rewrite/'+endpoint,{method,headers:{'content-type':'application/json',...(id?{authorization:'Bearer '+jwt.sign({id},process.env.JWT_SECRET)}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const text=await response.text();
  return {status:response.status,body:response.headers.get('content-type')?.includes('application/json')?JSON.parse(text):{message:text}};
 };
 return {request,calls,audits};
}

test('legacy rewrite execution controls explicitly direct authenticated admins to the pipeline API',async t=>{
 const h=await harness(t);
 assert.equal((await h.request('status',{id:null})).status,401);
 assert.equal((await h.request('status',{id:'507f1f77bcf86cd799439012'})).status,403);
 for(const [endpoint,method,body] of [['status','GET'],['automation','PUT',{autoRun:true}],['trigger','POST']]) {
  const response=await h.request(endpoint,{method,body});assert.equal(response.status,410);
  assert.match(response.body.message,/pipeline/);
 }
 assert.equal(h.calls.length,0);
});
