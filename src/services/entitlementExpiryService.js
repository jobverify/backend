import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { ACCESS_ROLES, PLAN_IDS, PREMIUM_ACCESS_ROLES, PREMIUM_PLAN_IDS } from '../constants/accessPlans.js';

export const expiredEntitlementFilter = (now = new Date()) => ({
  'premium.expiresAt': { $type: 'date', $lte: now },
  $or: [ { accessRole: { $in: PREMIUM_ACCESS_ROLES } }, { 'premium.planId': { $in: PREMIUM_PLAN_IDS } } ],
});

export const expireEntitlement = async (userId, now = new Date()) => User.db.transaction(async session => {
  // Test the current entitlement inside the write, never the hydrated snapshot
  // that a request or sweep may have read before a payment committed.
  const expired = await User.findOneAndUpdate({ _id: userId, ...expiredEntitlementFilter(now) }, {
    $set: { accessRole: ACCESS_ROLES.FREE, 'premium.planId': PLAN_IDS.FREE,
      'premium.status': 'expired', 'premium.telegramAlertsEnabled': false },
  }, { session, new: true, runValidators: true }).select('_id').lean();
  if (!expired) return false;
  // Delivery eligibility is derived from User. Preserve the member's schedule
  // preferences and fence any delivery/schedule transaction already in flight.
  await Subscription.updateOne({ user: expired._id }, { $inc: { dispatchRevision: 1 } }, { session, timestamps: false });
  return true;
});
