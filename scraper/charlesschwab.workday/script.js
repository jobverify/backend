import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {createFirstPartyHTMLScraper,createHTMLTransport} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {nativePostingJobs} from '../../scraper-support/shared/nativeJobPosting.js'
import {createSourceConfig,HOME} from './parser.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "charlesschwab"
export const COMPANY = "Charles Schwab"
export const CAREERS_URL = HOME

const transientReadError = error => ['ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','EAI_AGAIN'].includes(error?.code||error?.cause?.code)
 || error?.code==='WINDOWS_HTTP_FAILED'&&/connection (?:was )?closed|transport connection|socket|timed?\s*out/i.test(error.message)

export const run = (options={}) => {
 const config=createSourceConfig(options)
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(540000)]):AbortSignal.timeout(540000),baseTransport=options.transport||createHTMLTransport(config,{...options,signal}),retries=[]
 let physicalReadAttempts=0,physicalResponseBytes=0
 const transport=async(url,request)=>{
  for(let attempt=1;attempt<=2;attempt++){
   signal.throwIfAborted()
   if(physicalReadAttempts>=512)throw Object.assign(Error('Schwab physical read limit exceeded'),{code:'NATIVE_READ_LIMIT'})
   physicalReadAttempts++
   const attemptedAt=new Date().toISOString()
   let packet
   try{packet=await baseTransport(url,request);if(!packet)return packet}catch(error){
    const transient=transientReadError(error),willRetry=transient&&attempt===1&&!signal.aborted
    if(transient)retries.push({url,attempt,kind:'transient-transport-error',code:error.code||error.cause?.code||null,attemptedAt,completedAt:new Date().toISOString(),willRetry})
    if(!willRetry)throw error
   }
   if(packet){
    physicalResponseBytes+=packet.body instanceof Uint8Array?packet.body.byteLength:0
    if(physicalResponseBytes>64*1024*1024)throw Object.assign(Error('Schwab physical response byte limit exceeded'),{code:'NATIVE_READ_LIMIT'})
    if(![502,503,504].includes(packet.status)||attempt===2)return packet
    retries.push({url,attempt,kind:'transient-upstream-status',status:packet.status,attemptedAt,completedAt:new Date().toISOString(),willRetry:true})
   }
   await new Promise(resolve=>setTimeout(resolve,250))
  }
 }
 const telemetry=result=>Object.assign(result,{nativeTransportRetries:retries.slice(),physicalReadAttempts,physicalResponseBytes})
 config.projectJobs=result=>nativePostingJobs(telemetry(result),config).map(j=>({...j,title:j.title.replace(/[\u200b-\u200d\ufeff]/g,''),requisitionId:j.nativeFacts.sourceRequisitionID,nativeDatePosted:j.nativeFacts.nativePostedDate.raw,nativeTalentBrewJobID:j.nativeFacts.nativeTalentBrewJobID,minimumQualification:j.nativeFacts.minimumQualification,employmentType:j.nativeFacts.nativeEmploymentType,state:j.nativeCountryAddresses[0].raw.addressRegion??null}))
 return createFirstPartyHTMLScraper(config).run({...options,signal,transport}).catch(error=>{if(error.nativeEvidence)telemetry(error.nativeEvidence);throw error})
}

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
