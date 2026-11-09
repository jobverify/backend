import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { summarizeClassificationExperiments } from '../scripts/summarizeClassificationExperiments.js'

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classification-experiments-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const write = (name,value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value))
  const hash = name => createHash('sha256').update(fs.readFileSync(path.join(directory,name))).digest('hex')
  const selection = { model: 'fixture', revision: 'revision', variant: 'original_labels', beatsBaseline: true }
  write('base-probe-selection.json', selection)
  return {directory,write,hash,selection}
}

test('frozen validation counts only clear references and refuses changed source labels', t => {
  const {directory,write,hash,selection} = fixture(t)
  const packet = { rows: [{id:'clear',label:'Intern'},{id:'unclear',label:'Ambiguous'}] }
  write('base-probe-validation.json',packet)
  const result = {...selection, selectionSha256:hash('base-probe-selection.json'),
    packetSha256:hash('base-probe-validation.json'), variants:{original_labels:{rows:[
      {id:'clear',gold:'Intern',model:'Intern'},
      {id:'unclear',gold:'Ambiguous',model:'Full-time Experienced'},
    ]}}}
  write('base-probe-validation-results.json',result)
  const summary = summarizeClassificationExperiments(directory).find(row => row.prefix === 'base')
  assert.deepEqual(summary.validation,{processed:2,evaluated:1,correct:1,excluded:1,accuracy:1})
  assert.equal(summary.diagnosticOnly,true)
  write('base-probe-validation.json',{rows:[{id:'clear',label:'Contract'},{id:'unclear',label:'Ambiguous'}]})
  const stale = summarizeClassificationExperiments(directory).find(row => row.prefix === 'base')
  assert.equal(stale.validation,null)
  assert.ok(stale.issues.includes('validation_provenance_mismatch'))
})

test('timing requires every frozen record, excludes accuracy, and projects inference only', t => {
  const {directory,write,hash,selection} = fixture(t)
  const packet = { eligible: 39026, rows:[{id:'fast'},{id:'slow'}] }
  write('base-probe-performance.json',packet)
  const result = {...selection, phase:'performance',precision:'float32',cpuThreads:1,
    selectionSha256:hash('base-probe-selection.json'),packetSha256:hash('base-probe-performance.json'),
    startupPeakRssBytes:300,variants:{original_labels:{rows:[
      {id:'fast',seconds:1,cpuSeconds:.9,windows:1,fullDescriptionCovered:true,peakRssBytes:100},
    ]}}}
  write('base-probe-performance-results.json',result)
  assert.equal(summarizeClassificationExperiments(directory)[0].timing,null)
  result.variants.original_labels.rows.push({id:'slow',seconds:3,cpuSeconds:2.8,windows:2,fullDescriptionCovered:true,peakRssBytes:200})
  write('base-probe-performance-results.json',result)
  const summary = summarizeClassificationExperiments(directory)[0]
  assert.equal(summary.timing.meanSeconds,2)
  assert.equal(summary.timing.p95Seconds,3)
  assert.equal(summary.timing.startupPeakRssBytes,300)
  assert.equal(summary.validation,null)
  const projected = summary.timing.projections.find(row => row.jobs === 35000)
  assert.equal(projected.minimumWorkersAtFiveHours,4)
  assert.equal(projected.balancedInferenceHours['4'],35000*2/4/3600)
  result.variants.original_labels.rows[1].fullDescriptionCovered=false
  write('base-probe-performance-results.json',result)
  assert.equal(summarizeClassificationExperiments(directory)[0].timing,null)
})
