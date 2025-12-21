// api/config.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGO;

    console.log(">>> MONGO_URI from .env =", mongoUri);   // <-- add this

    if (!mongoUri) {
      console.error("❌ MongoDB connection string is not defined");
      process.exit(1);
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};
