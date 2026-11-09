import mongoose from 'mongoose';
const schema=new mongoose.Schema({
  _id:{type:String,required:true}, activeKey:{type:String}, revision:{type:Number,default:0},
  origin:{type:String,enum:['admin','github','scheduler'],required:true},target:{type:String,enum:['github','local'],required:true},
  status:{type:String,default:'running'},repo:String,ref:String,sha:String,requestedBy:String,scheduleSlot:String,
  stages:[mongoose.Schema.Types.Mixed],startedAt:Date,completedAt:Date,error:String,localOwner:String,heartbeatAt:Date,
},{timestamps:true});
schema.index({activeKey:1},{unique:true,sparse:true});
schema.index({scheduleSlot:1},{unique:true,sparse:true});
schema.index({createdAt:-1});
schema.index({'stages.githubRunId':1});
export default mongoose.model('PipelineRun',schema);
