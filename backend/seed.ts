import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { connectDB } from './app/lib/db';
import UserType from './app/models/UserType';
import User from './app/models/User';
import AuthCredential from './app/models/AuthCredential';
import Resource from './app/models/Resource';

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
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        user_type_id: typeIds['Admin'],
        first_name: 'Sys',
        last_name: 'Admin',
        email: adminEmail
      });
      
      const password_hash = await bcrypt.hash(process.env.MONGO_PASS || 'securepassword', 10);
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
    const sampleResources = [
      {
        title: 'How do I start a new Therapy Session?',
        slug: 'start-therapy-session',
        content: '<p>Go to the Therapy screen, select a therapist and patient, then click Start.</p>',
        category: 'FAQ',
        updated_by: admin._id
      },
      {
        title: 'What is the recommended temperature range?',
        slug: 'recommended-temp-range',
        content: '<p>The recommended water temperature is between 35&deg;C and 38&deg;C.</p>',
        category: 'FAQ',
        updated_by: admin._id
      }
    ];

    for (const res of sampleResources) {
      await Resource.findOneAndUpdate({ slug: res.slug }, res, { upsert: true });
    }
    console.log('Sample resources seeded.');

    console.log('Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
