import {boundedDeclaredPublicRead} from './boundedDeclaredPublicRead.js'

// Keep this historical contract strictly GET, even if an injected caller
// supplies a request descriptor. Source-declared queries use the read primitive.
export const boundedDeclaredPublicGet=(url,options)=>boundedDeclaredPublicRead(url,{...options,request:{method:'GET'}})
