import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";

export default async function SetupVaccinesPage() {
  await requirePermission("user", "manage");

  const dog = await prisma.species.findUnique({
    where: { speciesCode: "DOG" },
  });

  const cat = await prisma.species.findUnique({
    where: { speciesCode: "CAT" },
  });

  if (!dog || !cat) {
    return (
      <AppShell>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-red-600">
          Species not found
          </h1>
          <p>Please run /setup/species first.</p>
        </div>
      </AppShell>
    );
  }

  const vaccines = [];

  vaccines.push(
    await prisma.vaccine.upsert({
      where: {
        vaccineCode_speciesId: {
          vaccineCode: "DHPPIL",
          speciesId: dog.speciesId,
        },
      },
      update: {},
      create: {
        vaccineCode: "DHPPIL",
        vaccineName: "DHPPi-L",
        speciesId: dog.speciesId,
        defaultIntervalDays: 21,
        validMonths: null,
        dosage: "1 dose",
        price: 450,
      },
    })
  );

  vaccines.push(
    await prisma.vaccine.upsert({
      where: {
        vaccineCode_speciesId: {
          vaccineCode: "RABIES",
          speciesId: dog.speciesId,
        },
      },
      update: {},
      create: {
        vaccineCode: "RABIES",
        vaccineName: "Rabies Vaccine",
        speciesId: dog.speciesId,
        defaultIntervalDays: null,
        validMonths: 12,
        dosage: "1 dose",
        price: 350,
      },
    })
  );

  vaccines.push(
    await prisma.vaccine.upsert({
      where: {
        vaccineCode_speciesId: {
          vaccineCode: "FVRCP",
          speciesId: cat.speciesId,
        },
      },
      update: {},
      create: {
        vaccineCode: "FVRCP",
        vaccineName: "FVRCP",
        speciesId: cat.speciesId,
        defaultIntervalDays: 21,
        validMonths: null,
        dosage: "1 dose",
        price: 450,
      },
    })
  );

  vaccines.push(
    await prisma.vaccine.upsert({
      where: {
        vaccineCode_speciesId: {
          vaccineCode: "FELV",
          speciesId: cat.speciesId,
        },
      },
      update: {},
      create: {
        vaccineCode: "FELV",
        vaccineName: "FeLV",
        speciesId: cat.speciesId,
        defaultIntervalDays: 21,
        validMonths: null,
        dosage: "1 dose",
        price: 500,
      },
    })
  );

  vaccines.push(
    await prisma.vaccine.upsert({
      where: {
        vaccineCode_speciesId: {
          vaccineCode: "RABIES",
          speciesId: cat.speciesId,
        },
      },
      update: {},
      create: {
        vaccineCode: "RABIES",
        vaccineName: "Rabies Vaccine",
        speciesId: cat.speciesId,
        defaultIntervalDays: null,
        validMonths: 12,
        dosage: "1 dose",
        price: 350,
      },
    })
  );

  return (
    <AppShell>
      <div className="p-6">
      <h1 className="text-2xl font-bold">
        Setup Vaccines Completed
      </h1>

      <pre className="mt-4 rounded border bg-gray-50 p-4">
        {JSON.stringify(vaccines, null, 2)}
      </pre>
      </div>
    </AppShell>
  );
}