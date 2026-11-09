import {nativeError} from './nativeTransport20261107.js'

// Preflight the original JSON grammar and decoded object keys BEFORE creating
// native objects. Strings are data; sibling objects have independent key sets.
// JSON.parse then retains its original number, Unicode and own-property semantics.
export function parseNativeJSON(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>3000000)throw nativeError('Native JSON input bound changed')
 let at=0
 const fail=()=>{throw nativeError('Invalid native JSON grammar at offset '+at)}
 const space=()=>{while(at<text.length&&[' ','\t','\n','\r'].includes(text[at]))at++}
 const string=()=>{
  const start=at;if(text[at++]!=='"')fail()
  while(at<text.length){const c=text[at++];if(c==='"')return text.slice(start,at)
   if(c.charCodeAt(0)<32)fail()
   if(c==='\\'){const e=text[at++];if(e==='u'){for(let n=0;n<4;n++)if(!/[0-9a-fA-F]/.test(text[at++]??''))fail()}else if(!['"','\\','/','b','f','n','r','t'].includes(e))fail()}
  }fail()
 }
 const number=()=>{
  if(text[at]==='-')at++
  if(text[at]==='0')at++;else{if(!/[1-9]/.test(text[at]??''))fail();while(/[0-9]/.test(text[at]??''))at++}
  if(text[at]==='.'){at++;if(!/[0-9]/.test(text[at]??''))fail();while(/[0-9]/.test(text[at]??''))at++}
  if(text[at]==='e'||text[at]==='E'){at++;if(text[at]==='+'||text[at]==='-')at++;if(!/[0-9]/.test(text[at]??''))fail();while(/[0-9]/.test(text[at]??''))at++}
 }
 const value=depth=>{
  if(depth>128)throw nativeError('Native JSON nesting bound exceeded')
  space();const c=text[at]
  if(c==='"'){string();return}
  if(c==='{'){
   at++;space();if(text[at]==='}'){at++;return}const keys=new Set()
   for(;;){space();if(text[at]!=='"')fail();const key=JSON.parse(string());if(keys.has(key))throw nativeError('Duplicate native JSON object key at offset '+at);keys.add(key);space();if(text[at++]!==':')fail();value(depth+1);space();const end=text[at++];if(end==='}')return;if(end!==',')fail()}
  }
  if(c==='['){at++;space();if(text[at]===']'){at++;return}for(;;){value(depth+1);space();const end=text[at++];if(end===']')return;if(end!==',')fail()}}
  for(const token of ['true','false','null'])if(text.startsWith(token,at)){at+=token.length;return}
  if(c==='-'||/[0-9]/.test(c??'')){number();return}
  fail()
 }
 value(0);space();if(at!==text.length)fail()
 return JSON.parse(text)
}
