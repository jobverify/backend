import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readVisibleNativeDocument,readNativeStatusLayout} from '../scraper-support/utils/visibleNativeHtml.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/spec-current-native.json.gz',import.meta.url)))),html=fixture.packets.find(p=>p.requestedURL==='https://www.spec-india.com/about/career').bodyText
test('Shared visibility: intact SPEC authored keyframes cannot hide the whole native document',()=>{const d=readVisibleNativeDocument(html,{strict:true});assert.equal(d.nodes(n=>n.tag==='div'&&(n.attrs.class||'').split(/\s+/).includes('footer_addres')).length,2)})
for(const prefix of ['@keyframes','@-webkit-keyframes','@k\\65 yframes'])test('Shared visibility: '+prefix+' blocks never become ordinary element-hiding selectors',()=>{const d=readVisibleNativeDocument('<style>'+prefix+' fade{0{opacity:0}100%{opacity:1}}.hidden{display:none}</style><p class="country">India</p><p class="hidden">Hidden assignment</p>',{strict:true});assert.equal(d.nodes(n=>n.tag==='p'&&n.attrs.class==='country').length,1);assert.equal(d.nodes(n=>n.tag==='p'&&n.attrs.class==='hidden').length,0)})
test('Shared visibility: a real hiding rule after nested animation blocks still hides its exact scope',()=>{const d=readVisibleNativeDocument('<style>@media(min-width:1px){@keyframes fade{0{opacity:0}100%{opacity:1}}.country{display:none}}</style><p class="country">India</p><p class="other">Other</p>',{strict:true});assert.equal(d.nodes(n=>n.tag==='p'&&n.attrs.class==='country').length,0);assert.equal(d.nodes(n=>n.tag==='p'&&n.attrs.class==='other').length,1)})
test('Shared visibility: ignoring offset selectors never grants status confidence to an applied animation',()=>{const d=readVisibleNativeDocument('<style>@keyframes fade{0%{opacity:0}100%{opacity:1}}.country{display:block;animation:fade 1s}</style><p class="country">India</p>',{strict:true,statusLayout:true}),node=d.statusNodes(n=>n.tag==='p'&&n.attrs.class==='country')[0];assert.ok(node);assert.equal(readNativeStatusLayout(node).qualified,false)})
