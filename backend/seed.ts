//import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { connectDB } from './app/lib/db';
import UserType from './app/models/UserType';
import User from './app/models/User';
import AuthCredential from './app/models/AuthCredential';
import Resource from './app/models/Resource';
import * as fs from 'fs';
import { EJSON } from 'bson';
//import * as path from 'path';
//import { DatabaseZap } from 'lucide-react';

dotenv.config({ path: '../.env' });

async function seed() {
  try {
    await connectDB();
    console.log('Connected to DB for seeding...');

    // 1. User Types
    const types = ['Admin', 'Supplier', 'Owner', 'Therapist', 'Patient'];
    const typeIds: Record<string, any> = {};
    for (const name of types) {
      const type = await UserType.findOneAndUpdate(
        { name },
        { name, permissions: ['default'] },
        { upsert: true, returnDocument: 'after' }
      );
      typeIds[name] = type._id;
    }
    console.log('UserTypes seeded.');

    // 2. Admin User
    const adminEmail = process.env.ADMIN_EMAIL || 'ask2gaurav@gmail.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        user_type_id: typeIds['Admin'],
        first_name: 'Sys',
        last_name: 'Admin',
        email: adminEmail
      });
      
      const password_hash = await bcrypt.hash(process.env.ADMIN_PASS || 'securepassword', 10);
      await AuthCredential.create({
        user_id: admin._id,
        email: adminEmail,
        password_hash
      });
      console.log('Admin user created.');
    } else {
      console.log('Admin user already exists.');
    }

    // 3. Resources
   // 1. Read JSON file
    //const dataPath = path.join(__dirname, 'resources.json');
    let dataPath =  './resources.json';
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = EJSON.parse(rawData);
    


    // 2. Clear existing data (optional)
    await Resource.deleteMany({});
    console.log('Old data cleared');

    // 3. Insert new data
    await Resource.insertMany(data);
    console.log('Database seeded successfully!');

    // for (const res of sampleResources) { 
    //   await Resource.findOneAndUpdate({ slug: res.slug }, res, { upsert: true });
    // }
    console.log('Sample resources seeded.');

    console.log('Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
