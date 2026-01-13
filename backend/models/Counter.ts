import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

/**
 * Get the next sequence number for a counter atomically.
 * This prevents race conditions when generating sequential numbers.
 *
 * @param counterId - The counter identifier (e.g., 'txn-20260104')
 * @returns The next sequence number
 */
export async function getNextSequence(counterId: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
}

export const Counter = mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);
