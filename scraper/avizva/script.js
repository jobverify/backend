import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AVIZVA_CATALOG } from './catalog.js'
import {collectCurrentAvizva,hasCurrentOfficialCareersSignal} from './currentNative.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AVIZVA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

export const hasOfficialCareersSignal = hasCurrentOfficialCareersSignal

export const extractJobs = (html = '') => {
  const doc=readVisibleNativeDocument(String(html),{strict:true})
  const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children
    .filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
  return doc.nodes(node=>['section','div'].includes(node.tag)&&/(?:^|\s)(?:job-box|job-card)(?:\s|$)/.test(node.attrs.class||''))
    .map(block=>{
      const paragraphs=within(block,node=>node.tag==='p').map(doc.text)
      const list=within(block,node=>node.tag==='li').map(doc.text)
      const apply=within(block,node=>node.tag==='a'&&/^Apply Now$/i.test(doc.text(node))
        &&/^https:\/\/avizva\.keka\.com\/careers\/jobdetails\/[1-9]\d*$/.test(node.attrs.href?.trim()||''))
      return{title:within(block,node=>node.tag==='h3').map(doc.text)[0]||'',department:paragraphs[0]||list[0]||'',
        experienceRequired:paragraphs[1]||list[1]||'',locations:list.map(value=>value.replace(/\s*-\s*India$/i,', India'))
          .filter(value=>/,\s*India$/i.test(value)),applyUrl:apply.length===1?apply[0].attrs.href.trim():null}
    }).filter(job=>job.title&&job.applyUrl&&job.locations.length>0)
}

// Historical card parsing above remains available for fixture review. Live
// collection requires the current native active feed and full role evidence.
export const createAvizvaScraper = (configuration = {}) => ({
  run: (overrides = {}) => collectCurrentAvizva({...configuration,...overrides}),
})

export const run = async (options = {}) => createAvizvaScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
