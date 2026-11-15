import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runMobiloitteNative} from './nativeCurrent.js'
import {MOBILOITTE_TECHNOLOGIES_CATALOG} from './catalog.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA=MOBILOITTE_TECHNOLOGIES_CATALOG
export const SOURCE=PROVIDER_METADATA.source
export const COMPANY=PROVIDER_METADATA.companyName
export const CAREERS_URL=PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON=null
const pageText=html=>{const doc=readVisibleNativeDocument(html);return doc.text(doc.nodes(node=>node.tag==='root')[0])}
// These are visible observations only; neither can authorize an empty result.
export const hasOfficialCareersSignal=(html='')=>{const text=pageText(html);return text.includes('Careers at Mobiloitte That Build Your Future')&&text.includes('Current Openings')&&text.includes('careers@mobiloitte.com')}
export const hasNoJobsFoundState=(html='')=>{const text=pageText(html);return text.includes('No Jobs Found')&&text.includes("We couldn't find any jobs matching your criteria.")}
export const createMobiloitteTechnologiesScraper=()=>({run:options=>runMobiloitteNative(options)})
export const run=options=>runMobiloitteNative(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
