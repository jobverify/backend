import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {preload} from './nativeContract.js'
import {readNativeDocument} from './nativeHtml.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-browser-20261021.json.gz',import.meta.url))))
const now=packets[0].startedAt
async function replay(mutate=()=>{},options={}){const p=structuredClone(packets);mutate(p);let i=0;const jobs=await run({now,...options,fetch:async(url,init)=>{const r=p[i++];assert.ok(r);assert.equal(url,r.url);assert.equal(init.method,'GET');return{status:r.status,url:r.finalURL,text:async()=>r.body}}});assert.equal(i,8);return jobs}
const apiMutation=(p,fn)=>{for(const i of[3,6]){const d=JSON.parse(p[i].body);fn(d);p[i].body=JSON.stringify(d)}}
test('actual eight responses preserve current India role and unknown generic Remote scope',async()=>{const j=await replay();assert.equal(j.length,1);assert.equal(j[0].jobId,'73f15a77-9b84-46de-bd9e-bf76f70b6d84');assert.equal(j[0].country,'India');assert.equal(j[0].city,null);assert.equal(j[0].postingDate,'2026-09-26T02:01:08.473+00:00');assert.equal(j[0].sourceDetailComplete,true);assert.equal(j[0].sourceListingComplete,false);assert.equal(analyzePublishableJobs(j,{now}).eligibleJobs.length,1);assert.equal(readInventoryEvidence(j).reportedTotal,null)})

