import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
export const HOME='https://www.autoform.com/en/',CAREERS='https://careers.autoform.com/en/',SEARCH=CAREERS+'jobs/job-search/'
export const original=()=>{
 const data=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-opening-20261027.json.gz',import.meta.url))))
 for(const r of Object.values(data.responses))if(createHash('sha256').update(r.body).digest('hex')!==r.originalSha256)throw Error('Actual fixture byte drift')
 return data.responses
}
export const transport=(mutate,options={})=>{
 const responses=original();mutate?.(responses)
 const calls=[],counts=new Map()
 const fetchPage=async url=>{
  calls.push(url);counts.set(url,(counts.get(url)||0)+1)
  if(options.failure)throw options.failure
  const page=responses[url];if(!page)throw Error('Unexpected offline URL '+url)
  const copy=structuredClone(page)
  if(options.onResponse)options.onResponse(copy,{url,call:counts.get(url),calls})
  return copy
 }
 return {calls,fetchPage,fetchText:async url=>{const p=await fetchPage(url);if(p.status!==200)throw Object.assign(Error('HTTP '+p.status),{status:p.status});return p.body}}
}
