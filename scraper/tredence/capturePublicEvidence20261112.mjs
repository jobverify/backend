import fs from 'node:fs'
import {gzipSync,gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const file='scraper/tredence/test-data/public-contract-originals-20261112.json.gz'
const capture=fs.existsSync(file)?JSON.parse(gunzipSync(fs.readFileSync(file))):{capturedAt:new Date().toISOString(),responses:[]}
const urls=process.argv.slice(2)
for(const url of urls){
 const parsed=new URL(url)
 if(!['https://tredence.ripplehire.com','https://www.tredence.com'].includes(parsed.origin)||parsed.username||parsed.password||parsed.hash)throw Error('Only delegated public Tredence surfaces are permitted')
 const requestedAt=new Date().toISOString()
 try{
  const jsonEndpoint=/\/candidate\/(?:candidatejobdetail|companyinfo|getcompanylang|getcandidatecompanydetails)$/.test(parsed.pathname)
  const requestHeaders={'User-Agent':'Mozilla/5.0',Accept:jsonEndpoint?'application/json, text/javascript, */*; q=0.01':'*/*',
   ...(jsonEndpoint?{'X-Requested-With':'XMLHttpRequest'}:{})}
  const response=await fetch(url,{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(20000),headers:requestHeaders})
  const bytes=Buffer.from(await response.arrayBuffer()),body=bytes.toString('utf8')
  if(bytes.length>5000000)throw Error('Public evidence response exceeds byte budget')
  const receipt={requestedUrl:url,requestedAt,completedAt:new Date().toISOString(),method:'GET',requestBody:null,
   status:response.status,finalUrl:response.url,contentType:response.headers.get('content-type'),redirectLocation:response.headers.get('location'),requestHeaders,
   bodyBytes:bytes.length,bodySha256:createHash('sha256').update(bytes).digest('hex'),body}
  capture.responses.push(receipt)
  const doc=/text\/html/i.test(receipt.contentType||'')?readNativeDocument(body):null
  console.log(JSON.stringify({url,status:receipt.status,contentType:receipt.contentType,bytes:receipt.bodyBytes,sha256:receipt.bodySha256,
   redirectLocation:receipt.redirectLocation,scripts:doc?.nodes(node=>node.tag==='script'&&node.attrs.src).map(node=>node.attrs.src),
   nativeRecruitingLinks:doc?.nodes(node=>node.tag==='a'&&/ripplehire|career|job|joining|apply/i.test(node.attrs.href||'')).map(node=>({href:node.attrs.href,label:doc.text(node).slice(0,100)}))}))
 }catch(error){capture.responses.push({requestedUrl:url,requestedAt,completedAt:new Date().toISOString(),error:error.message});console.log(JSON.stringify({url,error:error.message}))}
 fs.writeFileSync(file,gzipSync(JSON.stringify(capture)))
}
