import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import{run,hasOfficialCareersSignal,hasBambooHrHandoff,hasEmptyOpeningsSignal,CAREER_PAGE_URL}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-no-handoff-20261117.json.gz',import.meta.url))))
test('Exeevo current About/home/site-map remain unknown recruitment scope rather than a verified empty BambooHR board',async()=>{
 const pages=fixture.responses.filter(p=>p.status===200)
 assert.ok(pages.length>=3)
 for(const p of pages){const html=Buffer.from(p.bodyBase64,'base64').toString(),doc=readNativeDocument(html)
  assert.equal(hasOfficialCareersSignal(html),false);assert.equal(hasBambooHrHandoff(html),false);assert.equal(hasEmptyOpeningsSignal(html),false)
  assert.equal(doc.nodes(n=>n.tag==='a'&&/career|bamboohr|recruit|\bjobs\b/i.test((n.attrs.href||'')+' '+doc.text(n))).length,0)
 }
 const about=pages.find(p=>p.requestedURL==='https://www.exeevo.com/about'),reads=[]
 await assert.rejects(run({fetchText:async url=>{reads.push(url);return Buffer.from(about.bodyBase64,'base64').toString()}}),/verified official public surface/i)
 assert.deepEqual(reads,[CAREER_PAGE_URL],'No unlinked historical BambooHR request or fabricated empty result')
})
