require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Define schema matching the patients collection
const PatientSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  discountRate: { type: Number, default: 0, min: 0, max: 100 },
  status: String,
  internalNotes: String,
  legacyCustomerNo: String
}, { timestamps: true, strict: false });

const Patient = mongoose.models.Patient || mongoose.model('Patient', PatientSchema, 'patients');

// Member discount data from old system
const memberDiscounts = [
  // 100% discount (Staff)
  { email: 'sliew@leaftolife.com.sg', firstName: 'sebastian', lastName: 'liew', discount: 100, note: 'Staff - Retired' },
  { email: 'weekuang75@hotmail.com', firstName: 'ann wee', lastName: 'kuang', discount: 100, note: 'Staff' },
  
  // 40% discount
  { email: 'patrick@mindease.sg', firstName: 'Patrick', lastName: 'Ho', discount: 40 },
  { email: 'Wondrouslightmarket@gmail.com', firstName: 'Miao', lastName: 'Chan', discount: 40 },
  { email: 'helloohholiday@gmail.com', firstName: 'Oh', lastName: 'Holiday Corp', discount: 40 },
  { email: 'tansufei888@gmail.com', firstName: 'Erika Sophia', lastName: 'Tan', discount: 40 },
  
  // 20% discount  
  { email: 'ann.sf@hotmail.com', firstName: 'Ann', lastName: 'Kui Tee', discount: 20 },
  { email: 'bruno.pilgrim@gmail.com', firstName: 'Bruno', lastName: 'St Girons', discount: 20 },
  { email: 'johntangfs@gmail.com', firstName: 'John', lastName: 'Tang Fu Sheng', discount: 20 },
  { email: 'siewcin_ang89+2@hotmail.com', firstName: 'Ang', lastName: 'Yong Hock', discount: 20 },
  
  // 10% discount (standard members)
  { email: 'laychoopm@gmail.com', firstName: 'lai', lastName: 'choo peng', discount: 10 },
  { email: 'lim_peksan@yahoo.com', firstName: 'lim', lastName: 'pek san', discount: 10 },
  { email: 'Carolinefoopuiling@gmail.com', firstName: 'FOO', lastName: 'PUI LING CAROLINE', discount: 10 },
  { email: 'tansusan7028@gmail.com', firstName: 'Susan', lastName: 'Tan', discount: 10 },
  { email: 'changjunxi@gmail.com', firstName: 'Chang', lastName: 'Junxi', discount: 10 },
  { email: 'tanyennee1980@gmail.com', firstName: 'Irene', lastName: 'Tan Yen Nee', discount: 10 },
  { email: 'irenetany@gmail.com', firstName: 'Irene', lastName: 'Tan Yen Nee', discount: 10 },
  { email: 'wendytan88@gmail.com', firstName: 'Wendy', lastName: 'Tan', discount: 10 },
  { email: 'ashokleecj@gmail.com', firstName: 'Lee', lastName: 'Chong Jin', discount: 10 },
  { email: 'kpohleng@hotmail.com', firstName: 'POH', lastName: 'LENG KHIM', discount: 10 },
  { email: 'mabelbenjamin2003@gmail.com', firstName: 'Mabel', lastName: 'Benjamin', discount: 10 },
  { email: 'linliyan@gmail.com', firstName: 'Lin', lastName: 'Liyan', discount: 10 },
  { email: '8dmiracleoils@gmail.com', firstName: 'Susan', lastName: 'Low', discount: 10 },
  { email: 'tereseloo@gmail.com', firstName: 'terese', lastName: 'loo', discount: 10 },
  { email: 'theblessingroom@gmail.com', firstName: 'Julie', lastName: 'Seah', discount: 10 },
  { email: 'seet.peikay@gmail.com', firstName: 'Seet', lastName: 'Pei Kay', discount: 10 },
  { email: 'ongkimhai@gmail.com', firstName: 'Ong', lastName: 'Kim Hai', discount: 10 },
  { email: 'saleenjohn@hotmail.com', firstName: 'Saleen', lastName: 'John', discount: 10 },
  { email: 'lee_sai_hoon@yahoo.com', firstName: 'Lee', lastName: 'Sai Hoon', discount: 10 },
  { email: 'naomiangel25@gmail.com', firstName: 'Naomi', lastName: 'Beh', discount: 10 },
  { email: 'alston1905@yahoo.com', firstName: 'Alston', lastName: 'Liew', discount: 10 },
  { email: 'myholystic@gmail.com', firstName: 'Melissa', lastName: 'Yeo', discount: 10 },
  { email: 'jiahui0928@gmail.com', firstName: 'Jia', lastName: 'Hui', discount: 10 },
  { email: 'joanahjohansen@gmail.com', firstName: 'Joanah', lastName: 'Johansen', discount: 10 },
  { email: 'chenli_69@hotmail.com', firstName: 'Li', lastName: 'Chen', discount: 10 },
  { email: 'dor23othea@gmail.com', firstName: 'Koh Hwee', lastName: 'Leng', discount: 10 },
  { email: 'ongweili3@gmail.com', firstName: 'Ong', lastName: 'Wei Li', discount: 10 },
  { email: 'kwongyen@yahoo.com', firstName: 'Kwong', lastName: 'Yen', discount: 10 },
  { email: 'mariolimsw@gmail.com', firstName: 'Mario', lastName: 'Lim', discount: 10 },
  { email: 'nattanialim@gmail.com', firstName: 'Lim', lastName: 'Kim Leng', discount: 10 },
  { email: 'chwlspa@gmail.com', firstName: 'Chwl', lastName: 'Spa', discount: 10 },
  { email: 'marcusgohzixiang@gmail.com', firstName: 'Goh', lastName: 'Zi Xiang', discount: 10 },
  { email: 'zann.ng@gmail.com', firstName: 'Zann', lastName: 'Ng', discount: 10 },
  { email: 'juliecwy@hotmail.com', firstName: 'Julie', lastName: 'Chua', discount: 10 },
  { email: 'kzhengg@gmail.com', firstName: 'Karen', lastName: 'Goh', discount: 10 },
  { email: 'sharonlsm.ong@gmail.com', firstName: 'Sharon', lastName: 'Ong Li Shan', discount: 10 },
  { email: 'pamelathampl@gmail.com', firstName: 'Pamela', lastName: 'Tham', discount: 10 },
  { email: 'hengsiangtan@gmail.com', firstName: 'Tan', lastName: 'Heng Siang', discount: 10 }
];

