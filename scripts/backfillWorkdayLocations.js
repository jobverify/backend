import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

import connectDB from '../db/db.js'
import Job from '../src/models/Job.js'
import { launchBrowser, createOptimizedPage } from '../scraper-support/utils/browser.js'
import { extractWorkdayDetailLocations } from '../scraper-support/myworkday/locationDetails.js'
import { formatStoredLocationLabel, getPrimaryStoredLocation } from '../src/utils/jobLocations.js'
import { normalizeCity } from '../scraper-support/utils/cityNormalizer.js'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') })

const GROUPED_LOCATION_LABEL_REGEX = /\b\d+\s+Locations?\b/i

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchDetailedLocations = async (page, jobUrl) => {
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-automation-id="locations"]', { timeout: 15_000 }).catch(() => null)
  await wait(750)
  return extractWorkdayDetailLocations(await page.content())
}

const run = async () => {
  await connectDB()

  const jobs = await Job.find({
    status: 'active',
    sourceUrl: /myworkdayjobs\.com/i,
    location: GROUPED_LOCATION_LABEL_REGEX,
  })
    .select('_id title company sourceUrl city location locations')
    .lean()

  console.log(`[backfill] Found ${jobs.length} active Workday jobs with grouped locations.`)

  if (jobs.length === 0) {
    await mongoose.disconnect()
    return
  }

  let browser
  let updated = 0
  let skipped = 0

  try {
    browser = await launchBrowser()
    const page = await createOptimizedPage(browser)

    for (const job of jobs) {
      try {
        const locations = await fetchDetailedLocations(page, job.sourceUrl)
        if (locations.length === 0) {
          skipped += 1
          console.log(`[backfill] Skipped ${job.title} (${job._id}) - no detailed locations found.`)
          continue
        }

        const locationLabel = formatStoredLocationLabel({ ...job, locations })
        const primaryLocation = getPrimaryStoredLocation({ ...job, locations })

        await Job.updateOne(
          { _id: job._id },
          {
            $set: {
              locations,
              location: locationLabel,
              city: normalizeCity(primaryLocation) || primaryLocation || null,
            },
          },
        )

        updated += 1
        console.log(`[backfill] Updated ${job.title} (${job._id})`)
      } catch (error) {
        skipped += 1
        console.warn(`[backfill] Failed ${job.title} (${job._id}): ${error.message}`)
      }
    }
  } finally {
    if (browser) {
      await browser.close()
    }
    await mongoose.disconnect()
  }

  console.log(`[backfill] Complete. Updated: ${updated}. Skipped: ${skipped}.`)
}

run().catch((error) => {
  console.error(`[backfill] Fatal error: ${error.message}`)
  process.exitCode = 1
})
