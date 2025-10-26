// backend/db.js
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config(); // to use .env file

// Use environment variable for security
const uri = process.env.MONGODB_URI;

// Create a MongoClient with Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB Connected Successfully!");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error);
  }
}

module.exports = connectDB;
