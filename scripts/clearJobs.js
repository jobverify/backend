/**
 * clearJobs.js — Delete all Job documents from MongoDB.
 *
 * Usage:
 *   node scripts/clearJobs.js --confirm
 *
 * The --confirm flag is required to prevent accidental runs.
 */

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(currentDir, '../.env') })

if (process.env.NODE_ENV === 'production') {
  console.error('This script cannot be run in production')
  process.exit(1)
}

if (!process.argv.includes('--confirm')) {
  console.error('Safety check: pass --confirm to actually delete all jobs.')
  console.error('  node scripts/clearJobs.js --confirm')
  process.exit(1)
}

const { default: connectDB } = await import('../db/db.js')
const { default: Job } = await import('../src/models/Job.js')

await connectDB()

const { deletedCount } = await Job.deleteMany({})
console.log(`✓ Deleted ${deletedCount} job document(s).`)

await mongoose.disconnect()
process.exit(0)