test('an explicitly United States Pacific remote role cannot abort the independent native India role', async () => {
 const jobs=await replay(p=>{
  const id=JSON.parse(p[3].body).jobs[1].id,location='USA Remote (Pacific Time Zone Preferred)'
  apiMutation(p,d=>{d.jobs.find(row=>row.id===id).location=location})
  for(const index of[2,7])mutatePreload(p,index,d=>{d.jobBoard.jobPostings.find(row=>row.id===id).locationName=location})
 })
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India')
})
for(const[name,mutate]of[
 ['HTTP202',p=>p[3].status=202],['wrong final URL',p=>p[4].finalURL='https://example.com/'],
 ['wrong native organization',p=>p[2].body=p[2].body.replace('"organizationId":"79a3b1bb-4ea1-4fa0-8f3c-bffc3aac9be9"','"organizationId":"00000000-0000-4000-8000-000000000000"')],
 ['inactive organization preload',p=>p[2].body=p[2].body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,s=>s.includes('window.__appData')?'<template>'+s+'</template>':s)],
 ['inert corporate handoff',p=>p[0].body=p[0].body.replace('<body','<body inert')],
 ['inactive embed',p=>p[1].body=p[1].body.replace('src="https://jobs.ashbyhq.com/credo.ai/embed"','nomodule src="https://jobs.ashbyhq.com/credo.ai/embed"')],
 ['error envelope',p=>apiMutation(p,d=>d.ERROR='failure')],
 ['duplicate native ID',p=>apiMutation(p,d=>d.jobs.push(d.jobs[0]))],
 ['unlisted India role',p=>apiMutation(p,d=>d.jobs[3].isListed=false)],
 ['foreign country contradiction',p=>apiMutation(p,d=>d.jobs[3].address.postalAddress.addressCountry='United States')],
 ['secondary unqualified location',p=>apiMutation(p,d=>d.jobs[3].secondaryLocations=[{location:'Global Remote'}])],
 ['foreign application identity',p=>apiMutation(p,d=>d.jobs[3].applyUrl='https://example.com/application')],
 ['future publication',p=>apiMutation(p,d=>d.jobs[3].publishedAt='2099-01-01T00:00:00.000+00:00')],
 ['invalid native calendar',p=>apiMutation(p,d=>d.jobs[3].publishedAt='2026-02-30T00:00:00.000+00:00')],
 ['native title drift',p=>apiMutation(p,d=>d.jobs[3].title='Different role')],
 ['has more',p=>apiMutation(p,d=>d.hasMore=true)],
 ['final inventory drift',p=>{const d=JSON.parse(p[6].body);d.jobs.pop();p[6].body=JSON.stringify(d)}],
])test(name,async()=>assert.rejects(replay(mutate)))
test('cap0 cannot certify zero',async()=>assert.rejects(replay(()=>{},{maxJobs:0})))
test('caller abort',async()=>{const c=new AbortController();c.abort();await assert.rejects(replay(()=>{},{signal:c.signal}))})
const descriptionMutation=(p,value)=>{const old=JSON.parse(p[3].body).jobs[3].descriptionHtml;apiMutation(p,d=>d.jobs[3].descriptionHtml=value);for(const i of[4,5]){const changed=p[i].body.replaceAll(JSON.stringify(old),JSON.stringify(value));assert.notEqual(changed,p[i].body);p[i].body=changed}}
for(const[name,html]of[
 ['company-only','<h1>About Credo AI</h1><p>Credo AI is an innovative global leader in responsible AI governance and helps major global enterprises transform their organizations safely.</p>'],
 ['inert role sections','<template><h2>About the Role</h2><p>Build and maintain AI governance services and support production customers with enterprise deployments.</p><h2>Key Responsibilities</h2><p>Design scalable systems and develop production applications with strong testing and documentation.</p><h2>Minimum Qualifications</h2><p>Extensive software engineering experience and understanding of distributed systems and production machine learning.</p></template>'],
 ['instruction-only','<h2>About the Role</h2><p>Please click Apply now to view all details and learn more about this opportunity and our recruitment process.</p><h2>Key Responsibilities</h2><p>Please submit your application to view further information about this position and responsibilities.</p><h2>Minimum Qualifications</h2><p>Please click Apply now to view all qualifications and submit your application to this position.</p>'],
])test(name+' remains a missing-description native role',async()=>{const j=await replay(p=>descriptionMutation(p,html));assert.equal(j.length,1);assert.equal(j[0].sourceDetailComplete,false);assert.equal(j[0].jobDescription,null);const result=analyzePublishableJobs(j,{now});assert.equal(result.filterCounts.emptyDescription,0);assert.equal(result.eligibleJobs.length,1)})
test('application confidential flag rejects',async()=>assert.rejects(replay(p=>p[5].body=p[5].body.replace('"isConfidential":false','"isConfidential":true'))))
test('native application deadline is not silently discarded',async()=>assert.rejects(replay(p=>p[5].body=p[5].body.replace('"applicationDeadline":null','"applicationDeadline":"2020-01-01T00:00:00.000Z"'))))
test('final-response caller abort rejects',async()=>{const c=new AbortController();let i=0;await assert.rejects(run({now,signal:c.signal,fetch:async url=>{const p=packets[i++];return{status:p.status,url,text:async()=>{if(i===8)c.abort();return p.body}}}}))})
test('bounded uncooperative transport settles',async()=>assert.rejects(run({now,timeoutMs:20,fetch:()=>new Promise(()=>{})})))
const mutatePreload=(p,index,mutate)=>{
 const data=preload(p[index].body),script=readNativeDocument(p[index].body).nodes(n=>n.tag==='script'&&/^\s*window\.__appData\s*=\s*\{/.test(n.raw??''))[0].raw
 const old=JSON.stringify(data);mutate(data);const changed=script.replace(old,JSON.stringify(data));assert.notEqual(changed,script);p[index].body=p[index].body.replace(script,changed)
}
for(const[name,mutate]of[
 ['new conflicting country field',p=>apiMutation(p,d=>d.jobs[3].country='United States')],
 ['new conflicting employer field',p=>apiMutation(p,d=>d.jobs[3].employer='Unrelated Corp')],
 ['remote boolean contradiction',p=>apiMutation(p,d=>d.jobs[3].isRemote=false)],
 ['native board workplace contradiction',p=>{for(const i of[2,7])mutatePreload(p,i,d=>d.jobBoard.jobPostings.find(j=>j.id===JSON.parse(p[3].body).jobs[3].id).workplaceType='OnSite')}],
 ['second active null preload assignment',p=>p[2].body+='<script>window.__appData = null;</script>'],
 ['India future-hiring pool masquerading as a vacancy',p=>{const id=JSON.parse(p[3].body).jobs[3].id,title='Submit your Resume for Future Hiring';apiMutation(p,d=>d.jobs[3].title=title);for(const i of[2,7])mutatePreload(p,i,d=>d.jobBoard.jobPostings.find(j=>j.id===id).title=title);for(const i of[4,5])mutatePreload(p,i,d=>d.posting.title=title)}],
])test(name+' rejects',async()=>assert.rejects(replay(mutate)))
test('native closed notice overrides preserved historical duties',async()=>{const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml;const changed=original.replace('<h2><strong>About the Role</strong></h2>','<h2><strong>About the Role</strong></h2><p>This role is closed.</p>');assert.notEqual(changed,original);await assert.rejects(replay(p=>descriptionMutation(p,changed)),/listed native role has an explicit closure notice/i)})

for(const[name,notice]of[
 ['preamble','<p>This role is closed.</p>'],
 ['heading','<h2><strong>This position has been filled.</strong></h2>'],
 ['nested block','<div><p>Applications are closed.</p></div>'],
 ['later sentence','<p>Thank you for your interest. This position is no longer available.</p>'],
 ['role no longer accepting','<p>This role is no longer accepting applications.</p>'],
 ['employer no longer accepting','<p>We are no longer accepting applications for this position.</p>'],
 ['role not accepting','<p>This position is not accepting applications.</p>'],
 ['closure explanation','<p>Applications are closed for this position because it has been filled.</p>'],
 ['filled explanation','<p>This position has been filled by another candidate.</p>'],
 ['closure with other-role instructions','<p>This role is closed; please explore other opportunities.</p>'],
 ['closure with other-role availability','<p>This role is no longer available, but other roles may be open.</p>'],
])test('visible native closure in '+name+' rejects without returning publishable jobs',async()=>{const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml;await assert.rejects(replay(p=>descriptionMutation(p,notice+original)),/listed native role has an explicit closure notice/i)})

for(const[name,notice]of[
 ['hidden notice','<p hidden>This role is closed.</p>'],
 ['inline-hidden notice','<p style="display:none">This role is closed.</p>'],
 ['inert template','<template><p>This role is closed.</p></template>'],
 ['conditional instructions','<p>If this role is closed, please explore other opportunities.</p>'],
 ['unrelated historical role','<p>The previous role was closed last year.</p>'],
 ['opacity-zero notice','<p style="opacity:0">This role is closed.</p>'],
 ['stylesheet-hidden notice','<style>.previous-status{display:none}</style><p class="previous-status">This role is closed.</p>'],
 ['conditional automatic closure','<p>Applications are closed automatically when a position is filled.</p>'],
 ['conditional closure only if','<p>Applications are closed only if this role is filled.</p>'],
 ['conditional closure when','<p>Applications are closed when the hiring process ends.</p>'],
])test(name+' cannot establish closure of the bound native role',async()=>{const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml;const heading='<h2><strong>About the Role</strong></h2>';const changed=original.replace(heading,heading+notice);assert.notEqual(changed,original);const jobs=await replay(p=>descriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(analyzePublishableJobs(jobs,{now}).eligibleJobs.length,1)})

for(const[name,notice]of[
 ['role status tag question','<p>This role is closed, right?</p>'],
 ['application status tag question',"<p>Applications are closed for this position, aren't they?</p>"],
 ['employer acceptance tag question','<p>We are no longer accepting applications for this position, are we?</p>'],
])test(name+' preserves the genuine native role without closure authority',async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml
 const heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+notice)
 assert.notEqual(changed,original)
 const jobs=await replay(p=>descriptionMutation(p,changed))
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})
for(const[name,notice]of[
 ['separate semicolon question','<p>This role is closed; do you want to explore other opportunities?</p>'],
 ['explanatory URL query','<p>This role is closed (reference: https://careers.example.test/status?role=123?).</p>'],
])test(name+' preserves the native declaration and rejects the role',async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml
 await assert.rejects(replay(p=>descriptionMutation(p,notice+original)),/listed native role has an explicit closure notice/i)
})

