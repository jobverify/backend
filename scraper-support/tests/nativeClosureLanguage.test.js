import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { parseDetail } from '../../scraper/enphaseenergy.workday/native.js'
import { createNativeRoleAvailability, findExplicitNativeClosure, readNativeRoleAvailability } from '../utils/sourceAvailability.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'

const declarations = [
  'This role is no longer accepting applications.',
  'We are no longer accepting applications for this position.',
  'This position is not accepting applications.',
  'This position is closed.',
  'This role is closed for applications.',
  'No longer accepting applications.',
  'Applications are closed.',
  'Applications have been closed.',
  'This role has been filled.',
  'This vacancy is no longer open.',
  'The job has expired.',
  'This position is not available.',
  'Applications are closed for this position because it has been filled.',
  'This position has been filled by another candidate.',
  'This role is closed; please explore other opportunities.',
  'This role is no longer available, but other roles may be open.',
]
for (const notice of declarations) test('declarative native closure: ' + notice, () => {
  assert.equal(findExplicitNativeClosure([notice]), notice)
})

const processCopy = [
  'Applications are closed automatically when a position is filled.',
  'Applications are closed only if this role is filled.',
  'Applications are closed when the hiring process ends.',
  'No longer accepting applications means this process is complete.',
  'If this position is closed, please browse other vacancies.',
  'We will no longer accept applications when this position is filled.',
  'Please check whether this role is closed.',
  'This position may be closed when filled.',
  'Applicants will be notified if this position is closed.',
  'The previous role was closed last year.',
  'Applications are closed? Read the FAQ.',
]
for (const notice of processCopy) test('process copy cannot establish native closure: ' + notice, () => {
  assert.equal(findExplicitNativeClosure([notice]), null)
})

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/enphaseenergy.workday/fixtures/native-002.json.gz', import.meta.url))))
const row = fixture.receipts.filter(receipt => receipt.kind.startsWith('listing-page-')).flatMap(receipt => JSON.parse(receipt.storedBodyUTF8).rows).find(record => record.jid === 'o9tUAfwQ')
const original = fixture.receipts.find(receipt => receipt.kind === 'india-detail-' + row.jid).storedBodyUTF8
const now = '2026-10-25T08:00:00.000Z'
for (const notice of [...declarations.slice(0, 3), ...declarations.slice(-4)]) test('bound native role proof and publication honor: ' + notice, () => {
  const html = original.replace('<div class="jobvite-detail__intro">', '<div class="jobvite-detail__intro"><p>' + notice + '</p>')
  assert.notEqual(html, original)
  const job = parseDetail(html, structuredClone(row), { now })
  job.sourceAvailabilityEvidence = createNativeRoleAvailability(job, { state: 'closed', observedAt: now, evidenceHtml: html })
  assert.equal(readNativeRoleAvailability(job).validated, true)
  assert.equal(readNativeRoleAvailability(job).state, 'closed')
  const metrics = analyzePublishableJobs([job], { now })
  assert.equal(metrics.eligibleJobs.length, 0)
  assert.equal(metrics.filterCounts.closed, 1)
  assert.equal(job.closingDate, null)
})
for (const notice of processCopy.slice(0, 3)) test('bound native role proof rejects conditional process copy: ' + notice, () => {
  const html = original.replace('<div class="jobvite-detail__intro">', '<div class="jobvite-detail__intro"><p>' + notice + '</p>')
  assert.notEqual(html, original)
  const job = parseDetail(html, structuredClone(row), { now })
  assert.throws(() => createNativeRoleAvailability(job, { state: 'closed', observedAt: now, evidenceHtml: html }), /no active declarative closure notice/i)
})

