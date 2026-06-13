"use client";

export type ServiceType = "TREATMENT" | "GROOMING";

type ServiceTypeSelectorProps = {
  name?: string;
  defaultValue?: ServiceType;
};

const serviceTypes: {
  value: ServiceType;
  title: string;
  description: string;
}[] = [
  {
    value: "TREATMENT",
    title: "Treatment",
    description: "Medical visit, vaccine, sick case, follow-up, surgery consult",
  },
  {
    value: "GROOMING",
    title: "Grooming",
    description: "Bath, haircut, nail cut, full grooming",
  },
];

export function ServiceTypeSelector({
  name = "serviceType",
  defaultValue = "TREATMENT",
}: ServiceTypeSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {serviceTypes.map((service) => (
        <label
          key={service.value}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
        >
          <input
            type="radio"
            name={name}
            value={service.value}
            defaultChecked={service.value === defaultValue}
            className="peer sr-only"
          />

          <div className="rounded-lg border border-transparent p-1 peer-checked:border-blue-500 peer-checked:bg-blue-50">
            <div className="text-sm font-bold text-slate-900">
              {service.title}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {service.description}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}
