/**
 * Seed sample drugs for the vet clinic formulary.
 * Run: npx tsx prisma/seed-drugs.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const drugs = [
  {
    name: "Amoxicillin",
    genericName: "Amoxicillin Trihydrate",
    unit: "เม็ด",
    stockQty: 500,
    minStock: 50,
    pricePerUnit: 5.00,
  },
  {
    name: "Prednisolone 5 mg",
    genericName: "Prednisolone",
    unit: "เม็ด",
    stockQty: 300,
    minStock: 30,
    pricePerUnit: 3.50,
  },
  {
    name: "Metronidazole 200 mg",
    genericName: "Metronidazole",
    unit: "เม็ด",
    stockQty: 400,
    minStock: 40,
    pricePerUnit: 4.00,
  },
  {
    name: "Enrofloxacin 50 mg",
    genericName: "Enrofloxacin",
    unit: "เม็ด",
    stockQty: 200,
    minStock: 20,
    pricePerUnit: 12.00,
  },
  {
    name: "Meloxicam Oral Solution",
    genericName: "Meloxicam",
    unit: "ml",
    stockQty: 1000,
    minStock: 100,
    pricePerUnit: 2.50,
  },
  {
    name: "Ringer's Lactate Solution",
    genericName: "Lactated Ringer's Solution",
    unit: "ml",
    stockQty: 5000,
    minStock: 500,
    pricePerUnit: 0.20,
  },
  {
    name: "Ivermectin 1%",
    genericName: "Ivermectin",
    unit: "ml",
    stockQty: 50,
    minStock: 5,
    pricePerUnit: 18.00,
  },
  {
    name: "Famotidine 10 mg",
    genericName: "Famotidine",
    unit: "เม็ด",
    stockQty: 250,
    minStock: 25,
    pricePerUnit: 6.00,
  },
  {
    name: "Lactulose Solution",
    genericName: "Lactulose",
    unit: "ml",
    stockQty: 800,
    minStock: 80,
    pricePerUnit: 1.80,
  },
  {
    name: "Vitamin B Complex",
    genericName: "Thiamine / Riboflavin / Niacin",
    unit: "เม็ด",
    stockQty: 600,
    minStock: 60,
    pricePerUnit: 2.00,
  },
];

async function main() {
  console.log("Seeding drugs...");
  let created = 0;
  let skipped = 0;

  for (const drug of drugs) {
    const exists = await prisma.drug.findFirst({ where: { name: drug.name } });
    if (exists) {
      console.log(`  skip  ${drug.name}`);
      skipped++;
    } else {
      await prisma.drug.create({ data: drug });
      console.log(`  added ${drug.name}`);
      created++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