const rawStatusTextCases = [
  {
    "id": "named-question",
    "html": "<p>Applications are closed for this position, aren't they&quest;</p>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "decimal-question",
    "html": "<p>Applications are closed for this position, aren't they&#63;</p>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "decimal-semicolonless-question",
    "html": "<p>Applications are closed for this position, aren't they&#63</p>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "hex-question",
    "html": "<p>Applications are closed for this position, aren't they&#x3f;</p>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "hex-semicolonless-question",
    "html": "<p>Applications are closed for this position, aren't they&#x3f</p>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "inline-encoded-question",
    "html": "<p>Applications are closed for this position, aren<span>&apos;</span>t they&#63;</p>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "named-closure",
    "html": "<p>This&Tab;role is closed&period;</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "decimal-closure-word",
    "html": "<p>This role is cl&#111;sed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "hex-closure-word",
    "html": "<p>This role is cl&#x6f;sed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "decimal-semicolonless-closure",
    "html": "<p>This role is cl&#111sed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "hex-semicolonless-closure",
    "html": "<p>This role is cl&#x6fsed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "named-newline-whitespace",
    "html": "<p>This&NewLine;role is closed&period;</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "legacy-semicolonless-amp",
    "html": "<p>This role is closed &amp no longer available.</p>",
    "blocks": [
      "This role is closed & no longer available."
    ],
    "closes": true
  },
  {
    "id": "escaped-decimal-literal",
    "html": "<p>This role is cl&amp;#111;sed.</p>",
    "blocks": [
      "This role is cl&#111;sed."
    ],
    "closes": false
  },
  {
    "id": "escaped-hex-literal",
    "html": "<p>This role is cl&amp;#x6f;sed.</p>",
    "blocks": [
      "This role is cl&#x6f;sed."
    ],
    "closes": false
  },
  {
    "id": "numeric-amp-literal",
    "html": "<p>This role is cl&#38;#111;sed.</p>",
    "blocks": [
      "This role is cl&#111;sed."
    ],
    "closes": false
  },
  {
    "id": "literal-question-references",
    "html": "<p>Literal &amp;quest; and &amp;#63; remain source text.</p>",
    "blocks": [
      "Literal &quest; and &#63; remain source text."
    ],
    "closes": false
  },
  {
    "id": "split-reference-token",
    "html": "<p>This role is cl<span>&amp;</span>#111;sed.</p>",
    "blocks": [
      "This role is cl&#111;sed."
    ],
    "closes": false
  },
  {
    "id": "split-inline-word",
    "html": "<p>This role is cl<em>osed.</em></p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "ordinary-inline-edge-whitespace",
    "html": "<p>This <b>role</b> is closed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "br-whitespace",
    "html": "<p>This role is<br>closed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "source-newline-whitespace",
    "html": "<p>This role is\nclosed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "actual-separate-blocks",
    "html": "<p>This role is cl</p><p>osed.</p>",
    "blocks": [
      "This role is cl",
      "osed."
    ],
    "closes": false
  },
  {
    "id": "no-invented-inline-space",
    "html": "<p>This<b>role</b> is closed.</p>",
    "blocks": [
      "Thisrole is closed."
    ],
    "closes": false
  },
  {
    "id": "encoded-conditional",
    "html": "<p>If this role is closed, ask recruiting&quest;</p>",
    "blocks": [
      "If this role is closed, ask recruiting?"
    ],
    "closes": false
  },
  {
    "id": "encoded-semicolon-question",
    "html": "<p>This role is closed&semi; do you want other opportunities&quest;</p>",
    "blocks": [
      "This role is closed; do you want other opportunities?"
    ],
    "closes": true
  },
  {
    "id": "encoded-url-query",
    "html": "<p>This role is closed (reference: https://careers.example.test/status&quest;role=123&quest;).</p>",
    "blocks": [
      "This role is closed (reference: https://careers.example.test/status?role=123?)."
    ],
    "closes": true
  },
  {
    "id": "hidden-encoded",
    "html": "<p hidden>This role is cl&#111;sed.</p><p>Native information only.</p>",
    "blocks": [
      "Native information only."
    ],
    "closes": false
  },
  {
    "id": "inert-encoded",
    "html": "<template><p>This role is cl&#111;sed.</p></template><p>Native information only.</p>",
    "blocks": [
      "Native information only."
    ],
    "closes": false
  },
  {
    "id": "script-raw-excluded",
    "html": "<script>throw new Error('native-script-must-not-execute'); /*This role is closed&#46;*/</script><p>Native information only.</p>",
    "blocks": [
      "Native information only."
    ],
    "closes": false
  },
  {
    "id": "encoded-literal-markup",
    "html": "<p>&lt;span&gt;This role is closed&lt;/span&gt;</p>",
    "blocks": [
      "<span>This role is closed</span>"
    ],
    "closes": false
  },
  {
    "id": "html5-text-legacy-context",
    "html": "<p>Literal &notit; stays text.</p>",
    "blocks": [
      "Literal ¬it; stays text."
    ],
    "closes": false
  },
  {
    "id": "attribute-not-status",
    "html": "<p title=\"This role is closed&#46;\">Native information only.</p>",
    "blocks": [
      "Native information only."
    ],
    "closes": false
  }
]
const rawStatusDescriptionMutation=(p,value)=>{
 const old=JSON.parse(p[3].body).jobs[3].descriptionHtml
 apiMutation(p,d=>d.jobs[3].descriptionHtml=value)
 const encoded=JSON.stringify(value).replaceAll('</script','<'+String.fromCharCode(92)+'/script')
 for(const index of[4,5]){const changed=p[index].body.replaceAll(JSON.stringify(old),encoded);assert.notEqual(changed,p[index].body);p[index].body=changed}
}
for(const fixture of rawStatusTextCases)test('raw HTML Credo status qualification preserves native authority: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 assert.notEqual(changed,original)
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed))
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})

