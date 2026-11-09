/** Records changes to a user's premium access that are not payments. */
import { Schema, model } from "mongoose";
import { PLAN_IDS } from "../constants/accessPlans.js";

const AccessEventSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["cancelled"], required: true },
  planId: { type: String, enum: Object.values(PLAN_IDS), required: true },
  occurredAt: { type: Date, default: Date.now, required: true },
});

AccessEventSchema.index({ user: 1, occurredAt: -1 });

export default model("AccessEvent", AccessEventSchema);
