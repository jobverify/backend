/** Read-only progress snapshot for the monitored local experiment. */
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import path from 'node:path';
import os from 'node:os';

const at=process.argv.indexOf('--run-dir');if(at<0||!process.argv[at+1])throw new Error('Use --run-dir <experiment directory>');
const directory=path.resolve(process.argv[at+1]);
const status=JSON.parse(await fs.readFile(path.join(directory,'pipeline-status.json'),'utf8'));
const state=JSON.parse(await fs.readFile(path.join(directory,'run-state.json'),'utf8'));
let alive=null;try{process.kill(status.ownerPid,0);alive=true;}catch(error){if(error.code==='ESRCH')alive=false;}
const output=path.join(directory,status.rewriteDirectory||'9000m-t4-slots1-arrival-full-final-snapshots');
const report=JSON.parse(await fs.readFile(path.join(output,'summary.json'),'utf8'));
const counts={processed:0,modelRequests:0,modelResponses:0,modelAccepted:0,fallbackDrafts:0,sourceMissing:0,modelErrors:0,contextSkipped:0},reasons={},durations=[];
let last;
const lines=createInterface({input:createReadStream(path.join(output,'results.ndjson')),crlfDelay:Infinity});
for await(const line of lines){if(!line.trim())continue;let row;try{row=JSON.parse(line);}catch{continue;}counts.processed++;last=row;
 counts.modelRequests+=row.generationRequests??(row.attempted?1:0);if(row.attempted)durations.push(row.durationMs);if(row.usage)counts.modelResponses++;
 if(row.accepted)counts.modelAccepted++;if(row.outputMethod==='source_order_formatter_fallback'&&row.formatted)counts.fallbackDrafts++;
 if(row.sourceAvailable===false)counts.sourceMissing++;if(row.error&&row.reason!=='model_context_budget')counts.modelErrors++;if(row.reason==='model_context_budget')counts.contextSkipped++;
 if(row.reason)reasons[row.reason]=(reasons[row.reason]||0)+1;
}
durations.sort((a,b)=>a-b);const elapsed=(Date.now()-Date.parse(report.startedAt))/1000;
const totalCaptured=Object.values(state.completed).reduce((n,r)=>n+(r.result?.jobs||0),0);
const snapshot={at:new Date().toISOString(),status:status.status,modelStatus:report.status,stage:status.stage,ownerPid:status.ownerPid,ownerAlive:alive,
 capturedJobs:totalCaptured,completedSources:state.completedCount,failedSources:Object.values(state.completed).filter(r=>!r.result?.success).length,
 ...counts,reasons,elapsedSeconds:elapsed,processedPerSecond:counts.processed/elapsed,modelMeanMs:durations.length?durations.reduce((n,v)=>n+v,0)/durations.length:null,
 modelP95Ms:durations.length?durations[Math.floor((durations.length-1)*.95)]:null,
 memoryPercent:100*(1-os.freemem()/os.totalmem()),peakMemoryPercent:status.resources.peakMemoryPercent,
 modelPeakMiB:report.peakWorkerMemoryBytes/2**20,last:last&&{source:last.source,title:String(last.title??'').slice(0,180),words:last.sourceWords,seconds:last.durationMs/1000},
 caveat:'Early throughput is dependent on the sources processed so far; remaining time is not yet a full-workload benchmark.'};
await fs.appendFile(path.join(directory,'monitoring-history.ndjson'),JSON.stringify(snapshot)+'\n');
console.log(JSON.stringify(snapshot));