for (const [name, markup] of [
  ['opacity', '<p style="opacity:0">This position is closed.</p>'],
  ['stylesheet', '<style>.previous-status{display:none}</style><p class="previous-status">This position is closed.</p>'],
]) test('hidden native status cannot issue a closed role proof: ' + name, () => {
  const html = original.replace('<div class="jobvite-detail__intro">', '<div class="jobvite-detail__intro">' + markup)
  assert.notEqual(html, original)
  const job = parseDetail(html, structuredClone(row), { now })
  assert.throws(() => createNativeRoleAvailability(job, { state: 'closed', observedAt: now, evidenceHtml: html }), /no active declarative closure notice/i)
})

// Keep the original declaration arrays/proof selections intact above.
const tagQuestionNotices = [
  'This role is closed, right?',
  "Applications are closed for this position, aren't they?",
  'We are no longer accepting applications for this position, are we?',
]
const independentQuestionDeclarations = [
  'This role is closed; do you want to explore other opportunities?',
  'This role is closed (reference: https://careers.example.test/status?role=123?).',
]
for (const notice of tagQuestionNotices) test('tag question cannot declare native closure: ' + notice, () => {
  assert.equal(findExplicitNativeClosure([notice]), null)
})
for (const notice of independentQuestionDeclarations) test('leading declaration survives separate question or URL query: ' + notice, () => {
  assert.equal(findExplicitNativeClosure([notice]), notice)
})
for (const notice of tagQuestionNotices) test('bound native tag question preserves open proof and eligible role: ' + notice, () => {
  const html = original.replace('<div class="jobvite-detail__intro">', '<div class="jobvite-detail__intro"><p>' + notice + '</p>')
  assert.notEqual(html, original)
  const job = parseDetail(html, structuredClone(row), { now })
  const proof = readNativeRoleAvailability(job)
  assert.equal(proof.validated, true)
  assert.equal(proof.state, 'open')
  assert.equal(job.sourceDetailComplete, true)
  assert.throws(() => createNativeRoleAvailability(job, { state: 'closed', observedAt: now, evidenceHtml: html }), /no active declarative closure notice/i)
  const metrics = analyzePublishableJobs([job], { now })
  assert.equal(metrics.eligibleJobs.length, 1)
  assert.equal(metrics.filterCounts.closed, 0)
  assert.equal(job.closingDate, null)
  assert.equal(job.nativeLegalEmployer, null)
  assert.equal(job.sourceScopeComplete, false)
})
for (const notice of independentQuestionDeclarations) test('bound native declaration with separate question or URL remains closed: ' + notice, () => {
  const html = original.replace('<div class="jobvite-detail__intro">', '<div class="jobvite-detail__intro"><p>' + notice + '</p>')
  assert.notEqual(html, original)
  const job = parseDetail(html, structuredClone(row), { now })
  const proof = readNativeRoleAvailability(job)
  assert.equal(proof.validated, true)
  assert.equal(proof.state, 'closed')
  assert.equal(proof.notice, notice)
  const metrics = analyzePublishableJobs([job], { now })
  assert.equal(metrics.eligibleJobs.length, 0)
  assert.equal(metrics.filterCounts.closed, 1)
  assert.equal(job.closingDate, null)
})

