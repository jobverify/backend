import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareLocalStage } from '../src/pipeline/localPreparation.js';

test('local preparation checks caches each time, installs missing dependencies and reuses healthy ones',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pipeline-preparation-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const files={access:async()=>{},readFile:async(file)=>{
  if(file.endsWith('requirements.txt'))return 'pinned==1';return fs.readFile(file,'utf8');
 },writeFile:async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}};
 let calls=[];const run=async(executable,args)=>{calls.push({executable,args});return 0;};
 const first=await prepareLocalStage('classification',{run,files,root});
 assert.equal(first.POST_SCRAPE_CLASSIFICATION_MODE,'policy');
 assert.equal(calls.filter(c=>c.args.includes('install')).length,2);
 calls=[];await prepareLocalStage('classification',{run,files,root});
 assert.equal(calls.filter(c=>c.args.includes('install')).length,0);
 assert.ok(calls.some(c=>c.args[0]==='classification/gliclass/download.py'));
 calls=[];await prepareLocalStage('classification',{run:async(executable,args)=>{
  calls.push({executable,args});return args[1]?.startsWith('import torch')?1:0;
 },files,root});
 assert.equal(calls.filter(c=>c.args.includes('install')).length,2);
 let checks=0;await prepareLocalStage('rewrite',{run,files,root,prepareRewrite:async()=>checks++});
 await prepareLocalStage('rewrite',{run,files,root,prepareRewrite:async()=>checks++});assert.equal(checks,2);
 await assert.rejects(prepareLocalStage('classification',{run:async()=>1,files,root}),/preparation failed/);
});
