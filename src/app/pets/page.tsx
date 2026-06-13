import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { PetPhotoPreview } from "@/components/pets/PetPhotoPreview";

type Props = {
  searchParams?: Promise<{
    q?: string;
    petName?: string;
    ownerName?: string;
    phoneNo?: string;
    houseNo?: string;
    villageName?: string;
    postalCode?: string;
    subDistrict?: string;
    district?: string;
    province?: string;
    speciesId?: string;
    breedId?: string;
    gender?: string;
    status?: string;
    microchipNo?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    order?: string;
  }>;
};

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const sortOptions = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "createdAt", label: "Created Date" },
  { value: "petName", label: "Pet Name" },
  { value: "ownerName", label: "Owner Name" },
  { value: "species", label: "Species" },
  { value: "breed", label: "Breed" },
  { value: "status", label: "Status" },
];

const petStatuses = ["ACTIVE", "INACTIVE", "LOST", "DECEASED", "ADOPTED"];
const genders = ["MALE", "FEMALE", "UNKNOWN"];

export default async function PetsPage({ searchParams }: Props) {
  await requirePermission("pet", "view");

  const params = await searchParams;

  const q = String(params?.q || "").trim();
  const petName = String(params?.petName || "").trim();
  const ownerName = String(params?.ownerName || "").trim();
  const phoneNo = String(params?.phoneNo || "").trim();
  const houseNo = String(params?.houseNo || "").trim();
  const villageName = String(params?.villageName || "").trim();
  const postalCode = String(params?.postalCode || "").trim();
  const subDistrict = String(params?.subDistrict || "").trim();
  const district = String(params?.district || "").trim();
  const province = String(params?.province || "").trim();
  const speciesId = String(params?.speciesId || "").trim();
  const breedId = String(params?.breedId || "").trim();
  const gender = String(params?.gender || "").trim();
  const status = String(params?.status || "").trim();
  const microchipNo = String(params?.microchipNo || "").trim();

  const page = Math.max(Number(params?.page || 1), 1);

  const pageSizeValue = Number(params?.pageSize || DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeValue)
    ? pageSizeValue
    : DEFAULT_PAGE_SIZE;

  const sort = [
    "updatedAt",
    "createdAt",
    "petName",
    "ownerName",
    "species",
    "breed",
    "status",
  ].includes(String(params?.sort || ""))
    ? String(params?.sort)
    : "updatedAt";

  const order = params?.order === "asc" ? "asc" : "desc";

  const advancedFilterOpen = Boolean(
    petName ||
      ownerName ||
      phoneNo ||
      houseNo ||
      villageName ||
      postalCode ||
      subDistrict ||
      district ||
      province ||
      speciesId ||
      breedId ||
      gender ||
      status ||
      microchipNo
  );

  const where: Prisma.PetWhereInput = {
    deletedAt: null,

    ...(q
      ? {
          OR: [
            { petName: { contains: q, mode: "insensitive" } },
            { microchipNo: { contains: q, mode: "insensitive" } },
            { pedigreeNo: { contains: q, mode: "insensitive" } },
            { rabiesTagNo: { contains: q, mode: "insensitive" } },
            { insuranceNo: { contains: q, mode: "insensitive" } },

            {
              owner: {
                fullName: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                phoneNo: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                lineId: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                email: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                houseNo: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                buildingName: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                villageName: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                road: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                subDistrict: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                district: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                postalCode: { contains: q, mode: "insensitive" },
              },
            },

            {
              species: {
                speciesName: { contains: q, mode: "insensitive" },
              },
            },
            {
              breed: {
                breedName: { contains: q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),

    ...(petName
      ? {
          petName: {
            contains: petName,
            mode: "insensitive",
          },
        }
      : {}),

    ...(ownerName
      ? {
          owner: {
            fullName: {
              contains: ownerName,
              mode: "insensitive",
            },
          },
        }
      : {}),

    ...(phoneNo
      ? {
          owner: {
            phoneNo: {
              contains: phoneNo,
              mode: "insensitive",
            },
          },
        }
      : {}),

    ...(houseNo
      ? {
          owner: {
            houseNo: {
              contains: houseNo,
              mode: "insensitive",
            },
          },
        }
      : {}),

    ...(villageName
      ? {
          owner: {
            villageName: {
              contains: villageName,
              mode: "insensitive",
            },
          },
        }
      : {}),

    ...(postalCode
      ? {
          owner: {
            postalCode: {
              contains: postalCode,
              mode: "insensitive",
            },
          },
        }
      : {}),

    ...(subDistrict
      ? {
          owner: {
            subDistrict: {
              contains: subDistrict,
              mode: "insensitive",
            },
          },
        }
      : {}),

    ...(district
      ? {
          owner: {
            district: {
              contains: district,
              mode: "insensitive",
            },
          },
        }
      : {}),

    ...(province
      ? {
          owner: {
            province: {
              contains: province,
              mode: "insensitive",
            },
          },
        }
      : {}),

    ...(microchipNo
      ? {
          microchipNo: {
            contains: microchipNo,
            mode: "insensitive",
          },
        }
      : {}),

    ...(speciesId ? { speciesId } : {}),
    ...(breedId ? { breedId } : {}),
    ...(gender ? { gender: gender as Prisma.EnumGenderFilter<"Pet"> } : {}),
    ...(status ? { status: status as Prisma.EnumPetStatusFilter<"Pet"> } : {}),
  };

  const isOwnerNameSort = sort === "ownerName";
  const isSpeciesSort = sort === "species";
  const isBreedSort = sort === "breed";

  const orderBy: Prisma.PetOrderByWithRelationInput =
    sort === "petName"
      ? { petName: order }
      : sort === "status"
        ? { status: order }
        : sort === "createdAt"
          ? { createdAt: order }
          : { updatedAt: order };

  const [totalPets, speciesList, breedList] = await Promise.all([
    prisma.pet.count({
      where,
    }),

    prisma.species.findMany({
      where: {
        activeFlag: true,
      },
      orderBy: {
        speciesName: "asc",
      },
    }),

    prisma.breed.findMany({
      where: {
        activeFlag: true,
      },
      include: {
        species: true,
      },
      orderBy: {
        breedName: "asc",
      },
    }),
  ]);

  const totalPages = Math.max(Math.ceil(totalPets / pageSize), 1);
  const safePage = Math.min(page, totalPages);

  const pets =
    isOwnerNameSort || isSpeciesSort || isBreedSort
      ? (
          await prisma.pet.findMany({
            where,
            include: {
              owner: true,
              species: true,
              breed: true,
            },
          })
        )
          .sort((a, b) => {
            const left =
              sort === "ownerName"
                ? a.owner.fullName
                : sort === "species"
                  ? a.species.speciesName
                  : a.breed?.breedName ?? "";

            const right =
              sort === "ownerName"
                ? b.owner.fullName
                : sort === "species"
                  ? b.species.speciesName
                  : b.breed?.breedName ?? "";

            return order === "asc"
              ? left.localeCompare(right)
              : right.localeCompare(left);
          })
          .slice((safePage - 1) * pageSize, safePage * pageSize)
      : await prisma.pet.findMany({
          where,
          include: {
            owner: true,
            species: true,
            breed: true,
          },
          orderBy,
          skip: (safePage - 1) * pageSize,
          take: pageSize,
        });

  const baseQuery = {
    q,
    petName,
    ownerName,
    phoneNo,
    houseNo,
    villageName,
    postalCode,
    subDistrict,
    district,
    province,
    speciesId,
    breedId,
    gender,
    status,
    microchipNo,
    pageSize: String(pageSize),
    sort,
    order,
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pet List</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage pet profile, owner, address, identification and status.
            </p>
          </div>

          <Link
            href="/pets/new"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            + Add Pet
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form action="/pets" className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px]">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Search
                </label>

                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search pet, owner, phone, LINE, email, address, species, breed, microchip..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Search by pet name, owner name, phone, LINE, email, house no,
                  building, village, road, sub district, district, postal code,
                  species, breed or microchip.
                </p>
              </div>

              <FormSelect label="Sort By" name="sort" defaultValue={sort}>
                {sortOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </FormSelect>

              <FormSelect label="Order" name="order" defaultValue={order}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </FormSelect>
            </div>

            <details
              open={advancedFilterOpen}
              className="rounded-xl border border-slate-200 bg-slate-50"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
                Advanced Filter
              </summary>

              <div className="grid gap-4 border-t border-slate-200 p-4 md:grid-cols-2 lg:grid-cols-4">
                <FormInput
                  label="Pet Name"
                  name="petName"
                  defaultValue={petName}
                  placeholder="ชื่อสัตว์เลี้ยง"
                />

                <FormInput
                  label="Owner Name"
                  name="ownerName"
                  defaultValue={ownerName}
                  placeholder="ชื่อ / นามสกุลเจ้าของ"
                />

                <FormInput
                  label="Phone No"
                  name="phoneNo"
                  defaultValue={phoneNo}
                  placeholder="เบอร์โทร"
                />

                <FormInput
                  label="House No"
                  name="houseNo"
                  defaultValue={houseNo}
                  placeholder="บ้านเลขที่"
                />

                <FormInput
                  label="Village"
                  name="villageName"
                  defaultValue={villageName}
                  placeholder="หมู่บ้าน"
                />

                <FormInput
                  label="Postal Code"
                  name="postalCode"
                  defaultValue={postalCode}
                  placeholder="รหัสไปรษณีย์"
                />

                <FormInput
                  label="Sub District"
                  name="subDistrict"
                  defaultValue={subDistrict}
                  placeholder="ตำบล / แขวง"
                />

                <FormInput
                  label="District"
                  name="district"
                  defaultValue={district}
                  placeholder="อำเภอ / เขต"
                />

                <FormInput
                  label="Province"
                  name="province"
                  defaultValue={province}
                  placeholder="จังหวัด"
                />

                <FormSelect
                  label="Species"
                  name="speciesId"
                  defaultValue={speciesId}
                >
                  <option value="">All Species</option>
                  {speciesList.map((item) => (
                    <option key={item.speciesId} value={item.speciesId}>
                      {item.speciesName}
                    </option>
                  ))}
                </FormSelect>

                <FormSelect label="Breed" name="breedId" defaultValue={breedId}>
                  <option value="">All Breeds</option>
                  {breedList.map((item) => (
                    <option key={item.breedId} value={item.breedId}>
                      {item.breedName} ({item.species.speciesName})
                    </option>
                  ))}
                </FormSelect>

                <FormSelect label="Gender" name="gender" defaultValue={gender}>
                  <option value="">All Gender</option>
                  {genders.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </FormSelect>

                <FormSelect label="Status" name="status" defaultValue={status}>
                  <option value="">All Status</option>
                  {petStatuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </FormSelect>

                <FormInput
                  label="Microchip No"
                  name="microchipNo"
                  defaultValue={microchipNo}
                  placeholder="Microchip"
                />
              </div>
            </details>

            <input type="hidden" name="pageSize" value={pageSize} />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Search / Apply Filter
              </button>

              <Link
                href="/pets"
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Registered Pets</h2>
              <p className="text-sm text-slate-500">
                Showing {pets.length} of {totalPets} pet(s)
              </p>
            </div>

            <PageSizeSelector baseQuery={baseQuery} pageSize={pageSize} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-6 py-4">Photo</th>
                  <th className="px-6 py-4">Pet</th>
                  <th className="px-6 py-4">Owner / Contact</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4">Species / Breed</th>
                  <th className="px-6 py-4">Physical</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Updated</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No pets found.
                    </td>
                  </tr>
                ) : (
                  pets.map((pet) => (
                    <tr key={pet.petId} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        {pet.petPhotoUrl ? (
                          <PetPhotoPreview
                            src={pet.petPhotoUrl}
                            alt={pet.petName}
                          />
                        ) : (
                          <PetAvatar speciesName={pet.species.speciesName} />
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <Link
                          href={`/pets/${pet.petId}`}
                          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {pet.petName}
                        </Link>

                        <p className="text-xs text-slate-500">
                          ID: {pet.petId.slice(0, 8)}
                        </p>

                        {pet.microchipNo ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Microchip: {pet.microchipNo}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-4">
                        <Link
                          href={`/owners/${pet.owner.ownerId}`}
                          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {pet.owner.fullName}
                        </Link>

                        <p className="text-xs text-slate-500">
                          {pet.owner.phoneNo}
                        </p>

                        {pet.owner.lineId ? (
                          <p className="text-xs text-slate-500">
                            LINE: {pet.owner.lineId}
                          </p>
                        ) : null}

                        {pet.owner.email ? (
                          <p className="text-xs text-slate-500">
                            {pet.owner.email}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-6 py-4">
                        <AddressBlock
                          houseNo={pet.owner.houseNo}
                          villageName={pet.owner.villageName}
                          buildingName={pet.owner.buildingName}
                          road={pet.owner.road}
                          subDistrict={pet.owner.subDistrict}
                          district={pet.owner.district}
                          province={pet.owner.province}
                          postalCode={pet.owner.postalCode}
                        />
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {pet.species.speciesName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {pet.breed?.breedName ?? "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500">
                          Gender: {pet.gender}
                        </p>
                        <p className="text-xs text-slate-500">
                          Age: {pet.estimatedAge || "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Weight: {pet.weight ? `${pet.weight} kg` : "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Height: {pet.high ? `${pet.high} cm` : "-"}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={pet.status} />
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {pet.updatedAt.toLocaleDateString("th-TH", {
                            dateStyle: "medium",
                          })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {pet.updatedAt.toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/pets/${pet.petId}`}
                          title="Open pet actions"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          ⋮
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            baseQuery={baseQuery}
          />
        </div>
      </div>
    </AppShell>
  );
}

function FormInput({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function FormSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {children}
      </select>
    </div>
  );
}

function AddressBlock({
  houseNo,
  villageName,
  buildingName,
  road,
  subDistrict,
  district,
  province,
  postalCode,
}: {
  houseNo: string | null;
  villageName: string | null;
  buildingName: string | null;
  road: string | null;
  subDistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
}) {
  const line1 = [houseNo, villageName, buildingName].filter(Boolean).join(" ");
  const line2 = [road].filter(Boolean).join(" ");
  const line3 = [subDistrict, district].filter(Boolean).join(" ");
  const line4 = [province, postalCode].filter(Boolean).join(" ");

  const hasAddress = line1 || line2 || line3 || line4;

  if (!hasAddress) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <div className="space-y-0.5 text-xs text-slate-500">
      {line1 ? <p>{line1}</p> : null}
      {line2 ? <p>{line2}</p> : null}
      {line3 ? <p>{line3}</p> : null}
      {line4 ? <p>{line4}</p> : null}
    </div>
  );
}

function PetAvatar({ speciesName }: { speciesName: string }) {
  const normalizedSpeciesName = speciesName.toLowerCase();

  const emoji = normalizedSpeciesName.includes("dog")
    ? "🐶"
    : normalizedSpeciesName.includes("cat")
      ? "🐱"
      : normalizedSpeciesName.includes("rabbit")
        ? "🐰"
        : normalizedSpeciesName.includes("bird")
          ? "🐦"
          : normalizedSpeciesName.includes("hamster")
            ? "🐹"
            : normalizedSpeciesName.includes("fish")
              ? "🐠"
              : normalizedSpeciesName.includes("turtle")
                ? "🐢"
                : "🐾";

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
      {emoji}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    INACTIVE: "bg-slate-100 text-slate-600",
    LOST: "bg-amber-50 text-amber-700",
    DECEASED: "bg-red-50 text-red-700",
    ADOPTED: "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function PageSizeSelector({
  baseQuery,
  pageSize,
}: {
  baseQuery: Record<string, string>;
  pageSize: number;
}) {
  return (
    <form action="/pets" className="flex items-center gap-2">
      {Object.entries(baseQuery).map(([key, value]) =>
        key !== "pageSize" && value ? (
          <input key={key} type="hidden" name={key} value={value} />
        ) : null
      )}

      <label className="text-sm text-slate-500">Rows</label>

      <select
        name="pageSize"
        defaultValue={pageSize}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {PAGE_SIZE_OPTIONS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        Apply
      </button>
    </form>
  );
}

function Pagination({
  page,
  totalPages,
  baseQuery,
}: {
  page: number;
  totalPages: number;
  baseQuery: Record<string, string>;
}) {
  const previousPage = Math.max(page - 1, 1);
  const nextPage = Math.min(page + 1, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </p>

      <div className="flex items-center gap-2">
        <PaginationLink
          label="Previous"
          disabled={page <= 1}
          query={{
            ...baseQuery,
            page: String(previousPage),
          }}
        />

        <PaginationLink
          label="Next"
          disabled={page >= totalPages}
          query={{
            ...baseQuery,
            page: String(nextPage),
          }}
        />
      </div>
    </div>
  );
}

function PaginationLink({
  label,
  disabled,
  query,
}: {
  label: string;
  disabled: boolean;
  query: Record<string, string>;
}) {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  if (disabled) {
    return (
      <span className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-300">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/pets?${searchParams.toString()}`}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      {label}
    </Link>
  );
}