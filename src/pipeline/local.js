import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipelineError, failPipeline } from './execution.js';
import PipelineRun from '../models/PipelineRun.js';
import { STAGES } from './policy.js';

export const backendRoot=fileURLToPath(new URL('../../',import.meta.url));
export const localEnabled=()=>process.env.PIPELINE_LOCAL_ENABLED==='true';
export function localLogPath(id,key) {
  if(!/^[a-f0-9-]{36}$/.test(id)||!STAGES.includes(key))throw pipelineError('Invalid pipeline log identity.',400);
  return path.join(backendRoot,'.cache','pipeline','logs',`${id}-${key}.log`);
}
export function redactLog(text,env=process.env) {
  let clean=String(text).replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi,'[database redacted]')
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi,'https://[credentials redacted]@')
    .replace(/(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)/g,'[token redacted]');
  for(const [key,value] of Object.entries(env))if(/TOKEN|SECRET|PASSWORD|MONGO_URI|GITHUB_PAT/.test(key)&&value?.length>5)clean=clean.split(value).join('[redacted]');
  return clean;
}
export async function readLocalLog(id,key) {
  const file=localLogPath(id,key);
  try {
    const handle=await fsp.open(file,'r');
    try{const {size}=await handle.stat();const buffer=Buffer.alloc(Math.min(size,65536));await handle.read(buffer,0,buffer.length,Math.max(0,size-buffer.length));return redactLog(buffer.toString('utf8'));}
    finally{await handle.close();}
  }catch(error){if(error.code==='ENOENT')return '';throw error;}
}
export function launchLocal(run) {
  if(!localEnabled())throw pipelineError('Local execution is disabled on this backend.',403);
  const file=localLogPath(run._id,run.stages.find(s=>s.enabled).key);
  fs.mkdirSync(path.dirname(file),{recursive:true});const fd=fs.openSync(file,'a');
  const child=spawn(process.execPath,[path.join(backendRoot,'scripts/pipelineLocal.js'),run._id],{
    cwd:backendRoot,env:process.env,windowsHide:true,detached:true,stdio:['ignore',fd,fd],
  });
  fs.closeSync(fd);
  child.once('error',()=>{void failPipeline(run._id,'failed','Local worker could not start.').catch(()=>{});});
  child.unref();
}
export async function reconcileLocal(run) {
  if(run?.target==='local'&&run.activeKey&&Date.now()-new Date(run.heartbeatAt||run.startedAt).getTime()>120000) {
    await failPipeline(run._id,'interrupted','Local worker stopped sending progress. Check its logs before starting another run.');
    return PipelineRun.findById(run._id).lean();
  }
  return run;
}
