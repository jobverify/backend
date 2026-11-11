import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import { buildRewritePlan } from '../rewriting/partitioning.js';
import { rewriteWorkerConfiguration } from '../rewriting/worker.js';
const read=name=>readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const environmentValue = (section, name, variables = {}) => {
 const value = section.match(new RegExp(`^ +${name}: (.+)$`, 'm'))?.[1];
 assert.ok(value, `Missing workflow environment value: ${name}`);
 const expression = value.match(/^\$\{\{ vars\.([A-Z_]+) \|\| '([^']*)' \}\}$/);
 if (expression) return variables[expression[1]] || expression[2];
 assert.match(value, /^'[^']*'$/);
 return value.slice(1, -1);
};
test('stages have separate manual workflows and only the completion observer advances runs',()=>{
 for(const file of ['scraper.yml','rewrite-descriptions.yml','classify-jobs.yml']) {
  const workflow=read(file);assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/workflow_run:/);
  assert.match(workflow,/pipelineGithub.js register/);assert.match(workflow,/pipelineGithub.js report/);
  assert.doesNotMatch(workflow,/continue-on-error: true|JOB_DESCRIPTION_REWRITE_AUTO_RUN/);
 }
 const observer=read('pipeline-completion.yml');
 assert.match(observer,/workflow_run:/);assert.match(observer,/actions: write/);assert.match(observer,/pipelineGithub.js complete/);
 assert.match(observer,/head_repository.full_name == github.repository/);
});

