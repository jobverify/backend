/**
 * Preview or rebuild the jobs text index using the bounded schema fields.
 *
 * Usage:
 *   node scripts/rebuildJobTextIndex.js
 *   node scripts/rebuildJobTextIndex.js --confirm
 */

import mongoose from 'mongoose'
import connectDB from '../db/db.js'

const INDEX_NAME = 'job_search_text'
const INDEX_KEYS = {
  title: 'text',
  company: 'text',
  experienceRequired: 'text',
  requiredSkills: 'text',
}
const INDEX_OPTIONS = {
  name: INDEX_NAME,
  weights: {
    title: 10,
    company: 8,
    requiredSkills: 5,
    experienceRequired: 3,
  },
}

const main = async () => {
  await connectDB()
  const jobs = mongoose.connection.db.collection('jobs')
  const current = (await jobs.listIndexes().toArray())
    .find((index) => index.name === INDEX_NAME)

  console.log(JSON.stringify({
    mode: process.argv.includes('--confirm') ? 'rebuild' : 'preview',
    current: current ? { key: current.key, weights: current.weights } : null,
    desired: { key: INDEX_KEYS, weights: INDEX_OPTIONS.weights },
  }, null, 2))

  if (!process.argv.includes('--confirm')) {
    console.log('\nPreview only. Re-run with --confirm to rebuild the index.')
    return
  }

  if (current) await jobs.dropIndex(INDEX_NAME)
  await jobs.createIndex(INDEX_KEYS, INDEX_OPTIONS)

  const stats = await mongoose.connection.db.command({
    collStats: 'jobs',
    scale: 1024 * 1024,
  })
  console.log(JSON.stringify({
    rebuilt: INDEX_NAME,
    textIndexMB: stats.indexSizes?.[INDEX_NAME] ?? null,
    totalIndexMB: stats.totalIndexSize,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('Job text-index rebuild failed:', error)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
