/**
 * @file Schema and indexes for user job alert subscriptions.
 * @module models/Subscription
 */

import { Schema, model } from "mongoose";
import { ALERT_FREQUENCIES, ALERT_WEEKDAYS, ALERT_TIME_PATTERN, DEFAULT_ALERT_TIME, DEFAULT_ALERT_DAY } from "../constants/alertSchedule.js";

const TelegramScheduleSchema = new Schema({
  frequency: { type: String, enum: ALERT_FREQUENCIES, default: "daily" },
  isActive: { type: Boolean, default: true },
  deliveryTime: { type: String, match: ALERT_TIME_PATTERN, default: DEFAULT_ALERT_TIME },
  weeklyDay: { type: String, enum: ALERT_WEEKDAYS, default: DEFAULT_ALERT_DAY },
  scheduleVersion: { type: Number, default: 0 },
}, { _id: false });

const FiltersSchema = new Schema(
  {
    batches: { type: [Number], default: [] },
    branches: { type: [String], default: [] },
    locations: { type: [String], default: [] },
    jobTypes: { type: [String], default: [] },
    skills: { type: [String], default: [] },
  },
  { _id: false }
);

const SubscriptionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    filters: {
      type: FiltersSchema,
      default: () => ({}),
    },
    dispatchRevision: { type: Number, default: 0 },
    telegramSchedule: { type: TelegramScheduleSchema, default: () => ({}) },
    telegramLastSentAt: { type: Date },
  },
  {
    timestamps: true,
    strict: true,
  }
);

SubscriptionSchema.set("toJSON", {
  // Transforms database document representation for API JSON responses.
  transform: (doc, ret) => {
    delete ret.__v;
    if (ret._id) ret.id = ret._id;
    return ret;
  },
});

const Subscription = model("Subscription", SubscriptionSchema);

export default Subscription;
