import fs from 'node:fs/promises';
import { runRewritePreflight } from '../rewriting/preflight.js';

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => controller.abort());
const summary = await runRewritePreflight({ signal: controller.signal });
if (process.env.GITHUB_STEP_SUMMARY) {
  const probe = summary.workerProbe;
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, '\n## Description rewrite readiness\n\n'
    + `Readiness: ${summary.ready ? 'passed' : 'failed'}${summary.reason ? ' (' + summary.reason + ')' : ''}.\n\n`
    + `Checks: ${probe?.requests ?? 'not measured'}; generation requests: ${probe?.generationRequests ?? 'not measured'}.\n`);
}
console.log(JSON.stringify(summary));
if (!summary.ready) process.exitCode = 1;
