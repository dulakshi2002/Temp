// api/utils/seed_concepts.js (ESM)
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// FIXED: correct relative import
import Concept from "../models/concept.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Mongo connected");

  const seeds = [
    { code: "EAD.Microservices.MonolithVsMicroservices", title: "Monolith vs Microservices" },
    { code: "EAD.DevOps.Lifecycle", title: "DevOps Lifecycle" },
    { code: "EAD.DevOps.CI", title: "Continuous Integration" },
    { code: "EAD.DevOps.CD", title: "Continuous Delivery" },
  ];

  for (const s of seeds) {
    const exists = await Concept.findOne({ code: s.code });
    if (exists) {
      console.log(`✔ exists: ${s.code}`);
    } else {
      await Concept.create(s);
      console.log(`➕ added: ${s.code}`);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
