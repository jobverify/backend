import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const SOURCE='systemtwo',HOME='https://system-two.ai/'
export async function runCurrentSystemTwo(options={}){
 const io=createCurrentReader(options,[[HOME,'html']],{maxReads:1});let observedModel=null
 try{const page=await io.read(HOME);observedModel={url:HOME,head:activeHead(page.text),originalBody:page.text};io.check();need(false,'newly accessible configured publisher remains unreviewed; no complete company zero or inferred jobs')
 }catch(error){options.signal?.throwIfAborted();if(error&&typeof error==='object'&&Object.isExtensible(error))Object.defineProperty(error,'nativeCollectionEvidence',{value:{source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,observedEmployerVacancyCount:null,failedAcquisition:true,observedModel,acquisition:io.stats()},configurable:true});options.signal?.throwIfAborted();if(!Number.isInteger(error?.status)&&!Number.isInteger(error?.httpStatus))io.check();throw error}finally{io.close();options.signal?.throwIfAborted()}
}
