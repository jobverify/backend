import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const SOURCE='waydotcomindia',CAREERS='https://www.way.com/careers'
export async function runCurrentWay(options={}){
 const io=createCurrentReader(options,[[CAREERS,'html']],{maxReads:1})
 let observedModel=null
 try{
  const page=await io.read(CAREERS),doc=readNativeDocument(page.text);observedModel={url:CAREERS,head:activeHead(page.text),originalBody:page.text,nativeScripts:doc.nodes(n=>n.tag==='script').map(n=>n.attrs)};io.check();need(false,'newly accessible careers entity is unreviewed; no inferred jobs or company zero')
 }catch(error){options.signal?.throwIfAborted();if(error&&typeof error==='object'&&Object.isExtensible(error))Object.defineProperty(error,'nativeCollectionEvidence',{value:{source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,observedEmployerVacancyCount:null,failedAcquisition:true,observedModel,acquisition:io.stats()},configurable:true});options.signal?.throwIfAborted();if(!Number.isInteger(error?.status)&&!Number.isInteger(error?.httpStatus))io.check();throw error}finally{io.close()}
}
