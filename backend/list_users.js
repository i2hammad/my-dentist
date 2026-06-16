const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const users = await User.find({}).select('email role createdAt');
    console.log('=== All Users in Database ===');
    users.forEach(u => console.log(`  ${u.email} | role: ${u.role} | created: ${u.createdAt}`));
    console.log(`\nTotal: ${users.length} users`);
    process.exit(0);
  })
  .catch(err => { console.error(err); process.exit(1); });
