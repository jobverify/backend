import { fileURLToPath } from 'node:url'
import {runCurrentDrLal} from './currentNative.js'

export const CAREER_PAGE_URL = 'https://www.lalpathlabs.com/career/submit-your-cv'

export const validateNoOpeningsPage = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Submit Your CV to Dr Lal PathLabs\s*<\/title>/i.test(page)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.lalpathlabs\.com\/career\/submit-your-cv["'][^>]*>/i.test(page)
    && /Find a Job\s*&amp;\s*Grow Your Career/i.test(page)
    && /Attach your Updated Resume,?\s*Max size 2MB/i.test(page)
}

export const createDrLalPathlabsScraper = () => ({
  run: (options={})=>runCurrentDrLal(options),
})

export const run = async (options) => createDrLalPathlabsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`Dr Lal PathLabs jobs scraped: ${jobs.length}`)
}