// Load full list if available
const fs = require('fs');
const path = require('path');
try {
  const fullList = JSON.parse(fs.readFileSync(path.join(__dirname, 'customer_discounts.json'), 'utf8'));
  if (fullList.length > memberDiscounts.length) {
    memberDiscounts.length = 0;
    memberDiscounts.push(...fullList);
  }
} catch {
  // Use partial list if full list not available
}

async function run() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('💱 Patient Discount Migration');
    console.log('============================\n');
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Statistics
    let matchedByEmail = 0;
    let matchedByName = 0;
    let notFound = [];
    let alreadyHasDiscount = 0;
    let updated = 0;

    console.log(`📋 Processing ${memberDiscounts.length} members with discounts...\n`);

    // Process each member
    for (const member of memberDiscounts) {
      let patient = null;
      let matchType = '';

      // Try to find by email first (case-insensitive)
      if (member.email) {
        patient = await Patient.findOne({ 
          email: { $regex: new RegExp(`^${member.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        if (patient) {
          matchType = 'email';
          matchedByEmail++;
        }
      }

      // If not found by email, try by name patterns
      if (!patient) {
        // Handle cases where name might be combined or in different format
        const searchPatterns = [
          // Try exact match
          { firstName: new RegExp(`^${member.firstName}$`, 'i'), lastName: new RegExp(`^${member.lastName}$`, 'i') },
          // Try with names swapped
          { firstName: new RegExp(`^${member.lastName}$`, 'i'), lastName: new RegExp(`^${member.firstName}$`, 'i') },
          // Try combined in firstName
          { firstName: new RegExp(`${member.lastName}.*${member.firstName}|${member.firstName}.*${member.lastName}`, 'i') },
          // Try partial matches
          { firstName: new RegExp(member.firstName, 'i') },
          { firstName: new RegExp(member.lastName, 'i') }
        ];

        for (const pattern of searchPatterns) {
          patient = await Patient.findOne(pattern);
          if (patient) {
            matchType = 'name';
            matchedByName++;
            break;
          }
        }
      }

      // Update if found
      if (patient) {
        if (patient.discountRate && patient.discountRate > 0) {
          console.log(`⚠️  ${member.email} already has ${patient.discountRate}% discount (new: ${member.discount}%)`);
          alreadyHasDiscount++;
        } else {
          // Update the discount rate
          patient.discountRate = member.discount;
          
          // Add note if provided
          if (member.note) {
            patient.internalNotes = patient.internalNotes 
              ? `${patient.internalNotes}\n${member.note}` 
              : member.note;
          }

          await patient.save();
          updated++;
          console.log(`✅ Updated ${patient.firstName} ${patient.lastName} (${matchType}): ${member.discount}% discount`);
        }
      } else {
        notFound.push(member);
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`Total members to process: ${memberDiscounts.length}`);
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`📧 Matched by email: ${matchedByEmail}`);
    console.log(`👤 Matched by name: ${matchedByName}`);
    console.log(`⚠️  Already had discount: ${alreadyHasDiscount}`);
    console.log(`❌ Not found: ${notFound.length}`);

    if (notFound.length > 0 && notFound.length <= 20) {
      console.log('\n❌ Members not found in MongoDB:');
      notFound.forEach(m => {
        console.log(`   ${m.email} - ${m.firstName} ${m.lastName} (${m.discount}%)`);
      });
    } else if (notFound.length > 20) {
      console.log(`\n❌ ${notFound.length} members not found (too many to list)`);
      // Save to file
      fs.writeFileSync('members-not-found.json', JSON.stringify(notFound, null, 2));
      console.log('   See members-not-found.json for full list');
    }

    // Verify discount distribution
    const discountStats = await Patient.aggregate([
      { $match: { discountRate: { $gt: 0 } } },
      { $group: { _id: '$discountRate', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📈 Current Discount Distribution in MongoDB:');
    discountStats.forEach(stat => {
      console.log(`   ${stat._id}% discount: ${stat.count} patients`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n✅ Disconnected from MongoDB');
    }
  }
}

// Run the migration
run();