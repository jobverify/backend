/**
 * @file Schema for paid premium plan purchases.
 * @module models/PlanPurchase
 */

import { Schema, model } from "mongoose";
import { ACCESS_ROLES, PLAN_IDS } from "../constants/accessPlans.js";

const RefundSchema = new Schema({
  providerRefundId: { type: String, required: true },
  amountMinor: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  status: { type: String, enum: ["pending", "failed", "processed"], required: true },
  receivedAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  processedAt: { type: Date, default: null },
}, { _id: false });

const PlanPurchaseSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: String,
      enum: [PLAN_IDS.MONTHLY, PLAN_IDS.SEMESTER, PLAN_IDS.YEARLY],
      required: true,
    },
    accessRole: {
      type: String,
      enum: [ACCESS_ROLES.MONTHLY, ACCESS_ROLES.SEMESTER, ACCESS_ROLES.YEARLY],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "paid",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "created",
      index: true,
    },
    provider: {
      type: String,
      enum: ["razorpay", "mock"],
      default: "mock",
    },
    providerOrderId: {
      type: String,
      default: null,
      index: true,
    },
    providerPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    providerSignature: {
      type: String,
      default: null,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    // Same major currency units as amount; provider arithmetic uses integer paise.
    refundedAmount: { type: Number, min: 0, default: 0 },
    refunds: { type: [RefundSchema], default: [] },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

PlanPurchaseSchema.index({ user: 1, createdAt: -1 });
PlanPurchaseSchema.index(
  { provider: 1, providerOrderId: 1 },
  {
    name: "provider_1_providerOrderId_1",
    unique: true,
    partialFilterExpression: { providerOrderId: { $type: "string" } },
  },
);
PlanPurchaseSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    name: "provider_1_providerPaymentId_1",
    unique: true,
    partialFilterExpression: { providerPaymentId: { $type: "string" } },
  },
);

const hideInternalPurchaseFields = (_doc, ret) => {
  delete ret.providerSignature;
  delete ret.metadata;
  delete ret.__v;
  ret.refunds = (ret.refunds || []).map((refund) => ({
    providerRefundId: refund.providerRefundId,
    amount: refund.amountMinor / 100,
    currency: refund.currency,
    status: refund.status,
    receivedAt: refund.receivedAt,
    processedAt: refund.processedAt,
  }));
  if (ret._id) ret.id = ret._id;
  return ret;
};

PlanPurchaseSchema.set("toJSON", {
  transform: hideInternalPurchaseFields,
});

PlanPurchaseSchema.set("toObject", {
  transform: hideInternalPurchaseFields,
});

const PlanPurchase = model("PlanPurchase", PlanPurchaseSchema);

export default PlanPurchase;