// The original raw status/decoder controls above are unchanged.
const statusLayoutCases=[
  {
    "id": "ordinary-inline-closure",
    "html": "<p>This role is cl<span>osed.</span></p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "explicit-block-inline-tag",
    "html": "<p>This role is cl<span style=\"display:block\">osed.</span></p>",
    "blocks": [
      "This role is cl",
      "osed."
    ],
    "closes": false
  },
  {
    "id": "ordinary-inline-encoded-question",
    "html": "<p>Applications are closed for this position, aren't they<span>&quest;</span></p>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "explicit-inline-block-tag-question",
    "html": "<div style=\"display:inline\">Applications are closed for this position, aren't they</div><span>&quest;</span>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "author-stylesheet-inline-block-tag-question",
    "html": "<style>.status-prefix{display:inline}</style><div class=\"status-prefix\">Applications are closed for this position, aren't they</div><span>&quest;</span>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "ordinary-separate-blocks",
    "html": "<p>This role is cl</p><p>osed.</p>",
    "blocks": [
      "This role is cl",
      "osed."
    ],
    "closes": false
  },
  {
    "id": "author-stylesheet-block-inline-tag",
    "html": "<style>.status-tail{display:block}</style><p>This role is cl<span class=\"status-tail\">osed.</span></p>",
    "blocks": [
      "This role is cl",
      "osed."
    ],
    "closes": false
  },
  {
    "id": "escaped-author-class",
    "html": "<style>.status\\:prefix{display:inline}</style><div class=\"status:prefix\">Applications are closed for this position, aren't they</div><span>&quest;</span>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "simple-child-selector",
    "html": "<style>section > div.status-prefix{display:inline}</style><section><div class=\"status-prefix\">Applications are closed for this position, aren't they</div><span>&quest;</span></section>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "identical-display-rules",
    "html": "<style>.status-prefix{display:inline}div.status-prefix{display:inline!important}</style><div class=\"status-prefix\" style=\"display:inline\">Applications are closed for this position, aren't they</div><span>&quest;</span>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "unrelated-conditional-layout",
    "html": "<style>@media print{.unrelated{display:flex}}</style><p>This role is cl<span>osed.</span></p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "conditional-media-display",
    "html": "<style>@media print{.status-prefix{display:inline}}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "conditional-pseudo-display",
    "html": "<style>.status-prefix:hover{display:inline}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "conflicting-author-display",
    "html": "<style>.status-prefix{display:block}div.status-prefix{display:inline}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "conflicting-inline-author-display",
    "html": "<style>.status-prefix{display:block}</style><div class=\"status-prefix\" style=\"display:inline\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "unsupported-flex-layout",
    "html": "<div style=\"display:flex\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "unresolved-custom-display",
    "html": "<div style=\"display:var(--status-display)\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "ambiguous-selector-attribute",
    "html": "<style>.status-prefix{display:inline}</style><div class=\"st&#97;tus-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "ambiguous-inline-style",
    "html": "<div style=\"d&#105;splay:inline\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "unsupported-attribute-selector",
    "html": "<style>[data-layout=\"inline\"]{display:inline}</style><div data-layout=\"inline\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "unmodelled-generated-question",
    "html": "<style>.status-prefix::after{content:'?'}</style><div class=\"status-prefix\">Applications are closed for this position, aren't they</div>",
    "qualified": false
  },
  {
    "id": "conditional-style-media",
    "html": "<style media=\"print\">.status-prefix{display:inline}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "malformed-display-stylesheet",
    "html": "<style>.status-prefix{display:inline</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "unmodelled-all-reset",
    "html": "<div style=\"all:initial\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "unmodelled-whitespace",
    "html": "<div style=\"white-space:pre\">This role is\nclosed.</div>",
    "qualified": false
  },
  {
    "id": "conditional-supports-display",
    "html": "<style>@supports(display:grid){.status-prefix{display:inline}}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "unmodelled-nested-rule",
    "html": "<style>.status-prefix{display:inline;& span{display:block}}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  }
]
for(const fixture of statusLayoutCases)test('Credo status layout never turns uncertainty into role authority: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 assert.notEqual(changed,original)
 if(fixture.qualified===false){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/status layout is unqualified/i);return}
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})

