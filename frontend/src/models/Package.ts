import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  DELIVERY_MODES,
  PACKAGE_CATEGORIES,
  type DeliveryMode,
  type PackageCategory,
} from './types';

// package_features and pricing from the spec are embedded here. Both are read
// only ever with their package, and pricing is versioned by keeping history.
export interface IPackage {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  mode: DeliveryMode;
  category: PackageCategory;
  /** Only set where the offer states a session count. */
  sessionsIncluded?: number;
  sessionDurationMinutes: number;
  validityDays: number;
  features: { label: string; included: boolean }[];
  price: { amount: number; currency: string; effectiveFrom: Date }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const packageSchema = new Schema<IPackage>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    mode: { type: String, enum: DELIVERY_MODES, default: 'online' },
    category: { type: String, enum: PACKAGE_CATEGORIES, required: true, index: true },
    sessionsIncluded: { type: Number, min: 1 },
    sessionDurationMinutes: { type: Number, default: 60, min: 1 },
    validityDays: { type: Number, default: 30, min: 1 },
    features: [
      { label: { type: String, required: true }, included: { type: Boolean, default: true } },
    ],
    // Never hard-code prices in code, per spec section 27.
    price: [
      {
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'NGN' },
        effectiveFrom: { type: Date, default: Date.now },
      },
    ],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Package: Model<IPackage> =
  models.Package || model<IPackage>('Package', packageSchema);
export default Package;
