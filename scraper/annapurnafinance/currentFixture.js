// Test-only original public packets; the own-role fixture is explicitly projected.
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const sha=b=>createHash('sha256').update(b).digest('hex'),folder=new URL('./test-data/current-20261103/',import.meta.url)
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder))),archive=fs.readFileSync(new URL('public-packets.json.gz',folder))
if(sha(archive)!==manifest.archiveSha256)throw Error('Annapurna public archive integrity mismatch')
const packets=JSON.parse(gunzipSync(archive)),map=new Map(packets.map(r=>{const body=Buffer.from(r.bodyBase64,'base64');if(sha(body)!==r.sha256||body.length!==r.bytes)throw Error('Annapurna public packet integrity mismatch');return[r.label,{...r,body:body.toString('utf8')}]}))
export const fixturePacket=label=>{const p=map.get(label);if(!p)throw Error('Unknown original public packet label');return p}
export const TEST_PORTAL_URL='https://career.hrone.cloud/career-portal?appId=TEST_ONLY_PUBLIC_APPID&dc=annapurna&rqt=TEST_ONLY_PUBLIC_RQT&cc=TEST_ONLY_PUBLIC_COMPANY'
export function currentFixture({fullOriginalPagination=false,transform}={}){
 const calls=[]
 const reader=async(url,request={})=>{
  calls.push({url,method:request.method??'GET',body:request.body,signal:request.signal})
  let packet,status=200,body,headers={}
  if(url==='https://hr1.to//8e09c5'){status=302;body='';headers.location=TEST_PORTAL_URL}
  else if(url===TEST_PORTAL_URL)packet=fixturePacket('portal')
  else if(url==='https://gateway.app.hrone.cloud/api/external/public/referral/CareerPosition/Details'){
   const search=JSON.parse(request.body),page=search.pagination.pageNumber
   if(fullOriginalPagination)packet=fixturePacket('list-page-'+page)
   else body=JSON.stringify(page===1?[JSON.parse(fixturePacket('list-page-1').body)[0]]:[])
  }else if(url.startsWith('https://gateway.app.hrone.cloud/api/external/public/referral/JobOpening/Request/Details/'))packet=fixturePacket('own-role-1947-public-projection')
  else packet=packets.find(p=>p.url===url)&&map.get(packets.find(p=>p.url===url).label)
  if(body===undefined)body=packet?.body
  if(body===undefined)throw Error('Test harness rejects undeclared public route')
  const response={url,status,headers:new Headers(headers),text:async()=>body}
  return transform?await transform({url,request,body,status,response,calls,packet})??response:response
 }
 return{calls,fetchPage:reader,fetchImpl:reader}
}
