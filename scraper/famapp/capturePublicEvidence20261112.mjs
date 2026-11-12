import fs from 'node:fs'
import {gzipSync,gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const file='scraper/famapp/test-data-20261112/public-contract-originals.json.gz'
fs.mkdirSync('scraper/famapp/test-data-20261112',{recursive:true})
const capture=fs.existsSync(file)?JSON.parse(gunzipSync(fs.readFileSync(file))):{capturedAt:new Date().toISOString(),responses:[]}
const requested=process.argv.slice(2)
const urls=requested[0]==='--assets'?[...new Set(capture.responses.filter(response=>['https://www.famapp.in/','https://www.famapp.in/careers/','https://www.famapp.in/jobs/','https://www.famapp.in/fam-hq/'].includes(response.requestedUrl)).flatMap(response=>
 readNativeDocument(response.body).nodes(node=>node.tag==='script'&&node.attrs.src?.startsWith('/_next/')).map(node=>new URL(node.attrs.src,response.requestedUrl).href)))].filter(url=>!capture.responses.some(response=>response.requestedUrl===url)):requested
for(const url of urls){
 const parsed=new URL(url)
 if(!['https://www.famapp.in','https://jobs.lever.co','https://api.lever.co'].includes(parsed.origin)||parsed.username||parsed.password||parsed.hash
  ||parsed.hostname==='jobs.lever.co'&&!/^\/fampay(?:\/|$)/.test(parsed.pathname)
  ||parsed.hostname==='api.lever.co'&&!/^\/v0\/postings\/fampay(?:\/|$)/.test(parsed.pathname))throw Error('Only delegated public Fam surfaces are permitted')
 const requestedAt=new Date().toISOString()
 try{
  const response=await fetch(url,{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Mozilla/5.0',Accept:'*/*'}})
  const bytes=Buffer.from(await response.arrayBuffer())
  if(bytes.length>5000000)throw Error('Public evidence response exceeds byte budget')
  const receipt={requestedUrl:url,requestedAt,completedAt:new Date().toISOString(),method:'GET',requestBody:null,
   status:response.status,finalUrl:response.url,contentType:response.headers.get('content-type'),redirectLocation:response.headers.get('location'),
   bodyBytes:bytes.length,bodySha256:createHash('sha256').update(bytes).digest('hex'),body:bytes.toString('utf8')}
  capture.responses.push(receipt)
  console.log(JSON.stringify({url,status:receipt.status,contentType:receipt.contentType,bytes:receipt.bodyBytes,sha256:receipt.bodySha256,redirectLocation:receipt.redirectLocation}))
 }catch(error){capture.responses.push({requestedUrl:url,requestedAt,completedAt:new Date().toISOString(),error:error.message});console.log(JSON.stringify({url,error:error.message}))}
 fs.writeFileSync(file,gzipSync(JSON.stringify(capture)))
}
