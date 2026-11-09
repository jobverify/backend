import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import '../loadEnv.js';
import { configureMongoDns } from '../src/utils/mongoDns.js';
import PipelineRun from '../src/models/PipelineRun.js';
import { claimStage, recordStageResult, completeWorkflow, updateStage, changeRun } from '../src/pipeline/execution.js';
import { directConfiguration, stageOutcome, describeStageCompletion, WORKFLOWS, WORKFLOW_NAMES, isTerminal } from '../src/pipeline/policy.js';
import { createDirectGithubPipeline, dispatchGithubStage, githubRequest, matchesGithubStage } from '../src/pipeline/github.js';
import { redactLog } from '../src/pipeline/local.js';
import { aggregateClassificationSummaries } from '../classification/reporting.js';
import { aggregateRewriteSummaries } from '../rewriting/reporting.js';
import { validateRewriteShard } from '../rewriting/partitioning.js';

const command=process.argv[2],key=process.env.PIPELINE_STAGE;
const token=process.env.GH_TOKEN;
configureMongoDns();
try {
  await mongoose.connect(process.env.MONGO_URI);
  if(command==='register') {
    if(Number(process.env.GITHUB_RUN_ATTEMPT||1)>1)throw new Error('Start a new pipeline instead of rerunning a previous workflow attempt.');
    if(process.env.GITHUB_REF_NAME!==process.env.PIPELINE_DEFAULT_BRANCH)throw new Error('Production pipelines run only on the repository default branch.');
    let id=process.env.PIPELINE_ID,dispatchToken=process.env.PIPELINE_DISPATCH_TOKEN;
    if(!id) {
      const options={configuration:directConfiguration(key),target:'github',origin:'github',
        repo:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF_NAME,sha:process.env.GITHUB_SHA,initialRunId:Number(process.env.GITHUB_RUN_ID)};
      let run;
      if(key==='scraper'&&process.env.GITHUB_EVENT_NAME==='schedule') {
        // Ignore old cron events queued before the backend scheduler rollout.
        await fs.appendFile(process.env.GITHUB_OUTPUT,'should_run=false\n');
        console.log('GitHub cron skipped: scraper scheduling is owned by the backend.');
      } else run=await createDirectGithubPipeline(options,{token});
      if(run)id=run._id;
    } else {
      const expected=await PipelineRun.findById(id).lean();
      if(expected?.repo!==process.env.GITHUB_REPOSITORY||expected.target!=='github')throw new Error('Repository identity mismatch.');
      await claimStage(id,key,{runId:Number(process.env.GITHUB_RUN_ID),token:dispatchToken});
    }
    if(id) {
      await fs.appendFile(process.env.GITHUB_OUTPUT,`pipeline_id=${id}\nshould_run=true\n`);
      if(process.env.GITHUB_ENV)await fs.appendFile(process.env.GITHUB_ENV,`PIPELINE_ID=${id}\n`);
      await updateStage(id,key,{status:'running'});
    }
  } else if(command==='report') {
    const run=await PipelineRun.findOne({'stages.githubRunId':Number(process.env.GITHUB_RUN_ID)}).lean();
    if(!run)throw new Error('Unregistered workflow cannot report results.');
    let summary={};let code=process.env.PIPELINE_JOB_RESULT==='success'?0:1;
    if(key==='scraper') {
      try{summary=JSON.parse(await fs.readFile('.cache/scraper-actions/pipeline-scraper-summary.json','utf8'));}catch{code=1;}
    } else if(key==='rewrite') {
      try {
        const shardCount=Number(process.env.JOB_DESCRIPTION_REWRITE_SHARD_COUNT||1);
        validateRewriteShard(0,shardCount);
        if(!process.env.JOB_DESCRIPTION_REWRITE_SHARD_COUNT)summary=JSON.parse(await fs.readFile('.cache/scraper-actions/description-summary.json','utf8'));
        else {
          const parts=[];
          for(let shard=0;shard<shardCount;shard++) {
            try{parts.push(JSON.parse(await fs.readFile(`.cache/scraper-actions/description-summary-${shard}.json`,'utf8')));}
            catch{code=1;}
          }
          summary=aggregateRewriteSummaries(parts,{shardCount});
        }
      } catch(error) {
        code=1;summary={reason:'worker_error',errorType:error.name,errorPhase:'aggregate_shards'};
      }
    } else if(key==='classification') {
      const parts=[];
      for(let i=0;i<4;i++) {
        let part;try{part=JSON.parse(await fs.readFile(`.cache/scraper-actions/classification-${i}.json`,'utf8'));}catch{code=1;continue;}
        parts.push(part);
      }
      summary=aggregateClassificationSummaries(parts);
    }
    const outcome=stageOutcome(key,summary,code);
    summary=describeStageCompletion(key,summary,outcome);
    if(key==='rewrite') {
      await fs.mkdir('.cache/scraper-actions',{recursive:true});
      await fs.writeFile('.cache/scraper-actions/description-summary.json',JSON.stringify(summary,null,2)+'\n');
    }
    await recordStageResult(run._id,key,{outcome,summary});
    console.log(`Pipeline stage ${key} outcome: ${outcome}; summary: ${redactLog(JSON.stringify(summary))}`);
    if(outcome!=='completed')process.exitCode=1;
  } else if(command==='complete') {
    const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
    const remote=event.workflow_run;
    // GitHub can put the custom run-name in workflow_run.name. The workflow file is stable.
    const workflowPath=remote?.path||event.workflow?.path;
    const completedKey=workflowPath?Object.keys(WORKFLOWS).find(stage=>workflowPath===`.github/workflows/${WORKFLOWS[stage]}`):WORKFLOW_NAMES[remote?.name];
    if(!completedKey||remote.head_branch!==event.repository.default_branch)throw new Error('Unexpected pipeline completion event.');
    let run=await PipelineRun.findOne({'stages.githubRunId':remote.id}).lean();
    // A job can fail during npm/setup before registration. Bind only a matching persisted dispatch token.
    if(!run) {
      const active=await PipelineRun.findOne({activeKey:'database',target:'github'}).lean();
      const queued=active?.stages.find(s=>s.status==='queued'&&s.key===completedKey);
      const stage=queued&&await matchesGithubStage(active.repo,remote,queued,token)?queued:null;
      if(stage){await changeRun(active._id,row=>{const s=row.stages.find(s=>s.key===stage.key);s.githubRunId=remote.id;s.status='preparing';});run=active;}
    }
    if(run&&!isTerminal(run.status)) {
      // Confirm authoritative completion; event payload alone never advances a different repository/run.
      const actual=await githubRequest(run.repo,`/actions/runs/${remote.id}`,{token});
      if(actual.status==='completed')await completeWorkflow(remote.id,actual.conclusion,(row,next)=>dispatchGithubStage(row,next,token));
    }
  } else throw new Error('Unknown pipeline command');
} catch(error) {
  const details=[],seen=new Set();
  for(let current=error;current&&!seen.has(current);current=current.cause) {
    seen.add(current);
    details.push([current.name,current.code,current.message||String(current)].filter(Boolean).join(': '));
  }
  console.error(`Pipeline control failed (${command}):`,redactLog(details.join(' | caused by: ')));
  process.exitCode=1;
} finally { await mongoose.disconnect(); }
