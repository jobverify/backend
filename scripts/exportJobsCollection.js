import { createWriteStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const defaultOutputDirectory = resolve(repositoryRoot, 'artifacts/mongo-exports')

const usage = `Usage: node scripts/exportJobsCollection.js [--output <path>]

Streams every document in the MongoDB jobs collection to a local JSONL file.
The database operation is read-only. A manifest records the document count and
export-file size. The default output directory is artifacts/mongo-exports.`

const parseArguments = (args) => {
  if (args.includes('--help') || args.includes('-h')) return { help: true }

  const outputIndex = args.indexOf('--output')
  if (outputIndex === -1) return {}
  const output = args[outputIndex + 1]
  if (!output || output.startsWith('--')) throw new Error('--output requires a file path')
  return { output: resolve(repositoryRoot, output) }
}

const writeLine = async (stream, value) => {
  if (!stream.write(`${JSON.stringify(value)}\n`)) {
    await new Promise((resolveDrain, rejectDrain) => {
      const onDrain = () => {
        stream.off('error', onError)
        resolveDrain()
      }
      const onError = (error) => {
        stream.off('drain', onDrain)
        rejectDrain(error)
      }
      stream.once('drain', onDrain)
      stream.once('error', onError)
    })
  }
}

const closeStream = (stream) => new Promise((resolveClose, rejectClose) => {
  stream.once('error', rejectClose)
  stream.end(resolveClose)
})

const makeDefaultOutputPath = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return resolve(defaultOutputDirectory, `jobs-${timestamp}.jsonl`)
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(usage)
    return
  }

  dotenv.config({ path: resolve(scriptDirectory, '../.env'), quiet: true })
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured')

  const outputPath = options.output || makeDefaultOutputPath()
  await mkdir(dirname(outputPath), { recursive: true })
  const stream = createWriteStream(outputPath, { encoding: 'utf8', flags: 'wx' })
  let documentCount = 0

  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 30_000 })
    const cursor = mongoose.connection.db.collection('jobs').find({}).batchSize(500)
    for await (const document of cursor) {
      await writeLine(stream, document)
      documentCount += 1
    }
    await closeStream(stream)

    const { size } = await stat(outputPath)
    const manifestPath = outputPath.replace(/\.jsonl$/i, '.manifest.json')
    await writeFile(manifestPath, `${JSON.stringify({
      collection: 'jobs',
      exportedAt: new Date().toISOString(),
      documentCount,
      bytes: size,
      format: 'JSONL',
      databaseOperation: 'read-only',
      exportFile: outputPath,
    }, null, 2)}\n`, 'utf8')

    console.log(`Exported ${documentCount} jobs to ${outputPath}`)
    console.log(`Manifest: ${manifestPath}`)
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error(`Jobs export failed: ${error.message}`)
  process.exitCode = 1
})
