import fs from 'node:fs'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {BASE,CAREERS,BOARD,REBRAND,CONTACT,FEEDS,check,verifyBinding,parseFeed,parseJobs} from './nativeContract.js'
const client=JSON.parse(fs.readFileSync(new URL('./nativeClient.json',import.meta.url)))
export async function runNative(options={}){
 const now=new Date(options.now??Date.now()).toISOString(),timeout=options.timeoutMs??90000
 check(options.maxJobs==null,'Partial cap is unsupported');check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000,'Invalid deadline')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Crest deadline exceeded')),timeout)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 async function request(url){
  signal.throwIfAborted();let abort
  try{return await Promise.race([new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true})}),(async()=>{
   const r=await(options.fetch??fetch)(url,{method:'GET',headers:{Accept:'text/html,application/json'},redirect:'error',signal})
   signal.throwIfAborted();check(r.status===200&&r.url===url,'Native HTTP status or final URL mismatch')
   const body=await r.text();signal.throwIfAborted();check(Buffer.byteLength(body)<=3000000,'Native response too large')
   return{body,headers:r.headers}
  })()])}finally{signal.removeEventListener('abort',abort)}
 }
 try{
  const pages=[];for(const url of[BASE,CAREERS,BOARD,REBRAND,CONTACT])pages.push((await request(url)).body)
  verifyBinding(pages,client)
  const feeds=[];for(const url of FEEDS)feeds.push(await request(url))
  const [rows,locations,teams]=feeds.map(parseFeed),details=[]
  check(rows.every(r=>typeof r.link==='string'&&/^https:\/\/www\.crestdata\.ai\/jobs\/[a-z0-9-]+\/$/.test(r.link)),'Invalid role URL')
  for(const row of rows)details.push((await request(row.link)).body)
  const jobs=parseJobs(rows,locations,teams,details,now)
  for(let i=0;i<FEEDS.length;i++){
   const final=await request(FEEDS[i]);parseFeed(final)
   check(final.body===feeds[i].body&&final.headers.get('x-wp-total')===feeds[i].headers.get('x-wp-total')&&final.headers.get('x-wp-totalpages')===feeds[i].headers.get('x-wp-totalpages'),'Final native inventory/taxonomy drift')
  }
  signal.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'Complete stable observed WordPress public feed and exact role pages; whole-company recruiting scope unproven. Native country absent, exact India offices corroborated separately.'})
 }finally{clearTimeout(timer);controller.abort()}
}
