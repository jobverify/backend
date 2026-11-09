import PipelineRun from '../models/PipelineRun.js';
import { reconcileGithub } from './github.js';
import { reconcileLocal } from './local.js';
export async function reconcileActivePipeline() {
 const run=await PipelineRun.findOne({activeKey:'database'}).lean();
 if(!run)return;
 if(run.target==='local')await reconcileLocal(run);
 else if(process.env.GITHUB_PAT)await reconcileGithub(run);
}
