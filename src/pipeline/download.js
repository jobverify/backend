import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import JSZip from 'jszip';
import { githubRequest } from './github.js';
import { backendRoot, localLogPath, redactLog } from './local.js';
import { STAGES, isTerminal } from './policy.js';
import { pipelineError } from './execution.js';

const safeName=value=>String(value||'artifact').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100);

// Keep a partial line across input chunks so URLs/tokens are never split while
// redacting. Memory follows the longest log line rather than the whole file.
async function* redactLines(source) {
  let pending='';
  for await(const chunk of source){
    pending+=chunk;
    const end=pending.lastIndexOf('\n');
    if(end!==-1){yield redactLog(pending.slice(0,end+1));pending=pending.slice(end+1);}
  }
  if(pending)yield redactLog(pending);
}

// Follow the signed storage redirect separately so the PAT stays on api.github.com.
async function downloadGithubFile(repo,endpoint,file,{token,signal,budget}) {
  if(!token||!/^[-\w.]+\/[-\w.]+$/.test(repo||''))throw pipelineError('GitHub access is not configured.',503);
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(300000)]);
  let response=await fetch(`https://api.github.com/repos/${repo}${endpoint}`,{
    redirect:'manual',signal:requestSignal,
    headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
  });
  if(response.status===302){
    const location=new URL(response.headers.get('location'));
    if(location.protocol!=='https:'||location.username||location.password)throw new Error('Invalid GitHub download redirect.');
    await response.body?.cancel();
    response=await fetch(location.href,{signal:requestSignal});
  }
  if(!response.ok||!response.body){await response.body?.cancel();throw pipelineError(`GitHub returned ${response.status}; the file may be unavailable, expired or still being generated.`,502);}
  await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,_encoding,callback){
    budget.remaining-=chunk.length;
    callback(budget.remaining<0?pipelineError('Archive exceeds the 2 GiB download limit.',413):null,chunk);
  }}),createWriteStream(file),{signal:requestSignal});
}

/** Snapshot only resources associated with this pipeline; never scan shared caches. */
export async function createPipelineBundle(run,{root=backendRoot,token=process.env.GITHUB_PAT,signal=new AbortController().signal,kind='all',stage:requestedStage}={}) {
  if(!['all','logs','artifacts'].includes(kind))throw pipelineError('Choose logs or artifacts for the download.',400);
  if(requestedStage!==undefined&&!STAGES.includes(requestedStage))throw pipelineError('Choose a valid pipeline stage for the download.',400);
  const includeLogs=kind!=='artifacts',includeArtifacts=kind!=='logs';
  // Validate before constructing local paths or attachment names.
  localLogPath(run._id,'scraper');
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'jobverify-pipeline-'));
  const inputs=[];
  const cleanup=async()=>{
    for(const input of inputs)input.destroy();
    await Promise.all(inputs.filter(input=>!input.closed).map(input=>new Promise(resolve=>input.once('close',resolve))));
    await fs.rm(directory,{recursive:true,force:true});
  };
  const zip=new JSZip(),budget={remaining:2*1024**3};
  const manifest={pipelineId:run._id,kind,target:run.target,repo:run.repo,status:run.status,createdAt:new Date().toISOString(),snapshot:!isTerminal(run.status),stages:[]};
  let index=0;
  const addFile=(name,file)=>{
    // JSZip pauses later entries. Defer opening their files until consumption
    // instead of holding one descriptor per artifact during preparation.
    const input=Readable.from((async function*(){
      const source=createReadStream(file);
      try{for await(const chunk of source)yield chunk;}finally{source.destroy();}
    })());
    inputs.push(input);zip.file(name,input);
  };
  try {
    for(const key of requestedStage===undefined?STAGES:[requestedStage]){
      signal.throwIfAborted();
      const stage=run.stages.find(s=>s.key===key)||{key,status:'unavailable'};
      const entry={key,status:stage.status,githubRunId:stage.githubRunId,files:[],unavailable:[]};
      manifest.stages.push(entry);
      const collect=async(name,write)=>{
        const file=path.join(directory,String(index++));
        try{await write(file);addFile(name,file);entry.files.push(name);}
        catch(error){
          signal.throwIfAborted();
          // Never serialize signed URLs, remote error bodies or credentials.
          entry.unavailable.push({file:name,reason:error.code==='ENOENT'?'No saved file for this run.':redactLog(error.status?error.message:'File unavailable, expired, still being generated, or download failed.')});
        }
      };
      if(run.target==='local'){
        const log=path.join(root,'.cache/pipeline/logs',`${run._id}-${key}.log`);
        const summary=path.join(root,'.cache/pipeline',`${run._id}-${key}.json`);
        if(includeLogs)await collect(`${key}/logs.txt`,file=>pipeline(createReadStream(log,{encoding:'utf8'}),redactLines,createWriteStream(file),{signal}));
        if(includeArtifacts)await collect(`${key}/artifacts/summary.json`,async file=>fs.writeFile(file,redactLog(await fs.readFile(summary,'utf8'))));
      }else if(stage.githubRunId&&/^\d+$/.test(String(stage.githubRunId))){
        const options={token,signal,budget};
        if(includeLogs)await collect(`${key}/logs.zip`,file=>downloadGithubFile(run.repo,`/actions/runs/${stage.githubRunId}/logs`,file,options));
        if(includeArtifacts)try{
          for(let page=1;;page++){
            signal.throwIfAborted();
            const data=await githubRequest(run.repo,`/actions/runs/${stage.githubRunId}/artifacts?per_page=100&page=${page}`,{token});
            for(const artifact of data.artifacts||[]){
              if(!/^\d+$/.test(String(artifact.id)))continue;
              const name=`${key}/artifacts/${artifact.id}-${safeName(artifact.name)}.zip`;
              if(artifact.expired)entry.unavailable.push({file:name,reason:'Artifact expired in GitHub.'});
              else await collect(name,file=>downloadGithubFile(run.repo,`/actions/artifacts/${artifact.id}/zip`,file,options));
            }
            if((data.artifacts||[]).length<100)break;
          }
        }catch(error){signal.throwIfAborted();entry.unavailable.push({file:`${key}/artifacts`,reason:redactLog(error.status?error.message:'Could not list GitHub artifacts.')});}
      }else entry.unavailable.push({reason:'No GitHub workflow run has been recorded for this stage.'});
      if(includeArtifacts&&stage.summary)zip.file(`${key}/stage-summary.json`,redactLog(JSON.stringify(stage.summary,null,2)));
    }
    zip.file('manifest.json',JSON.stringify(manifest,null,2));
    zip.file('README.txt',`Pipeline ${kind==='all'?'logs and artifacts':kind}\n\nSee manifest.json for stage states, included files and unavailable resources.\nOnly the requested resource types are included. GitHub downloads are preserved as ZIPs inside each stage folder.\nLocal logs are fully redacted; local artifacts contain saved per-run summaries. Shared caches are excluded.\nDownloads of active pipelines are snapshots. Files may still be generated.\nExpired/deleted GitHub resources cannot be recovered. Remote downloads have a 2 GiB total limit.\n`);
    const stream=new Readable().wrap(zip.generateNodeStream({streamFiles:true,compression:'STORE'}));
    return {filename:`${requestedStage==='classification'?'classify':requestedStage||'pipeline'}${kind==='all'?'':`-${kind}`}-${manifest.createdAt.replace(/[:.]/g,'-')}.zip`,stream,cleanup};
  }catch(error){await cleanup();throw error;}
}