const statusBoundaryCases=[
  {
    "id": "descriptor-only-captured-font-face",
    "html": "<style>\n      @font-face {\n        font-family: &quot;LabGrotesque-Light&quot;;\n        src: url(&quot;https://s7-recruiting.cdn.greenhouse.io/job_board_renderer/custom_fonts/fonts/400/007/000/original/LabGrotesque-Light.woff?1784212638&quot;);\n        font-weight: normal;\n        font-style: normal;\n      }\n    \n      @font-face {\n        font-family: &quot;LabGrotesque-Light&quot;;\n        src: url(&quot;https://s7-recruiting.cdn.greenhouse.io/job_board_renderer/custom_fonts/fonts/400/007/000/original/LabGrotesque-Light.woff?1784212638&quot;);\n        font-weight: normal;\n        font-style: normal;\n      }\n    </style><p>This role is closed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "empty-selector-list-member",
    "html": "<style>.status-prefix,{display:inline}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "double-comma-selector-list",
    "html": "<style>.status-prefix,,div{display:inline}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "leading-combinator",
    "html": "<style>> .status-prefix{display:inline}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "trailing-combinator",
    "html": "<style>.status-prefix >{display:inline}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "repeated-combinator",
    "html": "<style>.status-prefix >> div{display:inline}</style><section class=\"status-prefix\"><div>This role is closed.</div></section>",
    "qualified": false
  },
  {
    "id": "invalid-selector-escape",
    "html": "<style>.status-prefix\\\n{display:inline}</style><div class=\"status-prefix\">This role is closed.</div>",
    "qualified": false
  }
]
for(const fixture of statusBoundaryCases)test('Credo status layout never turns uncertainty into role authority: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 assert.notEqual(changed,original)
 if(fixture.qualified===false){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/status layout is unqualified/i);return}
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})

