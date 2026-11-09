/**
 * Preview or physically remove old expired jobs.
 *
 * Usage:
 *   npm run db:purge-expired
 *   npm run db:purge-expired -- --confirm
 *   npm run db:purge-expired -- --confirm --retention-days=14 --max-mb=50
 */

import mongoose from 'mongoose'
import connectDB from '../db/db.js'
import {
  DEFAULT_EXPIRED_JOB_PURGE_RETENTION_DAYS,
  purgeExpiredJobsForQuotaRecovery,
} from '../scraper-support/utils/saveToDB.js'

const parsePositiveIntegerFlag = (name, fallback) => {
  const prefix = `--${name}=`
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const shouldConfirm = process.argv.includes('--confirm')
const retentionDays = parsePositiveIntegerFlag(
  'retention-days',
  DEFAULT_EXPIRED_JOB_PURGE_RETENTION_DAYS,
)
const maxMegabytes = parsePositiveIntegerFlag('max-mb', null)

const main = async () => {
  await connectDB()
  const result = await purgeExpiredJobsForQuotaRecovery({
    retentionDays,
    targetBytes: maxMegabytes ? maxMegabytes * 1024 * 1024 : Number.MAX_SAFE_INTEGER,
    dryRun: !shouldConfirm,
  })

  console.log(JSON.stringify({
    mode: shouldConfirm ? 'deleted' : 'preview',
    ...result,
    estimatedMegabytes: Number((result.estimatedBytes / (1024 * 1024)).toFixed(2)),
  }, null, 2))

  if (!shouldConfirm) {
    console.log('\nPreview only. Re-run with --confirm to delete these expired jobs.')
  }
}

main()
  .catch((error) => {
    console.error('Expired-job purge failed:', error.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
