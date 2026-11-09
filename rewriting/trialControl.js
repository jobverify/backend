export const parseTrialOptions=args=>{
 const value={runDir:null,resume:false,outputName:'rewrites',threads:1};
 for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--resume'){value.resume=true;continue;}
 if(!['--run-dir','--rewrite-directory','--model-threads'].includes(arg)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Invalid trial argument: '+arg);
 const next=args[++i];if(arg==='--run-dir')value.runDir=next;else if(arg==='--rewrite-directory')value.outputName=next;else value.threads=Number(next);
 }
 if(!value.runDir)throw new Error('Use --run-dir <NEW dry trial directory>');
 if(!/^rewrites(?:-[a-z0-9][a-z0-9-]{0,48})?$/.test(value.outputName)||!Number.isInteger(value.threads)||value.threads<1||value.threads>4)throw new Error('Invalid trial output directory or model threads');
 return value;
};
export const assertTrialResume=({prior,checkpoint,previousCatalog,catalog,ownerAlive})=>{
 if(ownerAlive)throw new Error('This trial still has a running owner');
 if(!prior||prior.mongoWrites!==0||checkpoint?.mode!=='dry-run'||JSON.stringify(previousCatalog.map(c=>c.source))!==JSON.stringify(catalog.map(c=>c.source)))throw new Error('Resume requires the same dry-run catalog and checkpoint');
 if(['resource_stopped','monitor_error'].includes(prior.status))throw new Error('Resource-stopped trials stay stopped; do not automatically resume');
 if(!['interrupted','error','scrape_failed'].includes(prior.status))throw new Error('Trial is not in a resumable state');
};