test('rewrite sizes its runner matrix from the queue between one registration and one aggregate report',()=>{
 const workflow=read('rewrite-descriptions.yml');
 const jobs=workflow.split('\njobs:\n')[1].match(/^  [a-z_]+:\s*$/gm)||[];
 assert.deepEqual(jobs.map(value=>value.trim()),['register:','rewrite_descriptions:','report:']);
 assert.match(workflow,/name: Rewrite job descriptions \(shard \$\{\{ matrix.shard \}\}\)/);
 assert.match(workflow,/needs: register/);
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/planDescriptionRewrites.js/);
 assert.match(workflow,/matrix: \$\{\{ fromJSON\(needs.register.outputs.matrix\) \}\}/);
 assert.match(workflow,/max-parallel: \$\{\{ fromJSON\(needs.register.outputs.max_parallel\) \}\}/);
 assert.match(workflow,/JOB_DESCRIPTION_REWRITE_SHARD: \$\{\{ matrix.shard \}\}/);
 assert.match(workflow,/JOB_DESCRIPTION_REWRITE_SHARD_COUNT: \$\{\{ needs.register.outputs.shard_count \}\}/);
 assert.match(workflow,/JOB_DESCRIPTION_REWRITE_QUEUE_AS_OF: \$\{\{ needs.register.outputs.queue_as_of \}\}/);
 assert.match(workflow,/PIPELINE_SUMMARY_FILE: '.cache\/scraper-actions\/description-summary-\$\{\{ matrix.shard \}\}.json'/);
 assert.match(workflow,/JOB_DESCRIPTION_REWRITE_CONCURRENCY: \$\{\{ vars\.JOB_DESCRIPTION_REWRITE_CONCURRENCY \|\| '4' \}\}/);
 assert.match(workflow,/name: description-rewrite-\$\{\{ matrix.shard \}\}-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
 assert.match(workflow,/key: description-lfm12b-rewrites-.*shard-\$\{\{ matrix.shard \}\}/);
 assert.match(workflow,/description-worker-\$\{\{ matrix.shard \}\}.log/);
 assert.match(workflow,/description-rejections-\$\{\{ matrix.shard \}\}.json/);
 assert.match(workflow,/needs: \[register, rewrite_descriptions\]/);
 assert.match(workflow,/if: always\(\) && needs.register.result == 'success'/);
 assert.match(workflow,/pattern: description-rewrite-\*-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
 assert.match(workflow,/merge-multiple: true/);
 assert.match(workflow,/PIPELINE_JOB_RESULT: \$\{\{ needs.rewrite_descriptions.result \}\}/);
 assert.equal((workflow.match(/pipelineGithub.js register/g)||[]).length,1);
 assert.equal((workflow.match(/pipelineGithub.js report/g)||[]).length,1);
});

test('rewrite repository variables default to 64 runners and configure CPU threads and slots',()=>{
 const workflow=read('rewrite-descriptions.yml');
 const register=workflow.split('  register:\n')[1].split('  rewrite_descriptions:\n')[0];
 const shards=workflow.split('  rewrite_descriptions:\n')[1].split('  report:\n')[0];
 const planFor = variables => buildRewritePlan(27660, {
  shardCount: environmentValue(register, 'JOB_DESCRIPTION_REWRITE_SHARD_COUNT', variables)
   ? Number(environmentValue(register, 'JOB_DESCRIPTION_REWRITE_SHARD_COUNT', variables)) : undefined,
  jobsPerShard: /^(auto|automatic)$/.test(environmentValue(register, 'JOB_DESCRIPTION_REWRITE_JOBS_PER_SHARD', variables))
   ? 'auto' : Number(environmentValue(register, 'JOB_DESCRIPTION_REWRITE_JOBS_PER_SHARD', variables)),
  maxParallel: Number(environmentValue(register, 'JOB_DESCRIPTION_REWRITE_MAX_PARALLEL', variables)),
 });
 const workerFor = variables => rewriteWorkerConfiguration({ availableCpus: 64,
  threads: Number(environmentValue(shards, 'JOB_DESCRIPTION_REWRITE_CPU_THREADS', variables)),
  parallelism: Number(environmentValue(shards, 'JOB_DESCRIPTION_REWRITE_CONCURRENCY', variables)),
 });
 assert.equal(planFor({}).shardCount,128);
 assert.equal(planFor({}).maxParallel,64);
 assert.deepEqual(workerFor({}),{threads:4,parallelism:4,contextTokens:32768});
 const variables={JOB_DESCRIPTION_REWRITE_SHARD_COUNT:'64',JOB_DESCRIPTION_REWRITE_MAX_PARALLEL:'24',
  JOB_DESCRIPTION_REWRITE_CPU_THREADS:'12',JOB_DESCRIPTION_REWRITE_CONCURRENCY:'8'};
 assert.equal(planFor(variables).shardCount,64);
 assert.equal(planFor(variables).maxParallel,24);
 assert.deepEqual(workerFor(variables),{threads:12,parallelism:8,contextTokens:65536});
});

test('rewrite builds one portable runtime and activates the verified artifact before publishing',()=>{
 const workflow=read('rewrite-descriptions.yml');
 const register=workflow.split('  register:\n')[1].split('  rewrite_descriptions:\n')[0];
 const shards=workflow.split('  rewrite_descriptions:\n')[1].split('  report:\n')[0];
 assert.match(register,/runs-on: ubuntu-24\.04/);
 assert.equal(environmentValue(shards,'runs-on'),'ubuntu-24.04');
 assert.equal(environmentValue(shards,'runs-on',{JOB_DESCRIPTION_REWRITE_RUNNER:'larger-ubuntu24-linux'}),'larger-ubuntu24-linux');
 assert.match(register,/repository: ggml-org\/llama\.cpp/);
 assert.match(register,/ref: 7fe450e19305b828c199d602c23a8337aaa1f03b/);
 assert.match(register,/portableRewriteRuntime\.sh build/);
 assert.match(register,/portableRewriteRuntime\.sh activate/);
 assert.match(register,/description-runtime-avx2-ubuntu24-x64-/);
 assert.match(register,/hashFiles\('scripts\/portableRewriteRuntime\.sh'\)/);
 assert.match(register,/node --test test\/descriptionRewriteWorkflow\.test\.js/);
 assert.match(register,/test\/jobDescriptionPortableRuntime\.test\.js/);
  const nativeTools = register.indexOf('name: Install native debugger test tools');
  assert.ok(nativeTools >= 0 && nativeTools < register.indexOf('name: Check rewrite workflow and worker diagnostics on Linux'));
  assert.match(register,/JOB_DESCRIPTION_REWRITE_REQUIRE_NATIVE_TESTS: '1'/);
 assert.match(register,/runtime_artifact: description-runtime-avx2-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
 assert.match(register,/name: description-runtime-avx2-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
 assert.match(shards,/name: \$\{\{ needs.register.outputs.runtime_artifact \}\}/);
 for(const section of [register,shards]) assert.match(section,/steps\.description_queue\.outputs\.queued != '0'/);
 assert.match(shards,/portableRewriteRuntime\.sh activate/);
 assert.ok(shards.indexOf('portableRewriteRuntime.sh activate')<shards.indexOf('rewriteJobDescriptions.js --apply'));
 assert.doesNotMatch(shards,/description-lfm12b-cpu-/);
 assert.match(shards,/JOB_DESCRIPTION_REWRITE_REQUIRE_CUSTOM_BINARY: '1'/);
 assert.match(shards,/JOB_DESCRIPTION_REWRITE_NATIVE_BACKTRACE: '1'/);
 assert.match(shards,/description-worker-\$\{\{ matrix.shard \}\}.log.native.json/);
});
