import test from 'node:test'
import assert from 'node:assert/strict'
import './currentIntegrityNeighbors20261121.test.js'
import {qualify,programme,original,before,refuse,exact} from './currentConsumerBoundaries20261121.test.js'

for(const[name,edit]of[
 ['map uses an unrelated empty receiver',s=>exact(s,'(data.jobs || []).map((job) => {','(data.jobs || []).map.call([], (job) => {')],
 ['filter uses an unrelated empty receiver',s=>exact(s,'state.jobs.filter((job) => {','state.jobs.filter.call([], (job) => {')],
 ['role loop uses an unrelated empty receiver',s=>exact(s,'state.filteredJobs.forEach((job) => {','state.filteredJobs.forEach.call([], (job) => {')],
 ['original Response json has a different receiver',s=>exact(s,'await res.json()','await res.json.call({})')],
 ['initial list query has a different receiver',s=>exact(s,"const listEl = document.querySelector('div.careers-job-list');\n    if (!listEl)","const listEl = document.querySelector.call({},'div.careers-job-list');\n    if (!listEl)")],
 ['render list query has a different receiver',s=>exact(s,"const listEl = document.querySelector('div.careers-job-list');\n    const emptyEl","const listEl = document.querySelector.call({},'div.careers-job-list');\n    const emptyEl")],
 ['initial location parameter getter has a different receiver',s=>exact(s,"state.filters.locations   = params.getAll('location')","state.filters.locations   = params.getAll.call({},'location')")],
 ['initial text parameter getter has a different receiver',s=>exact(s,"state.filters.input       = params.get('search') || ''","state.filters.input       = params.get.call({},'search') || ''")],
 ['same-role object escapes through a fake get method',s=>exact(s,'      // Read initial filters from URL',"      const unsafe={get(record){record.applyUrl='https://other.invalid/apply'}};state.jobs.forEach(record=>unsafe.get(record));\n      // Read initial filters from URL")],
 ['document primitive escapes through a fake get method',s=>exact(s,'      const res = await fetch(API_URL);',"      const unsafe={get(owner){owner.createElement=()=>null}};unsafe.get(document);const res = await fetch(API_URL);")]
])test('Configured receiver holds '+name,()=>refuse(programme(edit)))

for(const[name,edit]of[
 ['same Response receiver',s=>exact(s,'await res.json()','await res.json.call(res)')],
 ['same complete filter receiver',s=>exact(s,'state.jobs.filter((job) => {','state.jobs.filter.call(state.jobs, (job) => {')],
 ['same filtered role-loop receiver',s=>exact(s,'state.filteredJobs.forEach((job) => {','state.filteredJobs.forEach.call(state.filteredJobs, (job) => {')],
 ['same URL parameter receiver',s=>exact(s,"state.filters.locations   = params.getAll('location')","state.filters.locations   = params.getAll.call(params,'location')")]
])test('Configured receiver preserves '+name,()=>assert.equal(qualify(programme(edit)).defaultUnfiltered,true))

for(const condition of['0','null',"''",'!1'])test('Configured receiver preserves inactive while('+condition+') unrelated mutation',()=>assert.equal(qualify(before('while('+condition+'){window.fetch=()=>null}')).defaultUnfiltered,true))

test('Configured receiver baseline is the actual current original',()=>assert.equal(qualify(original).defaultUnfiltered,true))
