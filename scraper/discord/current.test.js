import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL, CAREERS_SCRIPT_URL } from './script.js'

test('Discord follows the current relative first-party careers script and validates its board contract', async () => {
 const scriptUrl = 'https://discord.com/webflow-scripts/careers102026.js'
 const requests = []
 const jobs = await run({ fetchText: async url => {
  requests.push(url)
  if (url === CAREERS_URL) return '<title>Jobs and Career Opportunities at Discord</title><h1>Work at Discord</h1><button>See All Jobs</button><script src="/webflow-scripts/careers102026.js"></script>'
  assert.equal(url, scriptUrl)
  return 'const DISCORD_JOB_BOARDS=["discord","discordinternational","internationaleor"]; const url=`https://api.greenhouse.io/v1/boards/${board}/jobs?content=true`; link.setAttribute("href", `/jobs/${job.id}`)'
 }, fetchJson: async () => ({ jobs: [] }) })
 assert.deepEqual(jobs, [])
 assert.ok(requests.includes(scriptUrl))
 assert.ok(!requests.includes(CAREERS_SCRIPT_URL))
})

test('Discord refuses untrusted or ambiguous careers scripts before loading board data', async () => {
 for (const scripts of [
  '<script src="https://other.example/webflow-scripts/careers102026.js"></script>',
  '<script src="/webflow-scripts/careers102026.js"></script><script src="/webflow-scripts/careers112026.js"></script>',
 ]) await assert.rejects(run({ fetchText: async () => '<title>Jobs and Career Opportunities at Discord</title><h1>Work at Discord</h1><button>See All Jobs</button>' + scripts,
  fetchJson: async () => assert.fail('untrusted script must not authorize board extraction') }), /careers page/)
})
