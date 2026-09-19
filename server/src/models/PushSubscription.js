import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  workerName: {
    type: String,
    required: true,
  },
  subscription: {
    endpoint: { type: String, required: true },
    expirationTime: { type: Date, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

pushSubscriptionSchema.index({ 'subscription.endpoint': 1 }, { unique: true });

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
export default PushSubscription;
