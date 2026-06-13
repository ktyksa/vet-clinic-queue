import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 30;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 1) {
    return NextResponse.json({ pets: [] });
  }

  const pets = await prisma.pet.findMany({
    where: {
      deletedAt: null,
      status: { not: "DECEASED" },
      OR: [
        { petName: { contains: q, mode: "insensitive" } },
        { microchipNo: { contains: q, mode: "insensitive" } },
        { owner: { fullName: { contains: q, mode: "insensitive" } } },
        { owner: { phoneNo: { contains: q } } },
        { owner: { email: { contains: q, mode: "insensitive" } } },
        { owner: { lineId: { contains: q, mode: "insensitive" } } },
        { species: { speciesName: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      petId: true,
      ownerId: true,
      petName: true,
      microchipNo: true,
      gender: true,
      owner: {
        select: {
          ownerId: true,
          fullName: true,
          phoneNo: true,
          lineId: true,
          email: true,
        },
      },
      species: { select: { speciesName: true } },
      breed: { select: { breedName: true } },
    },
    orderBy: [{ petName: "asc" }],
    take: MAX_RESULTS,
  });

  return NextResponse.json({ pets });
}
