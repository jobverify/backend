import test from 'node:test'
import assert from 'node:assert/strict'
import {qualify,programme,original,before,after,refuse,exact} from './currentConsumerBoundaries20261121.test.js'

for(const[name,edit]of[
 ['a second record-mutating callback',s=>exact(s,'      // Read initial filters from URL',"      state.jobs.forEach(record=>{record.applyUrl='https://other.invalid/apply'});\n      // Read initial filters from URL")],
 ['record helper alias mutates its argument',s=>exact(s,'      // Read initial filters from URL',"      function rewrite(record){record.title='Changed'}state.jobs.forEach(record=>rewrite(record));\n      // Read initial filters from URL")],
 ['immutable DOM tuple is later mutated',s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","const args=['a'];args[0]='div';const a = document.createElement.apply(document,args);\n      a.id = job.id;")],
 ['DOM tuple escapes to a mutating helper',s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","const args=['a'];function change(items){items[0]='div'}change(args);const a = document.createElement.apply(document,args);\n      a.id = job.id;")],
 ['record callback throws after one append',s=>exact(s,'listEl.appendChild(a);',"listEl.appendChild(a);throw Error('stop after one record');")],
 ['role anchor is assigned a hidden class',s=>exact(s,"a.className = 'careers-table-item w-inline-block';","a.className = 'hidden';")],
 ['role title is assigned a hidden class',s=>exact(s,"titleDiv.className = 'rb-careers-item-link';","titleDiv.className = 'hidden';")],
 ['unrelated-first argument does not hide a global alias mutation',s=>s+"\nfunction replaceNative(target){target.fetch=()=>null}replaceNative({});replaceNative(window);"],
 ['default classic IIFE this mutates fetch',s=>exact(s,'  const state = {','  this.fetch=()=>null;\n  const state = {')],
 ['unknown invoked construction helper',s=>exact(s,'      const res = await fetch(API_URL);','      unresolvedConstructionHelper();const res = await fetch(API_URL);')],
 ['dropdown helper selects the actual jobs container',s=>exact(s,'const primary = document.getElementById(`${type}-list`);',"const primary = document.querySelector('div.careers-job-list');")],
 ['post-render actual list is cleared',s=>exact(s,'      initDropdowns();',"      initDropdowns();document.querySelector('div.careers-job-list').replaceChildren();")],
 ['rendered workplace differs from the same record',s=>exact(s,"locDiv.textContent = job.location || '';","locDiv.textContent = 'India';")],
 ['critical sparse DOM tuple',s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","const a = Reflect.apply(document.createElement,document,['a',,]);\n      a.id = job.id;")]
])test('Configured integrity holds '+name,()=>refuse(programme(edit)))

for(const[name,source]of[
 ['actual own list append replacement',"document.querySelector('div.careers-job-list').appendChild=()=>null;"],
 ['actual own list alias replacement',"const ownList=document.querySelector('div.careers-job-list');ownList.appendChild=()=>null;"],
 ['actual own list hidden carrier',"document.querySelector('div.careers-job-list').hidden=true;"],
 ['critical invocation array mutated to global receiver',"const args=[{}, {fetch:()=>null}];args[0]=window;Object.assign(...args);"],
 ['critical invocation array passed through helper',"const args=[{}, {fetch:()=>null}];function update(values){values[0]=window}update(args);Object.assign(...args);"],
 ['global imported primitive object alias','const root=window;Object.assign.call(Object,root,{fetch:()=>null});'],
 ['unknown computed global write','window[unresolvedNativeKey]=()=>null;']
]){test('Configured integrity holds before-client '+name,()=>refuse(before(source)));test('Configured integrity holds after-client '+name,()=>refuse(after(source)))}

test('Configured integrity holds a CSS-withdrawn actual job list',()=>refuse(exact(original,'</head>','<style>div.careers-job-list{display:none}</style></head>')))
test('Configured integrity holds a CSS-withdrawn actual programme title class',()=>refuse(exact(original,'</head>','<style>.rb-careers-item-link{visibility:hidden}</style></head>')))
test('Configured integrity holds an India attribute on the declared list',()=>refuse(exact(original,'class="careers-job-list"','data-country="India" class="careers-job-list"')))

for(const[name,source]of[
 ['an inactive falsey global mutation','if(false){window.fetch=()=>null}'],
 ['an unrelated invoked this receiver','function local(){this.fetch=()=>null}local.call({});'],
 ['an unrelated invoked browser-named parameter','function local(window){window.fetch=()=>null}local({});'],
 ['a read-only browser descriptor',"Object.getOwnPropertyDescriptor(document,'createElement');"],
 ['a read-only browser keys call','Object.keys(document);'],
 ['unrelated optional CSS carrier',"const unrelated='.not-a-jobs-class';void unrelated;"]
])test('Configured integrity preserves '+name,()=>assert.equal(qualify(before(source)).defaultUnfiltered,true))

test('Configured integrity preserves a bound declared DOM method',()=>assert.equal(qualify(programme(s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","const makeRole=document.createElement.bind(document);const a = makeRole('a');\n      a.id = job.id;"))).defaultUnfiltered,true))
test('Configured integrity preserves a harmless same-record read-only helper',()=>assert.equal(qualify(programme(s=>exact(s,'      // Read initial filters from URL',"      function read(record){return record.title}state.jobs.forEach(record=>read(record));\n      // Read initial filters from URL"))).defaultUnfiltered,true))