import * as statusTextAvailability from '../utils/sourceAvailability.js'
import {readVisibleNativeDocument as statusTextDocument} from '../utils/visibleNativeHtml.js'
import {createHash as statusTextHash} from 'node:crypto'
const statusTextCases = [
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
for(const fixture of statusTextCases)test('raw HTML status text has one-pass block semantics: '+fixture.id,()=>{
 assert.equal(typeof statusTextAvailability.readNativeStatusTextBlocks,'function')
 const d=statusTextDocument(fixture.html,{strict:true}),root=d.nodes(n=>n.tag==='root')[0]
 assert.deepEqual(statusTextAvailability.readNativeStatusTextBlocks(root),fixture.blocks)
})
for(const fixture of statusTextCases)test('encoded native status controls proof and publication: '+fixture.id,()=>{
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html)
 assert.notEqual(html,original)
 const job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job)
 assert.equal(proof.validated,true)
 assert.equal(proof.state,fixture.closes?'closed':'open')
 assert.equal(proof.notice,fixture.closes?fixture.blocks[0]:null)
 assert.equal(proof.evidenceHtml,html)
 assert.equal(proof.evidenceSha256,statusTextHash('sha256').update(html).digest('hex'))
 const metrics=analyzePublishableJobs([job],{now})
 assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1)
 assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
 assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
})
for(const plain of ['This role is cl&#111;sed.','This role is cl&#x6f;sed.'])test('normalized plain status strings are never decoded again: '+plain,()=>{
 assert.equal(findExplicitNativeClosure([plain]),null)
})
test('status block reader rejects normalized strings instead of decoding them',()=>{
 assert.equal(typeof statusTextAvailability.readNativeStatusTextBlocks,'function')
 assert.throws(()=>statusTextAvailability.readNativeStatusTextBlocks('This role is cl&#111;sed.'),/raw active DOM status scope/i)
})

// Opt-in local layout qualifies status text; the 211 decoder controls remain intact.
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
for(const fixture of statusLayoutCases)test('status layout controls real native proof and publication: '+fixture.id,()=>{
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html)
 assert.notEqual(html,original)
 const job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 if(fixture.qualified===false){
  assert.notEqual(proof?.validated,true);assert.notEqual(proof?.state,'open');assert.notEqual(proof?.state,'closed')
  for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),/status layout is unqualified/i)
  assert.equal(metrics.filterCounts.closed,0)
 }else{
  assert.equal(proof.validated,true);assert.equal(proof.state,fixture.closes?'closed':'open');assert.equal(proof.notice,fixture.closes?fixture.blocks[0]:null)
  assert.equal(proof.evidenceHtml,html);assert.equal(proof.evidenceSha256,statusTextHash('sha256').update(html).digest('hex'))
  assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1);assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
 }
 assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
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
for(const fixture of statusBoundaryCases)test('status layout controls real native proof and publication: '+fixture.id,()=>{
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html)
 assert.notEqual(html,original)
 const job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 if(fixture.qualified===false){
  assert.notEqual(proof?.validated,true);assert.notEqual(proof?.state,'open');assert.notEqual(proof?.state,'closed')
  for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),/status layout is unqualified/i)
  assert.equal(metrics.filterCounts.closed,0)
 }else{
  assert.equal(proof.validated,true);assert.equal(proof.state,fixture.closes?'closed':'open');assert.equal(proof.notice,fixture.closes?fixture.blocks[0]:null)
  assert.equal(proof.evidenceHtml,html);assert.equal(proof.evidenceSha256,statusTextHash('sha256').update(html).digest('hex'))
  assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1);assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
 }
 assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
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
for(const fixture of statusConfidenceCases)test('status layout controls real native proof and publication: '+fixture.id,()=>{
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html)
 assert.notEqual(html,original)
 const job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 if(fixture.qualified===false){
  assert.notEqual(proof?.validated,true);assert.notEqual(proof?.state,'open');assert.notEqual(proof?.state,'closed')
  for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),/status layout is unqualified/i)
  assert.equal(metrics.filterCounts.closed,0)
 }else{
  assert.equal(proof.validated,true);assert.equal(proof.state,fixture.closes?'closed':'open');assert.equal(proof.notice,fixture.closes?fixture.blocks[0]:null)
  assert.equal(proof.evidenceHtml,html);assert.equal(proof.evidenceSha256,statusTextHash('sha256').update(html).digest('hex'))
  assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1);assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
 }
 assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
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
for(const fixture of statusQuotedStyleCases)test('status layout controls real native proof and publication: '+fixture.id,()=>{
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html)
 assert.notEqual(html,original)
 const job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 if(fixture.qualified===false){
  assert.notEqual(proof?.validated,true);assert.notEqual(proof?.state,'open');assert.notEqual(proof?.state,'closed')
  for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),/status layout is unqualified/i)
  assert.equal(metrics.filterCounts.closed,0)
 }else{
  assert.equal(proof.validated,true);assert.equal(proof.state,fixture.closes?'closed':'open');assert.equal(proof.notice,fixture.closes?fixture.blocks[0]:null)
  assert.equal(proof.evidenceHtml,html);assert.equal(proof.evidenceSha256,statusTextHash('sha256').update(html).digest('hex'))
  assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1);assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
 }
 assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
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
for(const fixture of statusButtonCases)test('status layout controls real native proof and publication: '+fixture.id,()=>{
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html)
 assert.notEqual(html,original)
 const job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 if(fixture.qualified===false){
  assert.notEqual(proof?.validated,true);assert.notEqual(proof?.state,'open');assert.notEqual(proof?.state,'closed')
  for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),/status layout is unqualified/i)
  assert.equal(metrics.filterCounts.closed,0)
 }else{
  assert.equal(proof.validated,true);assert.equal(proof.state,fixture.closes?'closed':'open');assert.equal(proof.notice,fixture.closes?fixture.blocks[0]:null)
  assert.equal(proof.evidenceHtml,html);assert.equal(proof.evidenceSha256,statusTextHash('sha256').update(html).digest('hex'))
  assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1);assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
 }
 assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
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
for(const fixture of hidingConfidenceCases)test('hiding confidence controls native factories and publication: '+fixture.id,()=>{
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html),job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 if(fixture.qualified===false){
  assert.notEqual(proof?.validated,true);assert.notEqual(proof?.state,'open');assert.notEqual(proof?.state,'closed')
  for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),/status layout is unqualified/i)
  assert.equal(metrics.filterCounts.closed,0)
 }else{
  assert.equal(proof.validated,true);assert.equal(proof.state,fixture.closes?'closed':'open')
  const accepted=createNativeRoleAvailability(job,{state:fixture.closes?'closed':'open',observedAt:now,evidenceHtml:html});assert.equal(accepted.state,fixture.closes?'closed':'open')
  assert.throws(()=>createNativeRoleAvailability(job,{state:fixture.closes?'open':'closed',observedAt:now,evidenceHtml:html}),/native source availability/i)
  assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1);assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
  assert.equal(proof.evidenceHtml,html);assert.equal(proof.evidenceSha256,statusTextHash('sha256').update(html).digest('hex'))
 }
 assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
})