const statusConfidenceCases=[
  {
    "id": "captured-body-presentation-variables",
    "html": "<div style=\"--custom-link-color:#3d74cc;--custom-active-field-color:#709ce2;--custom-focus-color:#709ce2;--custom-list-hover-color:#d5e2f6;--custom-primary-typography-color:#3d74cc;--custom-button-color:#578bdd;--custom-button-hover-color:#709ce2;--custom-button-text-color:#000000;--custom-primary-font-family:&quot;LabGrotesque-Light&quot;;--custom-secondary-font-family:&quot;LabGrotesque-Light&quot;;--custom-dropdown-selection-color:#c4d6f3;--custom-secondary-typography-color:#262626;--custom-secondary-typography-10:#2626261A;--custom-secondary-typography-30:#2626264D;--custom-secondary-typography-60:#26262699;--custom-background-color:#ffffff\">This role is closed.</div>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "ambiguous-hidden-style-delimiter",
    "html": "<div style=\"color:red&#59display:inline\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "unsupported-style-quote-reference",
    "html": "<div style=\"--font:&QUOT;Native&QUOT;\">This role is closed.</div>",
    "qualified": false
  },
  {
    "id": "escaped-style-reference-remains-uncertain",
    "html": "<div style=\"color:red&amp;#59display:inline\">This role is closed.</div>",
    "qualified": false
  }
]
for(const fixture of statusConfidenceCases)test('Credo status layout never turns uncertainty into role authority: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 assert.notEqual(changed,original)
 if(fixture.qualified===false){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/status layout is unqualified/i);return}
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})

