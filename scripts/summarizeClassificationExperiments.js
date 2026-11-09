import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const labels = new Set(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract'])
const read = file => { try { return JSON.parse(fs.readFileSync(file)) } catch { return null } }
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

export function summarizeClassificationExperiments(directory) {
  return ['base', 'instruct', 'base-int8'].flatMap(prefix => {
    const file = suffix => path.join(directory, `${prefix}-probe-${suffix}.json`)
    const selection = read(file('selection'))
    if (!selection) return []
    const kind = prefix.startsWith('base') ? 'base' : 'instruct'
    const summary = { prefix, model: selection.model, revision: selection.revision,
      precision: selection.precision || 'float32', variant: selection.variant,
      diagnosticOnly: true, activeInFullRun: false, development: null, validation: null, timing: null,
      passedDevelopmentGate: selection.beatsBaseline === true && selection.passesCompressionGate !== false,
      compressionGate: selection.compressionGate || null, issues: [] }
    for (const stage of ['development', 'validation', 'performance']) {
      const result = read(file(stage === 'development' ? 'results' : `${stage}-results`))
      if (!result) continue
      const packetFile = path.join(directory, stage === 'development' ? 'instruct-probe-development.json' : `${kind}-probe-${stage}.json`)
      const packet = read(packetFile)
      const rows = result.variants?.[selection.variant]?.rows
      if (!packet || result.model !== selection.model || result.revision !== selection.revision
        || (stage !== 'development' && (result.selectionSha256 !== sha(file('selection')) || result.packetSha256 !== sha(packetFile)))) {
        summary.issues.push(`${stage}_provenance_mismatch`)
        continue
      }
      const source = new Map(packet.rows?.map(row => [row.id, row]) || [])
      if (!Array.isArray(rows) || rows.length !== source.size || new Set(rows.map(row => row.id)).size !== rows.length
        || rows.some(row => !source.has(row.id) || (stage !== 'performance' && row.gold !== source.get(row.id).label))) {
        summary.issues.push(`${stage}_incomplete_or_changed_references`)
        continue
      }
      if (stage !== 'performance') {
        if (rows.some(row => !labels.has(row.model))) { summary.issues.push(`${stage}_invalid_predictions`); continue }
        const eligible = rows.filter(row => labels.has(row.gold))
        const correct = eligible.filter(row => row.model === row.gold).length
        summary[stage] = { processed: rows.length, evaluated: eligible.length, correct,
          excluded: rows.length-eligible.length, accuracy: eligible.length ? correct/eligible.length : null }
        continue
      }
      if (result.phase !== 'performance' || !rows.length || rows.some(row => !row.fullDescriptionCovered
        || !Number.isInteger(row.windows) || row.windows < 1 || !Number.isFinite(row.seconds) || row.seconds < 0)) {
        summary.issues.push('performance_incomplete_coverage')
        continue
      }
      const times = rows.map(row => row.seconds).sort((a,b) => a-b)
      const seconds = times.reduce((total,value) => total+value,0), mean = seconds/rows.length
      summary.timing = { records: rows.length, cpuThreads: result.cpuThreads, inferenceSeconds: seconds,
        meanSeconds: mean, medianSeconds: times[Math.ceil(times.length*.5)-1],
        p95Seconds: times[Math.ceil(times.length*.95)-1], p99Seconds: times[Math.ceil(times.length*.99)-1],
        maxSeconds: times.at(-1), meanCpuSeconds: rows.every(row => Number.isFinite(row.cpuSeconds))
          ? rows.reduce((total,row) => total+row.cpuSeconds,0)/rows.length : null,
        peakInferenceRssBytes: Math.max(...rows.map(row => row.peakRssBytes || 0)),
        startupPeakRssBytes: result.startupPeakRssBytes ?? null,
        packetSha256: result.packetSha256,
        projections: [...new Set([30000,35000,packet.eligible])].filter(Number.isSafeInteger).map(jobs => ({ jobs,
          minimumWorkersAtFiveHours: Math.ceil(jobs*mean/18000),
          balancedInferenceHours: Object.fromEntries([4,8,12,16,20].map(workers => [workers,jobs*mean/workers/3600])),
        })),
        caveat: 'Timing-only sample; local inference excludes startup, MongoDB and imbalance. This is not measured GitHub runtime or population accuracy.' }
    }
    return [summary]
  })
}
