import test from 'node:test'
import assert from 'node:assert/strict'
import {positive,negative,append} from './currentGlobalStateBoundary20261120.test.js'
import {BOARD,close,exact,element,attr} from './currentConfiguredBoard20261120.test.js'

const essences=['application/ecmascript','application/javascript','application/x-ecmascript','application/x-javascript','text/ecmascript','text/javascript','text/javascript1.0','text/javascript1.1','text/javascript1.2','text/javascript1.3','text/javascript1.4','text/javascript1.5','text/jscript','text/livescript','text/x-ecmascript','text/x-javascript']
const attributed=(code,attributes)=>close(BOARD,html=>exact(html,'</body>','<script '+attributes+'>'+code+'</script></body>'))
const original=attributes=>close(BOARD,html=>element(html,node=>node.tag==='script'&&!node.attrs.src&&(node.raw??'').includes('window.__appData ='),(value,node)=>{assert.equal(node.attrs.type,undefined);return attr(value,node,attributes)}))
const probes=[
 ...[
  ['Classic var-for-of writes the protected browser property','for(var __appData of[{}]){}'],
  ['Classic var-for-in writes the protected browser property','for(var __appData in{changed:true}){}'],
  ['Classic block function changes the protected browser property','{function __appData(){}}'],
  ['Qualified browser Object namespace changes the protected property','window.Object.assign(window,{__appData:{}});'],
  ['Qualified browser Reflect namespace changes the protected property','self.Reflect.set(window,"__appData",{});'],
  ['Written argument-array member cannot supply original arguments','const peerArguments=[window,{peerAnalytics:true}];peerArguments[1]={__appData:{}};Object.assign(...peerArguments);'],
  ['Argument-array mutating method cannot supply original arguments','const peerArguments=[window,{peerAnalytics:true}];peerArguments.splice(1,1,{__appData:{}});Object.assign(...peerArguments);'],
  ['Argument-array unknown escape cannot supply original arguments','const peerArguments=[window,{peerAnalytics:true}];peerUnknownConsumer(peerArguments);Object.assign(...peerArguments);'],
  ['Written apply tuple cannot supply original arguments','const peerArguments=[window,{peerAnalytics:true}];peerArguments[1]={__appData:{}};Object.assign.apply(null,peerArguments);'],
  ['Mutated tuple alias cannot supply original arguments','const peerArguments=[window,{peerAnalytics:true}],peerAlias=peerArguments;peerAlias[1]={__appData:{}};Object.assign(...peerArguments);']
 ].map(([name,code])=>[name,'negative',append(code)]),
 ...[
  ['Uninitialized classic var does not replace the original property','var __appData;'],
  ['Classic lexical variable remains outside the browser property','let __appData={ordinary:true};'],
  ['Classic lexical class remains outside the browser property','class __appData{}'],
  ['Strict block function has block scope','"use strict";{function __appData(){}}'],
  ['Module block function does not replace the browser property','{function __appData(){}}','module'],
  ['Unused mutated tuple cannot change the native state','const peerUnusedArguments=[window,{peerAnalytics:true}];peerUnusedArguments[1]={__appData:{}};'],
  ['Coherent immutable alias spread analytics remains separate','const peerArguments=[window,{peerAnalytics:true}],peerAlias=peerArguments;Object.assign(...peerAlias);'],
  ['Coherent qualified Object namespace analytics remains separate','window.Object.assign(window,{peerAnalytics:true});']
 ].map(([name,code,type])=>[name,'positive',append(code,type)]),
 ...essences.map(type=>['Active JavaScript essence '+type,'negative',append('window.__appData={};',type)]),
 ...[
  ['ASCII-trimmed classic MIME is active','type=" \tText/JavaScript\r\n "'],
  ['Mixed-case module keyword is active','type="MoDuLe"'],
  ['Language fallback JavaScript is active','language="JavaScript1.2"'],
  ['Empty type overrides a non-JavaScript language','type="" language="json"'],
  ['Window onload legacy classic carrier is active','for=" Window " event=" OnLoad() "']
 ].map(([name,attributes])=>[name,'negative',attributed('window.__appData={};',attributes)]),
 ...[
  ['Non-JavaScript language fallback is a data block','language="json"'],
  ['Classic nomodule carrier is inactive','nomodule'],
  ['JavaScript MIME parameters form a data block','type="text/javascript; charset=utf-8"'],
  ['Non-ASCII MIME whitespace forms a data block','type="\u00a0text/javascript\u00a0"'],
  ['Spaced module keyword forms a data block','type=" module "'],
  ['JSON type remains a data block','type="application/json"'],
  ['Import map remains separate from executable native state','type="importmap"'],
  ['Non-window legacy event carrier is inactive','for="other" event="onload"'],
  ['Non-load legacy event carrier is inactive','for="window" event="onclick"']
 ].map(([name,attributes])=>[name,'positive',attributed('window.__appData={};',attributes)]),
 ['Mixed-case module local declaration preserves original native state','positive',attributed('var __appData={ordinary:true};','type="MoDuLe"')],
 ['Module nomodule attribute does not disable its global mutation','negative',attributed('window.__appData={};','type="module" nomodule')],
 ['Original ASCII-trimmed classic MIME retains original state','positive',original('type=" \tText/JavaScript\r\n "')],
 ['Original mixed-case module retains original state','positive',original('type="MoDuLe"')],
 ['Original JavaScript language fallback retains original state','positive',original('language="JavaScript1.2"')],
 ['Original empty type overrides language','positive',original('type="" language="json"')],
 ['Original nomodule data cannot prove native state','negative',original('nomodule')],
 ['Original non-JavaScript language cannot prove native state','negative',original('language="json"')]
]
for(const[name,kind,change]of probes)test('Global state neighbor: '+name,async()=>{await(kind==='positive'?positive(change):negative(change))})
export const neighborControlCount=probes.length
