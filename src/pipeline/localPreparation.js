import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { backendRoot } from './local.js';

/** Injected process/filesystem boundaries let tests cover preparation without installing models. */
export async function prepareLocalStage(key,{run,files=fs,root=backendRoot,platform=process.platform,env=process.env,prepareRewrite,log=async()=>{}}) {
  const required=async(executable,args)=>{
    if(await run(executable,args)!==0)throw new Error('Dependency preparation failed. See stage logs.');
  };
  await required(process.execPath,['-e',"if(Number(process.versions.node.split('.')[0])!==24)process.exit(1)"]);
  const dependenciesHealthy=await run(process.execPath,['--input-type=module','-e',"import{createRequire}from'node:module';import fs from'node:fs';const r=createRequire(process.cwd()+'/package.json');for(const n of Object.keys(JSON.parse(fs.readFileSync('package.json')).dependencies))r.resolve(n)"]);
  if(dependenciesHealthy!==0) {
    if(platform==='win32')await required(process.execPath,[env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'ci']);
    else await required('npm',['ci']);
  }
  if(key==='rewrite') {
    await log('Checking cached rewrite model and runtime; downloading missing or invalid assets.\n');
    await prepareRewrite();return {};
  }
  if(key!=='classification')return {};
  const directory=path.join(root,'.cache/pipeline/python');
  const python=path.join(directory,platform==='win32'?'Scripts/python.exe':'bin/python');
  try{await files.access(python);}catch{await required(env.GLICLASS_PYTHON||'python',['-m','venv',directory]);}
  await required(python,['-c',"import sys; assert sys.version_info[:2] == (3,12), 'Python 3.12 is required for the pinned classification runtime'"]);
  const requirements=await files.readFile(path.join(root,'classification/gliclass/requirements.txt'));
  const signature=createHash('sha256').update(requirements).update('torch==2.8.0-cpu').digest('hex');
  let valid=false;
  try{valid=(await files.readFile(path.join(directory,'requirements.sha256'),'utf8'))===signature;}catch{/* first setup */}
  if(valid)valid=await run(python,['-c','import torch, gliclass, transformers, tokenizers, huggingface_hub, safetensors, psutil, numpy'])===0;
  if(!valid) {
    await required(python,['-m','pip','install','--disable-pip-version-check','torch==2.8.0','--index-url','https://download.pytorch.org/whl/cpu']);
    await required(python,['-m','pip','install','--disable-pip-version-check','-r','classification/gliclass/requirements.txt']);
    await files.writeFile(path.join(directory,'requirements.sha256'),signature);
  }
  const model=path.join(root,'.cache/gliclass-model');
  await required(python,['classification/gliclass/download.py',model]);
  return {GLICLASS_PYTHON:python,GLICLASS_MODEL_DIRECTORY:model,CLASSIFICATION_SHARD:'0',CLASSIFICATION_SHARD_COUNT:'1',POST_SCRAPE_CLASSIFICATION_MODE:'policy'};
}
