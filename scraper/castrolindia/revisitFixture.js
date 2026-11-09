// Test-only immutable original public HTTP packets for the four-source revisit.
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const sha=b=>createHash('sha256').update(b).digest('hex')
export function revisitFixture(metaUrl){
 const manifest=JSON.parse(fs.readFileSync(new URL('./test-data/revisit-manifest-20261103.js',metaUrl),'utf8').replace(/^export default /,'')),archive=fs.readFileSync(new URL('./test-data/revisit-20261103.json.gz',metaUrl))
 if(sha(archive)!==manifest.fixtureSha256)throw Error('Original revisit archive integrity mismatch')
 const rows=JSON.parse(gunzipSync(archive))
 for(const row of rows){const body=Buffer.from(row.bodyBase64,'base64');if(sha(body)!==row.sha256||body.length!==row.bytes)throw Error('Original revisit body integrity mismatch')}
 const row=url=>{const r=rows.findLast(r=>r.requestedUrl===url||r.url===url);if(!r)throw Error('Unpublished original fixture URL '+url);return r},body=url=>Buffer.from(row(url).bodyBase64,'base64'),text=url=>body(url).toString('utf8')
 return{rows,row,body,text,fetchImpl:async url=>{const packet=row(url),response=new Response(body(url),{status:packet.status,headers:{'content-type':packet.contentType,...packet.publicHeaders}});Object.defineProperty(response,'url',{value:packet.url});return response}}
}