const statusQuotedStyleCases=[
  {
    "id": "captured-variables-with-explicit-display",
    "html": "<div style=\"--custom-link-color:#3d74cc;--custom-active-field-color:#709ce2;--custom-focus-color:#709ce2;--custom-list-hover-color:#d5e2f6;--custom-primary-typography-color:#3d74cc;--custom-button-color:#578bdd;--custom-button-hover-color:#709ce2;--custom-button-text-color:#000000;--custom-primary-font-family:&quot;LabGrotesque-Light&quot;;--custom-secondary-font-family:&quot;LabGrotesque-Light&quot;;--custom-dropdown-selection-color:#c4d6f3;--custom-secondary-typography-color:#262626;--custom-secondary-typography-10:#2626261A;--custom-secondary-typography-30:#2626264D;--custom-secondary-typography-60:#26262699;--custom-background-color:#ffffff;display:inline\">Applications are closed for this position, aren't they</div><span>&quest;</span>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "quoted-semicolon-is-not-a-display-declaration",
    "html": "<div style=\"--font:&quot;Native;display:block&quot;;display:inline\">Applications are closed for this position, aren't they</div><span>&quest;</span>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "ambiguous-style-attribute-token-boundary",
    "html": "<div style=\"--font:&quot;Native&quot;\" data-x=\"x\">This role is closed.</div>",
    "qualified": false
  }
]
for(const fixture of statusQuotedStyleCases)test('Credo status layout never turns uncertainty into role authority: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 assert.notEqual(changed,original)
 if(fixture.qualified===false){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/status layout is unqualified/i);return}
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})

const statusButtonCases=[
  {
    "id": "default-button",
    "html": "<button>Native control</button>",
    "blocks": [
      "Native control"
    ],
    "closes": false
  },
  {
    "id": "default-button-inside-word",
    "html": "<p>This role is cl<button>osed.</button></p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "default-button-question",
    "html": "<div style=\"display:inline\">Applications are closed for this position, aren't they</div><button>&quest;</button>",
    "blocks": [
      "Applications are closed for this position, aren't they?"
    ],
    "closes": false
  },
  {
    "id": "default-button-after-complete-status",
    "html": "<div><p>This role is closed.</p><button type=\"button\" aria-label=\"Apply\">Apply</button></div>",
    "blocks": [
      "This role is closed.",
      "Apply"
    ],
    "closes": true
  },
  {
    "id": "explicit-block-button",
    "html": "<p>This role is cl<button style=\"display:block\">osed.</button></p>",
    "blocks": [
      "This role is cl",
      "osed."
    ],
    "closes": false
  },
  {
    "id": "explicit-inline-button",
    "html": "<p>This role is cl<button style=\"display:inline\">osed.</button></p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "unsupported-flex-button",
    "html": "<p>This role is cl<button style=\"display:flex\">osed.</button></p>",
    "qualified": false
  },
  {
    "id": "author-block-button",
    "html": "<style>button.status-tail{display:block}</style><p>This role is cl<button class=\"status-tail\">osed.</button></p>",
    "blocks": [
      "This role is cl",
      "osed."
    ],
    "closes": false
  }
]
for(const fixture of statusButtonCases)test('Credo status layout never turns uncertainty into role authority: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 assert.notEqual(changed,original)
 if(fixture.qualified===false){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/status layout is unqualified/i);return}
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})

const hidingConfidenceCases=[
  {
    "id": "visible closure control",
    "html": "<p>This role is closed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "unconditional hidden closure control",
    "html": "<p style=\"display:none\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "conditional hiding cannot prove open",
    "html": "<style>@media(min-width:99999px){.conditional-status{display:none}}</style><p class=\"conditional-status\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "conflicting inline hiding cannot prove open",
    "html": "<p style=\"display:none;display:block\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "conflicting author hiding cannot prove open",
    "html": "<style>.conflicting-status{display:none}.conflicting-status{display:block}</style><p class=\"conflicting-status\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "unconditional author exclusion",
    "html": "<style>.status{display:none}</style><p class=\"status\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "conditional pseudo exclusion",
    "html": "<style>.status:hover{display:none}</style><p class=\"status\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "inline author exclusion conflict",
    "html": "<style>.status{display:none}</style><p class=\"status\" style=\"display:block\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "conditional exclusion inherited by child",
    "html": "<style>@media print{.status{display:none}}</style><div class=\"status\"><p>This role is closed.</p></div>",
    "qualified": false
  },
  {
    "id": "semantic exclusion stays definite under uncertain CSS",
    "html": "<style>@media print{.status{display:none}}</style><div hidden class=\"status\"><p>This role is closed.</p></div>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "template remains a definite exclusion",
    "html": "<template><p style=\"display:none;display:block\">This role is closed.</p></template>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "unconditional opacity exclusion",
    "html": "<p style=\"opacity:0\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "conditional opacity cannot prove open",
    "html": "<style>@media print{.status{opacity:0}}</style><p class=\"status\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "conflicting opacity cannot prove open",
    "html": "<p style=\"opacity:0;opacity:1\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "unconditional visibility exclusion",
    "html": "<p style=\"visibility:hidden\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "conditional visibility cannot prove open",
    "html": "<style>@media print{.status{visibility:hidden}}</style><p class=\"status\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "conflicting visibility cannot prove open",
    "html": "<p style=\"visibility:hidden;visibility:visible\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "inherited visibility restoration is uncertain",
    "html": "<div style=\"visibility:hidden\"><p style=\"visibility:visible\">This role is closed.</p></div>",
    "qualified": false
  },
  {
    "id": "unconditional content visibility exclusion",
    "html": "<p style=\"content-visibility:hidden\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "conditional content visibility cannot prove open",
    "html": "<style>@media print{.status{content-visibility:hidden}}</style><p class=\"status\">This role is closed.</p>",
    "qualified": false
  }
]
for(const fixture of hidingConfidenceCases)test('Credo hiding confidence preserves neither-state uncertainty: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 if(fixture.qualified===false){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/status layout is unqualified/i);return}
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})

