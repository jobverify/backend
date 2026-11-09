import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {hasVerifiedRobotsSitemapSignal,createDropboxScraper,ROBOTS_URL,SITEMAP_URL} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/robots-authority.json.gz',import.meta.url))))
const bytes=Buffer.from(fixture.robots.bodyBase64,'base64'),robots=bytes.toString('utf8')
assert.equal(bytes.length,91)
assert.equal(createHash('sha256').update(bytes).digest('hex'),'41446a2568168559410ab54b1d44fed3c4e0dddf3b346e550315fbf434c5ca1c')
// Break caught: treating unrelated CDN exclusions as sitemap identity rejects
// the real current policy even though its authority-bearing directives match.
test('genuine current robots advertises the official sitemap without an unrelated CDN exclusion',()=>{
 assert.equal(hasVerifiedRobotsSitemapSignal(robots),true)
})
// The external sitemap is deliberately not mocked into fabricated job data.
// This verifies the real reader reaches its exact first-party discovery URL.
test('genuine current robots lets the real reader reach only its advertised sitemap',async()=>{
 const stop=Error('Controlled stop before unretained sitemap; no job oracle'),calls=[]
 await assert.rejects(createDropboxScraper().run({fetchText:async url=>{calls.push(url);if(url===ROBOTS_URL)return robots;assert.equal(url,SITEMAP_URL);throw stop}}),error=>error===stop)
 assert.deepEqual(calls,['https://www.dropbox.jobs/robots.txt','https://www.dropbox.jobs/sitemap.xml'])
})
for(const [name,mutate] of [
 ['missing sitemap',s=>s.replace(/^\s*sitemap\s*:.*$/im,'')],
 ['foreign sitemap origin',s=>s.replace('https://www.dropbox.jobs/sitemap.xml','https://unrelated.invalid/sitemap.xml')],
 ['changed sitemap scheme',s=>s.replace('https://www.dropbox.jobs/sitemap.xml','http://www.dropbox.jobs/sitemap.xml')],
 ['changed sitemap path',s=>s.replace('https://www.dropbox.jobs/sitemap.xml','https://www.dropbox.jobs/other.xml')],
 ['extra sitemap query',s=>s.replace('https://www.dropbox.jobs/sitemap.xml','https://www.dropbox.jobs/sitemap.xml?changed=1')],
 ['missing wildcard user-agent',s=>s.replace(/^User-agent:\s*\*/im,'User-agent: custom')],
 ['missing user-agent',s=>s.replace(/^User-agent:.*$/im,'')],
 ['missing Allow root',s=>s.replace(/^Allow:\s*\/\s*$/im,'')],
 ['different Allow path',s=>s.replace(/^Allow:\s*\/\s*$/im,'Allow: /other/')],
])test('synthetic authority negative remains rejected: '+name,()=>{
 const changed=mutate(robots);assert.notEqual(changed,robots);assert.equal(hasVerifiedRobotsSitemapSignal(changed),false)
})
test('invalid advertised origin never reaches a sitemap request',async()=>{
 const calls=[],changed=robots.replace('https://www.dropbox.jobs/sitemap.xml','https://unrelated.invalid/sitemap.xml')
 await assert.rejects(createDropboxScraper().run({fetchText:async url=>{calls.push(url);return changed}}),/verified robots\.txt/)
 assert.deepEqual(calls,['https://www.dropbox.jobs/robots.txt'])
})
