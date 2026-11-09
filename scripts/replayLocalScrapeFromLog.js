import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { formatFinalSummaryTable } from '../scraper-support/finalSummaryFormatter.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const repoRoot = path.resolve(backendDir, '..')
const resolveExecutionPath = (value) => {
  if (value == null || value === '') return null

  const absolutePath = path.resolve(String(value))
  try {
    return fs.realpathSync.native(absolutePath)
  } catch {
    return absolutePath
  }
}

const DEFAULT_SOURCE_LOG = path.join(
  repoRoot,
  'artifacts',
  'run-logs',
  'local-scrape-20260801T134834',
  'pipeline.log',
)

const SOURCE_PATTERN = /Starting \[([^\]]+)\]\.\.\./g

const resolveAgainstRepoRoot = (value) => (
  path.isAbsolute(value)
    ? value
    : path.resolve(repoRoot, value)
)

const parseArgs = (argv) => {
  const options = {
    sourceLog: DEFAULT_SOURCE_LOG,
    sourceListFile: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--source-log') {
      options.sourceLog = argv[index + 1] || options.sourceLog
      index += 1
      continue
    }

    if (arg === '--source-list-file') {
      options.sourceListFile = argv[index + 1] || null
      index += 1
    }
  }

  return options
}

const extractUniqueSources = (text) => {
  const matches = [...String(text).matchAll(SOURCE_PATTERN)].map((match) => match[1].trim().toLowerCase())
  return [...new Set(matches.filter(Boolean))]
}

const readSourcesFromLog = (logPath) => {
  const raw = fs.readFileSync(logPath)
  const utf16Sources = extractUniqueSources(raw.toString('utf16le'))
  if (utf16Sources.length > 0) return utf16Sources

  const utf8Sources = extractUniqueSources(raw.toString('utf8'))
  if (utf8Sources.length > 0) return utf8Sources

  throw new Error(`No scraper sources could be extracted from ${logPath}`)
}

const readSourcesFromListFile = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8')
  const sources = text
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)

  return [...new Set(sources)]
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const sourceLog = resolveAgainstRepoRoot(options.sourceLog)
  const sourceListFile = options.sourceListFile
    ? resolveAgainstRepoRoot(options.sourceListFile)
    : null
  const sources = sourceListFile
    ? readSourcesFromListFile(sourceListFile)
    : readSourcesFromLog(sourceLog)

  assert.ok(sources.length > 0, 'Expected at least one scraper source from the source log.')
  process.env.SCRAPER_ONLY = sources.join(',')

  console.log(
    `[replay-log] Replaying ${sources.length} scraper sources from ${sourceListFile || sourceLog}`,
  )

  const { runAll } = await import('../scraper-support/runner.js')
  const summary = await runAll()

  console.log('\nFinal Pipeline Summary:')
  console.log(formatFinalSummaryTable(summary))

  const failures = Object.entries(summary)
    .filter(([, result]) => result.success !== true && result.skipped !== true)
    .map(([source, result]) => `${source}: ${result.error || result.failureKind || 'unknown error'}`)

  if (failures.length > 0) {
    console.error(`\n[replay-log] ${failures.length} scraper(s) did not complete successfully.`)
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exitCode = 1
  }
}

const directExecutionModulePath = resolveExecutionPath(fileURLToPath(import.meta.url))
const isDirectExecution = resolveExecutionPath(process.argv[1]) === directExecutionModulePath

if (isDirectExecution) {
  try {
    await main()
  } catch (error) {
    console.error(error.message || error)
    process.exitCode = 1
  }
}
