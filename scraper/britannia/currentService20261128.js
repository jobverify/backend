import {createHash} from 'node:crypto'
import {parseExpressionAt} from 'acorn'

// This is an additional service check for the exact November 28 main bundle
// pinned by publicClient.js. It never qualifies a bundle without that byte
// check and never executes any downloaded JavaScript.
// The five complete methods (including constructor) are byte-identical to the
// retained November 13 client. In particular, the listing POST uses the caller's
// organization, page type and filters, and returns that response's Result;
// full-role GET uses the caller's native identity and visibility field.
const methods=Object.freeze({
 constructor:'ef4edbcc36a22646c89217ea50f07cb7193124c34206078adf91501e289065ab',
 getUnAuthenticatedAccessToken:'183e7ca3f427eada63e28039f7099bf15380fab0f36dd864c7a7b300a516cf45',
 getPublicOrgInfo:'c930e4bc62256d242ac81f814296659ed963f86331fdf8ce82a183e796f54e50',
 getPublicJobRefsForOrgFiltered:'1ff4475912058afd8d11ac5f633f73bc21bd2b917d982393ed2f154fd0e463b1',
 getJobInfoPublic:'3723cf419f885251cabf21f3ed6109353123540ae4f9ed4d6e0705da2669d14d',
})
const check=(condition,message)=>{
 if(!condition)throw Object.assign(Error('britannia current TurboHire client: '+message),{abortRetries:true,incompleteScope:true})
}

export const qualifyCurrentBritanniaService=body=>{
 check(typeof body==='string'&&Buffer.byteLength(body)<=25*1024*1024,'unreviewed current service body')
 const declarations=[...body.matchAll(/class\s+[A-Za-z_$][\w$]*\{constructor\(\)\{this\.API_SERVER_BASE_URL="(https:[^"]+)"/g)]
 check(declarations.length===2
  &&declarations[0][1]==='https://thapi-stage2.azurewebsites.net'
  &&declarations[1][1]==='https://th-scoring-engine.turbohire.co','current public and scoring service declarations changed')
 let service
 try{service=parseExpressionAt(body,declarations[0].index,{ecmaVersion:'latest'})}
 catch{check(false,'current native public service cannot be parsed')}
 check(service.type==='ClassExpression'&&service.superClass===null&&service.body.body.length===1303,'current native public service structure changed')
 for(const [name,digest] of Object.entries(methods)){
  const nodes=service.body.body.filter(node=>node.key?.name===name)
  check(nodes.length===1&&nodes[0].type==='MethodDefinition'&&!nodes[0].computed&&!nodes[0].static
   &&nodes[0].kind===(name==='constructor'?'constructor':'method')
   &&createHash('sha256').update(body.slice(nodes[0].start,nodes[0].end)).digest('hex')===digest,
  'current native public '+name+' binding changed')
 }
 return {apiBaseURL:declarations[0][1],publicMethods:Object.keys(methods)}
}