const unexplainedHidingCases=[
  {
    "id": "unexplained conservative exclusion cannot prove open",
    "html": "<template><style>.status{display:none}</style></template><p class=\"status\">This role is closed.</p>",
    "qualified": false
  }
]
for(const fixture of unexplainedHidingCases)test('hiding confidence controls native factories and publication: '+fixture.id,()=>{
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html),job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 if(fixture.qualified===false){
  assert.notEqual(proof?.validated,true);assert.notEqual(proof?.state,'open');assert.notEqual(proof?.state,'closed')
  for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),/status layout is unqualified/i)
  assert.equal(metrics.filterCounts.closed,0)
 }else{
  assert.equal(proof.validated,true);assert.equal(proof.state,fixture.closes?'closed':'open')
  const accepted=createNativeRoleAvailability(job,{state:fixture.closes?'closed':'open',observedAt:now,evidenceHtml:html});assert.equal(accepted.state,fixture.closes?'closed':'open')
  assert.throws(()=>createNativeRoleAvailability(job,{state:fixture.closes?'open':'closed',observedAt:now,evidenceHtml:html}),/native source availability/i)
  assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1);assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
  assert.equal(proof.evidenceHtml,html);assert.equal(proof.evidenceSha256,statusTextHash('sha256').update(html).digest('hex'))
 }
 assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
})

