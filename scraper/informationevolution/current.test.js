import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { runCurrentInformationEvolution } from './current.js'
const fixture = name => fs.readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8')
const exercise = (change = value => value) => runCurrentInformationEvolution({
 now: () => new Date('2026-10-23T14:00:00Z'),
 fetchText: async url => change(fixture(url.endsWith('/about') ? 'current-about.html' : url.endsWith('/api/roles') ? 'current-roles.json' : 'current-role.html'), url),
})
test('current first-party careers feed yields the full Coimbatore role and native application entry', async () => {
 const jobs = await exercise()
 assert.equal(jobs.length, 1)
 assert.equal(jobs[0].title, 'Software Developer')
 assert.equal(jobs[0].country, 'India')
 assert.equal(jobs[0].city, 'Coimbatore')
 assert.equal(jobs[0].applyUrl, 'https://informationevolution.com/careers/software-developer')
 assert.match(jobs[0].jobDescription, /Retrieval-Augmented Generation/)
 assert.equal(jobs[0].postingDate, '2026-08-31T11:56:58.524Z')
})
test('current source rejects wrong title, employer, geography, missing form and malformed feed', async () => {
 for (const [before, after] of [['Software Developer', 'Wrong Role'], ['"name":"Information Evolution"', '"name":"Other"'], ['Coimbatore, India', 'London, UK'], ['class="jd-apply-form"', 'class="missing-form"']]) {
  await assert.rejects(exercise((body, url) => url.includes('/careers/') ? body.replaceAll(before, after) : body))
 }
 await assert.rejects(exercise((body, url) => url.endsWith('/api/roles') ? '{"error":"offline"}' : body))
})
test('current source honors cancellation before making requests', async () => {
 const reason = Error('cancelled')
 await assert.rejects(runCurrentInformationEvolution({ signal: AbortSignal.abort(reason), fetchText: async () => assert.fail('unexpected request') }), error => error === reason)
})
test('current source rejects geography contradicted by the rendered role', async () => {
 await assert.rejects(exercise((body, url) => url.includes('/careers/')
  ? body.replace('<span class="jd-meta-value">Coimbatore, India</span>', '<span class="jd-meta-value">London, UK</span>') : body))
})
