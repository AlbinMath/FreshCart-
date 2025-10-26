import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Test MongoDB connection
async function testConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected Successfully');
    
    // Test creating a simple document
    const testSchema = new mongoose.Schema({ name: String, test: Boolean });
    const TestModel = mongoose.model('Test', testSchema);
    
    const testDoc = new TestModel({ name: 'Connection Test', test: true });
    await testDoc.save();
    console.log('✅ Document saved successfully');
    
    // Clean up
    await TestModel.deleteOne({ name: 'Connection Test' });
    console.log('✅ Test document cleaned up');
    
    await mongoose.disconnect();
    console.log('✅ MongoDB Disconnected');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConnection();


