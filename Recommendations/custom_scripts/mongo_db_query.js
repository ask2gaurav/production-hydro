import { MongoClient } from 'mongodb';
//import 'dotenv/config';

// 1. Get the connection URL from environment variables
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('Error: MONGODB_URI is not defined in the .env file');
    process.exit(1);
}

// 2. Initialize the MongoClient
const client = new MongoClient(uri);

async function run() {
    try {
        // 3. Connect to the MongoDB cluster
        await client.connect();
        console.log('Successfully connected to MongoDB.');

        // 4. Access the database and collection
        // Note: If the DB name is in the URI string, you can leave client.db() empty
        const database = client.db();
        const collection = database.collection('SupplierResources');

        // 5. Execute a sample query (Find one document)
        const query = {
            slug: {
                $in: ["what-is-a-backup-and-why-should-i-make-one", "how-do-i-create-a-backup-manually","what-is-the-difference-between-export-to-excel-and-export-backup","how-do-i-restore-a-backup-on-this-tablet-or-a-new-one","how-do-i-see-or-delete-backups-already-saved-on-this-tablet","what-is-auto-backup-and-should-i-turn-it-on","how-many-backups-does-the-app-keep","what-is-the-backup-folder-and-why-do-i-need-to-set-it","where-do-my-backups-actually-get-saved","what-should-i-do-if-i-see-an-error-message-or-something-doesnt-seem-to-work"] }
        };
        const result = await collection.findOne(query);

        console.log('Query Result:', result);

    } catch (error) {
        console.error('Database operation failed:', error);
    } finally {
        // 6. Ensure the client closes when finished or on error
        await client.close();
        console.log('Connection closed.');
    }
}

run().catch(console.dir);
