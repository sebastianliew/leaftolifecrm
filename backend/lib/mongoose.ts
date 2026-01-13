/**
 * MongoDB Connection Utility
 *
 * This file re-exports from mongodb.ts for backward compatibility.
 * The primary connection is managed in server.ts.
 *
 * @deprecated Import from './mongodb' instead
 */

import connectDB from './mongodb.js';

export default connectDB;
export { connectDB }; 