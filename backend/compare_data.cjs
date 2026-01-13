const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority&appName=Leaftolife';

// CSV file paths
const CSV_USERS_PATH = 'G:\\sql_to_csv_extraction\\base_user.csv';
const CSV_TRANSACTIONS_PATH = 'G:\\sql_to_csv_extraction\\base_salestransaction.csv';

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && (i === 0 || line[i-1] === ',')) {
                inQuotes = true;
            } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
                inQuotes = false;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        return obj;
    });
}

async function connectToMongoDB() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    return client.db('l2l');
}

async function compareData() {
    try {
        console.log('🔍 Starting data comparison...\n');
        
        // Parse CSV files
        console.log('📄 Reading CSV files...');
        const csvUsers = parseCSV(CSV_USERS_PATH);
        const csvTransactions = parseCSV(CSV_TRANSACTIONS_PATH);
        console.log(`   - CSV Users: ${csvUsers.length} records`);
        console.log(`   - CSV Transactions: ${csvTransactions.length} records\n`);
        
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB Atlas...');
        const db = await connectToMongoDB();
        
        // Get MongoDB data
        console.log('📊 Fetching MongoDB data...');
        const mongoUsers = await db.collection('users').find({}).toArray();
        const mongoTransactions = await db.collection('transactions').find({}).toArray();
        console.log(`   - MongoDB Users: ${mongoUsers.length} records`);
        console.log(`   - MongoDB Transactions: ${mongoTransactions.length} records\n`);
        
        // Compare Users/Patients
        console.log('👥 Comparing Users/Patients...');
        const csvUserEmails = new Set(csvUsers.map(u => u.email?.toLowerCase().trim()).filter(e => e));
        const mongoUserEmails = new Set(mongoUsers.map(u => u.email?.toLowerCase().trim()).filter(e => e));
        
        const missingUsers = csvUsers.filter(csvUser => {
            const email = csvUser.email?.toLowerCase().trim();
            return email && !mongoUserEmails.has(email);
        });
        
        console.log(`   - Missing users in MongoDB: ${missingUsers.length}`);
        if (missingUsers.length > 0) {
            console.log('   Missing user emails:');
            missingUsers.slice(0, 10).forEach(user => {
                console.log(`     • ${user.email} (${user.first_name} ${user.last_name})`);
            });
            if (missingUsers.length > 10) {
                console.log(`     ... and ${missingUsers.length - 10} more`);
            }
        }
        console.log('');
        
        // Compare Transactions
        console.log('💰 Comparing Transactions...');
        const csvTransactionNos = new Set(csvTransactions.map(t => t.transactionNo?.trim()).filter(t => t));
        const mongoTransactionNos = new Set(mongoTransactions.map(t => t.transactionNumber || t.transactionNo || t.id).filter(t => t));
        
        const missingTransactions = csvTransactions.filter(csvTxn => {
            const txnNo = csvTxn.transactionNo?.trim();
            return txnNo && !mongoTransactionNos.has(txnNo);
        });
        
        console.log(`   - Missing transactions in MongoDB: ${missingTransactions.length}`);
        if (missingTransactions.length > 0) {
            console.log('   Missing transaction numbers:');
            missingTransactions.slice(0, 10).forEach(txn => {
                console.log(`     • ${txn.transactionNo} (${txn.customer_id}, ${txn.date})`);
            });
            if (missingTransactions.length > 10) {
                console.log(`     ... and ${missingTransactions.length - 10} more`);
            }
        }
        console.log('');
        
        // Generate detailed report
        const report = {
            summary: {
                csv: {
                    users: csvUsers.length,
                    transactions: csvTransactions.length
                },
                mongodb: {
                    users: mongoUsers.length,
                    transactions: mongoTransactions.length
                },
                missing: {
                    users: missingUsers.length,
                    transactions: missingTransactions.length
                }
            },
            missingUsers: missingUsers,
            missingTransactions: missingTransactions
        };
        
        // Save report
        const reportPath = './data_comparison_report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📋 Detailed report saved to: ${path.resolve(reportPath)}`);
        
        // Summary
        console.log('\n📈 SUMMARY:');
        console.log(`   CSV → MongoDB Users: ${csvUsers.length} → ${mongoUsers.length} (${missingUsers.length} missing)`);
        console.log(`   CSV → MongoDB Transactions: ${csvTransactions.length} → ${mongoTransactions.length} (${missingTransactions.length} missing)`);
        
        if (missingUsers.length > 0 || missingTransactions.length > 0) {
            console.log('\n⚠️  Data migration incomplete - some records are missing in MongoDB Atlas');
        } else {
            console.log('\n✅ All CSV records found in MongoDB Atlas');
        }
        
    } catch (error) {
        console.error('❌ Error during comparison:', error);
    }
}

// Run the comparison
compareData().then(() => {
    console.log('\n🏁 Comparison complete!');
    process.exit(0);
}).catch(console.error);