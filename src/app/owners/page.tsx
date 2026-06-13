import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { PetPhotoPreview } from "@/components/pets/PetPhotoPreview";

type Props = {
  searchParams?: Promise<{
    q?: string;
    ownerName?: string;
    petName?: string;
    villageOrBuilding?: string;
    subDistrict?: string;
    postalCode?: string;
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
  { value: "fullName", label: "Owner Name" },
  { value: "petName", label: "Pet Name" },
  { value: "subDistrict", label: "Sub District" },
  { value: "postalCode", label: "Postal Code" },
];

export default async function OwnersPage({ searchParams }: Props) {
  await requirePermission("owner", "view");

  const params = await searchParams;

  const q = String(params?.q || "").trim();
  const ownerName = String(params?.ownerName || "").trim();
  const petName = String(params?.petName || "").trim();
  const villageOrBuilding = String(params?.villageOrBuilding || "").trim();
  const subDistrict = String(params?.subDistrict || "").trim();
  const postalCode = String(params?.postalCode || "").trim();

  const page = Math.max(Number(params?.page || 1), 1);

  const pageSizeValue = Number(params?.pageSize || DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeValue)
    ? pageSizeValue
    : DEFAULT_PAGE_SIZE;

  const sort = [
    "updatedAt",
    "createdAt",
    "fullName",
    "petName",
    "subDistrict",
    "postalCode",
  ].includes(String(params?.sort || ""))
    ? String(params?.sort)
    : "updatedAt";

  const order = params?.order === "asc" ? "asc" : "desc";
  const advancedFilterOpen =
    ownerName || petName || villageOrBuilding || subDistrict || postalCode;

  const where: Prisma.OwnerWhereInput = {
    deletedAt: null,

    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phoneNo: { contains: q, mode: "insensitive" } },
            { lineId: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },

            { houseNo: { contains: q, mode: "insensitive" } },
            { villageName: { contains: q, mode: "insensitive" } },
            { buildingName: { contains: q, mode: "insensitive" } },
            { soi: { contains: q, mode: "insensitive" } },
            { road: { contains: q, mode: "insensitive" } },
            { subDistrict: { contains: q, mode: "insensitive" } },
            { district: { contains: q, mode: "insensitive" } },
            { province: { contains: q, mode: "insensitive" } },
            { postalCode: { contains: q, mode: "insensitive" } },

            {
              pets: {
                some: {
                  deletedAt: null,
                  petName: { contains: q, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),

    ...(ownerName
      ? {
          fullName: {
            contains: ownerName,
            mode: "insensitive",
          },
        }
      : {}),

    ...(petName
      ? {
          pets: {
            some: {
              deletedAt: null,
              petName: {
                contains: petName,
                mode: "insensitive",
              },
            },
          },
        }
      : {}),

    ...(villageOrBuilding
      ? {
          OR: [
            {
              villageName: {
                contains: villageOrBuilding,
                mode: "insensitive",
              },
            },
            {
              buildingName: {
                contains: villageOrBuilding,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),

    ...(subDistrict
      ? {
          subDistrict: {
            contains: subDistrict,
            mode: "insensitive",
          },
        }
      : {}),

    ...(postalCode
      ? {
          postalCode: {
            contains: postalCode,
            mode: "insensitive",
          },
        }
      : {}),
  };

  const isPetNameSort = sort === "petName";

  const orderBy: Prisma.OwnerOrderByWithRelationInput =
    sort === "fullName"
      ? { fullName: order }
      : sort === "subDistrict"
        ? { subDistrict: order }
        : sort === "postalCode"
          ? { postalCode: order }
          : sort === "createdAt"
            ? { createdAt: order }
            : { updatedAt: order };

  const totalOwners = await prisma.owner.count({ where });
  const totalPages = Math.max(Math.ceil(totalOwners / pageSize), 1);
  const safePage = Math.min(page, totalPages);

  const owners = isPetNameSort
    ? (
        await prisma.owner.findMany({
          where,
          include: {
            pets: {
              where: {
                deletedAt: null,
              },
              include: {
                species: true,
                breed: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        })
      )
        .sort((a, b) => {
          const aPetName = a.pets[0]?.petName || "";
          const bPetName = b.pets[0]?.petName || "";

          return order === "asc"
            ? aPetName.localeCompare(bPetName)
            : bPetName.localeCompare(aPetName);
        })
        .slice((safePage - 1) * pageSize, safePage * pageSize)
    : await prisma.owner.findMany({
        where,
        include: {
          pets: {
            where: {
              deletedAt: null,
            },
            include: {
              species: true,
              breed: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy,
        skip: (safePage - 1) * pageSize,
        take: pageSize,
      });

  const baseQuery = {
    q,
    ownerName,
    petName,
    villageOrBuilding,
    subDistrict,
    postalCode,
    pageSize: String(pageSize),
    sort,
    order,
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              Owner List
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage pet owner information, contact details, address and
              registered pets.
            </p>
          </div>

          <Link
            href="/owners/new"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            + Add Owner
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form action="/owners" className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px]">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Search
                </label>

                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search owner, phone, pet, address..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Search by owner name, phone, LINE, email, pet name, house no,
                  village, building, road, sub district, district, province or
                  postal code.
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
              open={Boolean(advancedFilterOpen)}
              className="rounded-xl border border-slate-200 bg-slate-50"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
                Advanced Filter
              </summary>

              <div className="grid gap-4 border-t border-slate-200 p-4 md:grid-cols-2 lg:grid-cols-5">
                <FormInput
                  label="Owner Name"
                  name="ownerName"
                  defaultValue={ownerName}
                  placeholder="ชื่อ / นามสกุล"
                />

                <FormInput
                  label="Pet Name"
                  name="petName"
                  defaultValue={petName}
                  placeholder="ชื่อสัตว์เลี้ยง"
                />

                <FormInput
                  label="Village / Building"
                  name="villageOrBuilding"
                  defaultValue={villageOrBuilding}
                  placeholder="หมู่บ้าน / ตึก / อาคาร"
                />

                <FormInput
                  label="Sub District"
                  name="subDistrict"
                  defaultValue={subDistrict}
                  placeholder="ตำบล / แขวง"
                />

                <FormInput
                  label="Postal Code"
                  name="postalCode"
                  defaultValue={postalCode}
                  placeholder="รหัสไปรษณีย์"
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
                href="/owners"
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
              <h2 className="text-lg font-semibold">Registered Owners</h2>
              <p className="text-sm text-slate-500">
                Showing {owners.length} of {totalOwners} owner(s)
              </p>
            </div>

            <PageSizeSelector
              baseQuery={baseQuery}
              pageSize={pageSize}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-6 py-4">Photo</th>
                  <th className="px-6 py-4">Owner & Pets</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4">Updated</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {owners.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-12 text-center text-slate-500"
                      colSpan={6}
                    >
                      No owners found.
                    </td>
                  </tr>
                ) : (
                  owners.map((owner) => {
                    const primaryPet = owner.pets[0];

                    return (
                      <tr key={owner.ownerId} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          {primaryPet?.petPhotoUrl ? (
                            <PetPhotoPreview
                              src={primaryPet.petPhotoUrl}
                              alt={primaryPet.petName}
                            />
                          ) : primaryPet ? (
                            <PetAvatar
                              speciesName={primaryPet.species.speciesName}
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                              🐾
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <Link
                            href={`/owners/${owner.ownerId}`}
                            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {owner.fullName}
                          </Link>

                          <p className="text-xs text-slate-500">
                            ID: {owner.ownerId.slice(0, 8)}
                          </p>

                          <PetList pets={owner.pets} />
                        </td>

                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">
                            {owner.phoneNo}
                          </p>

                          {owner.lineId ? (
                            <p className="text-xs text-slate-500">
                              LINE: {owner.lineId}
                            </p>
                          ) : null}

                          {owner.email ? (
                            <p className="text-xs text-slate-500">
                              {owner.email}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-6 py-4">
                          <AddressBlock
                            houseNo={owner.houseNo}
                            villageName={owner.villageName}
                            buildingName={owner.buildingName}
                            soi={owner.soi}
                            road={owner.road}
                            subDistrict={owner.subDistrict}
                            district={owner.district}
                            province={owner.province}
                            postalCode={owner.postalCode}
                          />
                        </td>

                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">
                            {owner.updatedAt.toLocaleDateString("th-TH", {
                              dateStyle: "medium",
                            })}
                          </p>
                          <p className="text-xs text-slate-500">
                            {owner.updatedAt.toLocaleTimeString("th-TH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/owners/${owner.ownerId}`}
                            title="Open owner actions"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            ⋮
                          </Link>
                        </td>
                      </tr>
                    );
                  })
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

function PetList({
  pets,
}: {
  pets: Array<{
    petId: string;
    petName: string;
  }>;
}) {
  const visiblePets = pets.slice(0, 3);
  const remainingCount = Math.max(pets.length - visiblePets.length, 0);

  if (pets.length === 0) {
    return <p className="mt-2 text-xs text-slate-400">No registered pets</p>;
  }

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Pets
      </p>

      <div className="space-y-0.5">
        {visiblePets.map((pet) => (
          <Link
            key={pet.petId}
            href={`/pets/${pet.petId}`}
            className="block text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            • {pet.petName}
          </Link>
        ))}

        {remainingCount > 0 ? (
          <p className="text-xs text-slate-500">(+{remainingCount})</p>
        ) : null}
      </div>
    </div>
  );
}

function AddressBlock({
  houseNo,
  villageName,
  buildingName,
  soi,
  road,
  subDistrict,
  district,
  province,
  postalCode,
}: {
  houseNo: string | null;
  villageName: string | null;
  buildingName: string | null;
  soi: string | null;
  road: string | null;
  subDistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
}) {
  const line1 = [houseNo, villageName, buildingName].filter(Boolean).join(" ");
  const line2 = [soi, road].filter(Boolean).join(" ");
  const line3 = [subDistrict, district].filter(Boolean).join(" ");
  const line4 = [province, postalCode].filter(Boolean).join(" ");

  const hasAddress = line1 || line2 || line3 || line4;

  if (!hasAddress) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <div className="space-y-0.5 text-sm text-slate-700">
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

function PageSizeSelector({
  baseQuery,
  pageSize,
}: {
  baseQuery: Record<string, string>;
  pageSize: number;
}) {
  return (
    <form action="/owners" className="flex items-center gap-2">
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
      href={`/owners?${searchParams.toString()}`}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      {label}
    </Link>
  );
}