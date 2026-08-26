import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IInvoice {
  _id: Types.ObjectId;
  invoiceNumber: string;
  student: Types.ObjectId;
  billedTo: Types.ObjectId;
  payment?: Types.ObjectId;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  issuedAt: Date;
  dueAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    billedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    items: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    issuedAt: { type: Date, default: Date.now },
    dueAt: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

export const Invoice: Model<IInvoice> =
  models.Invoice || model<IInvoice>('Invoice', invoiceSchema);
export default Invoice;
