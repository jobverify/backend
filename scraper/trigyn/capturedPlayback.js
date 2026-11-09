// Test/audit utility: immutable HTTP response playback; never imported by production.
import {readFileSync,existsSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'

export const readCapture=name=>{
  const url=new URL(`./fixtures/${name}.json`,import.meta.url)
  return JSON.parse(existsSync(url)?readFileSync(url):gunzipSync(readFileSync(new URL(`${url.href}.gz`))))
}

export const createCapturedFetch=(transform=value=>value)=>{
  const careers=readCapture('careers-response'),clients=[...readCapture('client-responses'),...readCapture('raw-client-responses')]
  const listings=readCapture('native-responses'),details=[...readCapture('detail-responses'),...readCapture('foreign-detail-responses')]
  return async(url,options={})=>{
    const captured=url===careers.url?careers:url==='https://www.trigyn.com/get-career-data'
      ?listings.find(row=>row.requestBody===options.body):[...clients,...details].find(row=>row.url===url)
    if(!captured)throw Error(`Uncaptured Trigyn request: ${url}`)
    if(captured.requestBody&&(options.method!=='POST'||options.headers?.['content-type']!=='application/x-www-form-urlencoded; charset=UTF-8'))throw Error('Trigyn capture method/content-type mismatch')
    const row=transform(structuredClone(captured),options)
    return {status:row.status,url:row.finalUrl,text:async()=>row.body}
  }
}
