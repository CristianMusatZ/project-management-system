import mongoose from 'mongoose';

export async function connectMongo(): Promise<void> {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://pms_mongo:pms_mongo_2024@localhost:27017/pms_projects?authSource=admin';

    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}