const unexplainedHidingCases=[
  {
    "id": "unexplained conservative exclusion cannot prove open",
    "html": "<template><style>.status{display:none}</style></template><p class=\"status\">This role is closed.</p>",
    "qualified": false
  }
]
for(const fixture of unexplainedHidingCases)test('Credo hiding confidence preserves neither-state uncertainty: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 if(fixture.qualified===false){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/status layout is unqualified/i);return}
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})

const attributeConfidenceCases=[
  {
    "id": "hidden-restored-by-display-block",
    "html": "<p hidden style=\"display:block\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "inert-with-no-hiding-css",
    "html": "<p inert>This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "aria-hidden-with-no-hiding-css",
    "html": "<p aria-hidden=\"true\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "visible-attribute-control",
    "html": "<p>This role is closed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  },
  {
    "id": "ordinary-hidden-attribute-control",
    "html": "<p hidden>This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "display-none-attribute-control",
    "html": "<p style=\"display:none\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "inert-independently-display-none",
    "html": "<p inert style=\"display:none\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "aria-hidden-independently-display-none",
    "html": "<p aria-hidden=\"true\" style=\"display:none\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "hidden-author-display-block",
    "html": "<style>.attribute-status{display:block}</style><p hidden class=\"attribute-status\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "hidden-conditional-display-block",
    "html": "<style>@media print{.attribute-status{display:block}}</style><p hidden class=\"attribute-status\">This role is closed.</p>",
    "qualified": false
  },
  {
    "id": "hidden-conditional-none-only",
    "html": "<style>@media print{.attribute-status{display:none}}</style><p hidden class=\"attribute-status\">This role is closed.</p>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "template-stays-excluded-with-visible-attributes",
    "html": "<template inert aria-hidden=\"true\" style=\"display:block\"><p>This role is closed.</p></template>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "inert-under-definite-hidden-parent",
    "html": "<div style=\"display:none\"><p inert>This role is closed.</p></div>",
    "blocks": [],
    "closes": false
  },
  {
    "id": "aria-false-keeps-visible-closure",
    "html": "<p aria-hidden=\"false\">This role is closed.</p>",
    "blocks": [
      "This role is closed."
    ],
    "closes": true
  }
]
for(const fixture of attributeConfidenceCases)test('Credo attribute confidence withholds uncertain caller output: '+fixture.id,async()=>{
 const original=JSON.parse(packets[3].body).jobs[3].descriptionHtml,heading='<h2><strong>About the Role</strong></h2>',changed=original.replace(heading,heading+fixture.html)
 assert.notEqual(changed,original)
 if(fixture.qualified===false){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/status layout is unqualified/i);return}
 if(fixture.closes){await assert.rejects(replay(p=>rawStatusDescriptionMutation(p,changed)),/listed native role has an explicit closure notice/i);return}
 const jobs=await replay(p=>rawStatusDescriptionMutation(p,changed));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].nativeLegalEmployer,null);assert.equal(jobs[0].sourceScopeComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now});assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)
})
