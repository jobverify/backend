import mongoose from 'mongoose';
export default mongoose.model('PipelineConfiguration',new mongoose.Schema({
  _id:{type:String,default:'global'},stages:[{_id:false,key:String,enabled:Boolean,runForAllExistingJobs:Boolean,
    jobScope:{type:String,enum:['all','pending_and_new','new']}}],updatedBy:String,
  scraperConcurrency:{type:Number,min:1,validate:Number.isSafeInteger},
},{timestamps:true}));
