const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const email = 'bem@gyocc.org';
const newPassword = 'Digitalmi$$ion2126!';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const User = mongoose.connection.collection('users');
  const result = await User.updateOne(
    { email: email },
    { $set: { password: hashedPassword, status: 'active' } }
  );
  console.log(`Password updated for ${email}`);
  console.log('Modified count:', result.modifiedCount);
  mongoose.disconnect();
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
