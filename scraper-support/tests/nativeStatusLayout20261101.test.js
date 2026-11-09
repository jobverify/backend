import assert from 'node:assert/strict'
import test from 'node:test'
import * as visible from '../utils/visibleNativeHtml.js'
import{readNativeStatusTextBlocks}from'../utils/sourceAvailability.js'
const cases=[
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
for(const fixture of cases)test('opt-in status layout block qualification: '+fixture.id,()=>{
 const d=visible.readVisibleNativeDocument(fixture.html,{strict:true,statusLayout:true}),root=d.nodes(n=>n.tag==='root')[0]
 if(fixture.qualified===false)assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
 else assert.deepEqual(readNativeStatusTextBlocks(root),fixture.blocks)
})
test('opt-in layout metadata leaves default visible projection unchanged',()=>{
 const html='<style>.status{display:inline}.hidden{opacity:0}</style><div class="status">Native <span>content</span></div><p class="hidden">Excluded</p>'
 const normal=visible.readVisibleNativeDocument(html,{strict:true}),explicitOff=visible.readVisibleNativeDocument(html,{strict:true,statusLayout:false}),opted=visible.readVisibleNativeDocument(html,{strict:true,statusLayout:true})
 const roots=d=>d.nodes(n=>n.tag==='root')
 assert.deepEqual(roots(normal),roots(explicitOff));assert.deepEqual(roots(normal),roots(opted))
 assert.equal(typeof visible.readNativeStatusLayout,'function');assert.equal(visible.readNativeStatusLayout(roots(normal)[0]),null)
 assert.equal(visible.readNativeStatusLayout(roots(opted)[0]).qualified,true)
 assert.equal(normal.text(roots(normal)[0]),opted.text(roots(opted)[0]))
})
test('opt-in uncertainty preserves visible nodes and text without emitting a layout boundary',()=>{
 const html='<style>@media print{.status{display:inline}}</style><div class="status">Native content</div>'
 const normal=visible.readVisibleNativeDocument(html,{strict:true}),opted=visible.readVisibleNativeDocument(html,{strict:true,statusLayout:true}),root=opted.nodes(n=>n.tag==='root')[0],node=opted.nodes(n=>n.attrs.class==='status')[0]
 assert.deepEqual(opted.nodes(n=>n.tag==='root'),normal.nodes(n=>n.tag==='root'))
 assert.equal(typeof visible.readNativeStatusLayout,'function');assert.equal(visible.readNativeStatusLayout(node).qualified,false)
 assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
})
test('an unsupported ancestor layout withholds a scoped descendant status',()=>{
 const d=visible.readVisibleNativeDocument('<div style="display:grid"><p>This role is closed.</p></div>',{strict:true,statusLayout:true}),node=d.nodes(n=>n.tag==='p')[0]
 assert.throws(()=>readNativeStatusTextBlocks(node),/status layout is unqualified/i)
})

const boundaryCases=[
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
for(const fixture of boundaryCases)test('opt-in status layout block qualification: '+fixture.id,()=>{
 const d=visible.readVisibleNativeDocument(fixture.html,{strict:true,statusLayout:true}),root=d.nodes(n=>n.tag==='root')[0]
 if(fixture.qualified===false)assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
 else assert.deepEqual(readNativeStatusTextBlocks(root),fixture.blocks)
})
const confidenceCases=[
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
for(const fixture of confidenceCases)test('opt-in status layout block qualification: '+fixture.id,()=>{
 const d=visible.readVisibleNativeDocument(fixture.html,{strict:true,statusLayout:true}),root=d.nodes(n=>n.tag==='root')[0]
 if(fixture.qualified===false)assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
 else assert.deepEqual(readNativeStatusTextBlocks(root),fixture.blocks)
})
const quotedStyleCases=[
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
for(const fixture of quotedStyleCases)test('opt-in status layout block qualification: '+fixture.id,()=>{
 const d=visible.readVisibleNativeDocument(fixture.html,{strict:true,statusLayout:true}),root=d.nodes(n=>n.tag==='root')[0]
 if(fixture.qualified===false)assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
 else assert.deepEqual(readNativeStatusTextBlocks(root),fixture.blocks)
})
const buttonCases=[
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
for(const fixture of buttonCases)test('opt-in status layout block qualification: '+fixture.id,()=>{
 const d=visible.readVisibleNativeDocument(fixture.html,{strict:true,statusLayout:true}),root=d.nodes(n=>n.tag==='root')[0]
 if(fixture.qualified===false)assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
 else assert.deepEqual(readNativeStatusTextBlocks(root),fixture.blocks)
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
for(const fixture of hidingConfidenceCases)test('opt-in status hiding confidence precedes inert skipping: '+fixture.id,()=>{
 const normal=visible.readVisibleNativeDocument(fixture.html,{strict:true}),d=visible.readVisibleNativeDocument(fixture.html,{strict:true,statusLayout:true}),root=d.nodes(n=>n.tag==='root')[0]
 assert.deepEqual(d.nodes(n=>n.tag==='root'),normal.nodes(n=>n.tag==='root'));assert.equal(d.text(root),normal.text(normal.nodes(n=>n.tag==='root')[0]))
 if(fixture.qualified===false)assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
 else assert.deepEqual(readNativeStatusTextBlocks(root),fixture.blocks)
})

const unexplainedHidingCases=[
  {
    "id": "unexplained conservative exclusion cannot prove open",
    "html": "<template><style>.status{display:none}</style></template><p class=\"status\">This role is closed.</p>",
    "qualified": false
  }
]
for(const fixture of unexplainedHidingCases)test('opt-in status hiding confidence precedes inert skipping: '+fixture.id,()=>{
 const normal=visible.readVisibleNativeDocument(fixture.html,{strict:true}),d=visible.readVisibleNativeDocument(fixture.html,{strict:true,statusLayout:true}),root=d.nodes(n=>n.tag==='root')[0]
 assert.deepEqual(d.nodes(n=>n.tag==='root'),normal.nodes(n=>n.tag==='root'));assert.equal(d.text(root),normal.text(normal.nodes(n=>n.tag==='root')[0]))
 if(fixture.qualified===false)assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
 else assert.deepEqual(readNativeStatusTextBlocks(root),fixture.blocks)
})

test('opt-in status scopes retain uncertain hidden nodes and omit definite exclusions',()=>{
 const html='<style>@media print{.scope{display:none}}</style><div class="scope">Potential status</div><div class="definite" style="display:none">Excluded</div><template><div class="scope">Inert</div></template>',normal=visible.readVisibleNativeDocument(html,{strict:true}),d=visible.readVisibleNativeDocument(html,{strict:true,statusLayout:true})
 assert.equal(normal.statusNodes,undefined);assert.equal(typeof d.statusNodes,'function');assert.deepEqual(d.nodes(n=>n.tag==='root'),normal.nodes(n=>n.tag==='root'))
 assert.equal(d.nodes(n=>n.attrs.class==='scope').length,0);assert.equal(d.statusNodes(n=>n.attrs.class==='scope').length,1);assert.equal(d.statusNodes(n=>n.attrs.class==='definite').length,0)
 assert.equal(visible.readNativeStatusLayout(d.statusNodes(n=>n.attrs.class==='scope')[0]).visibility,'uncertain')
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
for(const fixture of attributeConfidenceCases)test('attribute confidence preserves default projection and qualifies status: '+fixture.id,()=>{
 const normal=visible.readVisibleNativeDocument(fixture.html,{strict:true}),d=visible.readVisibleNativeDocument(fixture.html,{strict:true,statusLayout:true}),root=d.nodes(n=>n.tag==='root')[0]
 assert.deepEqual(d.nodes(n=>n.tag==='root'),normal.nodes(n=>n.tag==='root'));assert.equal(d.text(root),normal.text(normal.nodes(n=>n.tag==='root')[0]))
 if(fixture.qualified===false)assert.throws(()=>readNativeStatusTextBlocks(root),/status layout is unqualified/i)
 else assert.deepEqual(readNativeStatusTextBlocks(root),fixture.blocks)
})