import{run as hidingDataHubRun}from'../../scraper/datahub/script.js'
const hidingDataHubFixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/datahub/fixtures/native-20261021.json.gz',import.meta.url))))
const hidingDataHubReplay=async mutate=>{const packets=structuredClone(hidingDataHubFixture.packets);mutate?.(packets);let reads=0;return hidingDataHubRun({now:hidingDataHubFixture.originalObservedWindow.latest,fetch:async url=>{const p=packets[reads++];assert.equal(String(url),p.url);return{status:p.status,url:p.url,text:async()=>p.body}}})}
for(const mode of['inline-conflict','conditional'])test('uncertain bound DataHub description remains in status scope: '+mode,async()=>{
 const jobs=await hidingDataHubReplay(),job=jobs[0],original=hidingDataHubFixture.packets[4].body,opening=original.match(/<div\b[^>]*class="job__description[^\"]*"[^>]*>/)[0]
 let changed=original.replace(opening,(mode==='inline-conflict'?opening.replace(/>$/,' style="display:none;display:block">'):opening)+'<p>This role is closed.</p>')
 if(mode==='conditional')changed='<style>@media(min-width:99999px){.job__description{display:none}}</style>'+changed
 assert.equal(job.postedAt,'2026-07-07T03:44:28.000Z');assert.equal(job.jobId,'5180972007')
 for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:hidingDataHubFixture.originalObservedWindow.latest,evidenceHtml:changed}),/status layout is unqualified/i)
 job.sourceAvailabilityEvidence={...job.sourceAvailabilityEvidence,evidenceHtml:changed,evidenceSha256:statusTextHash('sha256').update(changed).digest('hex')}
 const proof=readNativeRoleAvailability(job);assert.equal(proof.validated,false);assert.equal(proof.state,'unavailable')
 assert.equal(analyzePublishableJobs([job],{now:hidingDataHubFixture.originalObservedWindow.latest}).filterCounts.closed,0)
 await assert.rejects(hidingDataHubReplay(p=>p[4].body=changed),/status layout is unqualified/i)
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
for(const fixture of attributeConfidenceCases)test('attribute confidence controls native factories and actual eligibility: '+fixture.id,()=>{
 const now=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/enphaseenergy.workday/fixtures/native-002.json.gz',import.meta.url)))).receipts.find(receipt=>receipt.kind==='india-detail-'+row.jid).completedAt
 const html=original.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+fixture.html),job=parseDetail(html,structuredClone(row),{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 if(fixture.qualified===false){
  for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),/status layout is unqualified/i)
  assert.notEqual(proof?.validated,true);assert.notEqual(proof?.state,'open');assert.notEqual(proof?.state,'closed')
  assert.equal(metrics.eligibleJobs.length,0);assert.equal(metrics.filterCounts.closed,0)
 }else{
  assert.equal(proof.validated,true);assert.equal(proof.state,fixture.closes?'closed':'open')
  assert.equal(metrics.eligibleJobs.length,fixture.closes?0:1);assert.equal(metrics.filterCounts.closed,fixture.closes?1:0)
 }
 assert.equal(job.postedAt,null);assert.equal(job.scrapedAt,now);assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
})
for(const attributes of['hidden style="display:block"','inert','aria-hidden="true"'])test('attribute confidence retains uncertain bound DataHub container: '+attributes,async()=>{
 const jobs=await hidingDataHubReplay(),job=jobs[0],original=hidingDataHubFixture.packets[4].body,opening=original.match(/<div\b[^>]*class="job__description[^\"]*"[^>]*>/)[0]
 const changed=original.replace(opening,opening.replace(/>$/,' '+attributes+'>')+'<p>This role is closed.</p>')
 assert.notEqual(changed,original);assert.equal(job.postedAt,'2026-07-07T03:44:28.000Z')
 for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:hidingDataHubFixture.originalObservedWindow.latest,evidenceHtml:changed}),/status layout is unqualified/i)
 await assert.rejects(hidingDataHubReplay(p=>p[4].body=changed),/status layout is unqualified/i)
})
