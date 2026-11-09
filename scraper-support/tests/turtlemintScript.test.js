import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { document } from '../shared/rmkNativePairHtml.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { run } from '../../scraper/turtlemint/script.js'

const capture = JSON.parse(readFileSync(new URL('../../scraper/turtlemint/fixtures/careers-response.json', import.meta.url)))
const replay = html => ({ fetchPage: async () => ({ status: capture.status, url: capture.finalUrl, html }) })
const append = html => capture.body.replace('</body>', html + '</body>')
const empty = 'There are no active openings at the moment'

test('Turtlemint observes a fresh explicit native empty module before verified zero', async () => {
  const jobs = await run(replay(capture.body))
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'verified-empty')
  assert.equal(evidence.reportedTotal, 0)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.firstParty, true)
  assert.ok(Date.now() - Date.parse(evidence.verifiedAt) < 5000)
})

test('Turtlemint rejects missing or changed employer and empty-state identity', async () => {
  for (const html of [capture.body.replace(empty, 'No result'), capture.body.replace('<title>Careers | Turtlemint</title>', '<title>Careers | Another</title>'),
    capture.body.replaceAll('mailto:careers@turtlemint.com', 'mailto:careers@other.com'),
    capture.body.replace('>Accelerate Your Career at Turtlemint</p>', '>Accelerate Your Career at Another</p>'),
    '<html><body>' + empty + '</body></html>',
  ]) await assert.rejects(run(replay(html)), /Turtlemint/)
})

test('Turtlemint requires active visible empty content including inherited content visibility', async () => {
  const doc = document(capture.body)
  const paragraph = doc.nodes(node => node.tag === 'p' && doc.text(node) === empty)[0]
  for (const attr of ['hidden', 'inert', 'class="d-none"', 'aria-hidden="true"', 'style="display:none"', 'style="visibility: hidden"', 'style="content-visibility: hidden !important"']) {
    const html = capture.body.slice(0, paragraph.start) + `<div ${attr}>` + doc.outer(paragraph) + '</div>' + capture.body.slice(paragraph.end)
    await assert.rejects(run(replay(html)), /Turtlemint/)
  }
  await assert.rejects(run(replay(capture.body.replace('<body ', '<body style="content-visibility:hidden" '))), /Turtlemint/)
})

test('Turtlemint rejects incomplete native envelopes and unclosed careers content', async () => {
  for (const closing of ['</html>', '</body>']) await assert.rejects(run(replay(capture.body.replace(closing, ''))), /Turtlemint|unclosed/)
  const doc = document(capture.body), node = doc.nodes(node => node.tag === 'p' && doc.text(node) === empty)[0]
  await assert.rejects(run(replay(capture.body.slice(0, node.end))), /Turtlemint|unclosed/)
})

test('Turtlemint rejects new native vacancies, opaque recruiting handoffs and generic CTA metadata', async () => {
  for (const extra of ['<a href="https://unseen.example/opaque">View open roles</a>',
    '<a href="https://unseen.example/opaque">Roles</a>',
    '<a href="https://unseen.example/opaque"><img alt="View open roles"></a>',
    '<a href="/next" aria-label="Explore opportunities"></a>',
    '<button data-url="https://unknown.example/next" value="Apply now"></button>',
    '<a href="https://unknown.example/next" title="Join our team">Learn more</a>',
    '<div class="job-listing">Senior Software Engineer — Bengaluru</div>',
    '<iframe src="https://unknown.example/portal"></iframe>',
    '<script src="https://unknown.example/portal.js"></script>',
    '<script>fetch("/api/jobs").then(loadOpenings)</script>',
    '<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>',
  ]) await assert.rejects(run(replay(append(extra))), /Turtlemint/)
})

test('Turtlemint rejects forms and inputs even when targets and labels are opaque', async () => {
  for (const extra of ['<form action="/next"><input type="file" name="upload"></form>',
    '<form action="https://unseen.example/opaque"></form>', '<input type="button" value="Continue" data-url="/next">']) {
    await assert.rejects(run(replay(append(extra))), /Turtlemint/)
  }
})

test('Turtlemint rejects a new link or job text inside the old empty careers module', async () => {
  for (const extra of ['<a href="/opaque">Details</a>', '<p>Senior Backend Engineer Bengaluru</p>']) {
    await assert.rejects(run(replay(capture.body.replace(empty, empty + extra))), /Turtlemint/)
  }
})

test('Turtlemint propagates HTTP, redirect and transport failures', async () => {
  for (const page of [{ status: 503, url: capture.url, html: capture.body }, { status: 200, url: 'https://other.example/careers/', html: capture.body }]) {
    await assert.rejects(run({ fetchPage: async () => page }), /Turtlemint/)
  }
  await assert.rejects(run({ fetchPage: async () => { throw Error('source unavailable') } }), /source unavailable/)
})

test('Turtlemint aggregate deadline bounds ignored signals and body streams, including caller abort', () => {
  const url = new URL('../../scraper/turtlemint/script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import {run} from ${JSON.stringify(url)};
    const keepAlive=setInterval(()=>{},100), results=[];
    try { for(const mode of ['fetch','body','abort']) {
      const controller=new AbortController(); const timer=mode==='abort'?setTimeout(()=>controller.abort(Error('caller cancelled')),10):null;
      globalThis.fetch=async url=>({status:200,url,text:()=>new Promise(()=>{})});
      try { await run({signal:controller.signal,timeoutMs:mode==='abort'?1000:15,...(mode==='body'?{}:{fetchPage:()=>new Promise(()=>{})})});results.push('unexpected success'); }
      catch(error){results.push(error.message)} finally {clearTimeout(timer)}
    } console.log(JSON.stringify(results)); } finally {clearInterval(keepAlive)}
  `], { encoding: 'utf8', timeout: 2500 })
  const results=JSON.parse(output)
  assert.match(results[0], /timeout|timed out|deadline/i)
  assert.match(results[1], /timeout|timed out|deadline/i)
  assert.match(results[2], /caller cancelled/)
})

test('Turtlemint import under parent dry-run has no network or write side effects', () => {
  const url = new URL('../../scraper/turtlemint/script.js', import.meta.url).href
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';fs.writeFileSync=()=>{throw Error('unexpected write')};
    globalThis.fetch=()=>{throw Error('unexpected network')};process.argv.push('--dry-run');
    await import(${JSON.stringify(url)});console.log('imported');
  `], { encoding: 'utf8', timeout: 5000 }).trim(), 'imported')
})
