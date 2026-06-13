import type { ModuleName, ActionName } from "@/lib/permissions";

export type NavigationItem = {
  label: string;
  href: string;
  moduleName: ModuleName;
  actionName: ActionName;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    title: "Main",
    items: [
      {
        label: "Dashboard",
        href: "/",
        moduleName: "pet",
        actionName: "view",
      },
      {
        label: "Pets",
        href: "/pets",
        moduleName: "pet",
        actionName: "view",
      },
      {
        label: "Owners",
        href: "/owners",
        moduleName: "owner",
        actionName: "view",
      },
      {
        label: "Appointment Calendar",
        href: "/appointments/calendar",
        moduleName: "appointment",
        actionName: "view",
      },
      {
        label: "Medical Queue",
        href: "/medical-queue",
        moduleName: "queue",
        actionName: "view",
      },
      {
        label: "Visit Intake",
        href: "/visits",
        moduleName: "visit",
        actionName: "view",
      },
      {
        label: "Vaccine Reminders",
        href: "/vaccines/reminders",
        moduleName: "vaccine",
        actionName: "view",
      },
      {
        label: "Grooming",
        href: "/grooming",
        moduleName: "groomer",
        actionName: "view",
      },
      {
        label: "Billing",
        href: "/billing",
        moduleName: "payment",
        actionName: "view",
      },
      {
        label: "Pharmacy",
        href: "/pharmacy",
        moduleName: "prescription",
        actionName: "view",
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "User Management",
        href: "/administration/users",
        moduleName: "user",
        actionName: "view",
      },
    ],
  },
  {
    title: "Setup",
    items: [
      {
        label: "Species",
        href: "/setup/species",
        moduleName: "pet",
        actionName: "create",
      },
      {
        label: "Vaccines",
        href: "/setup/vaccines",
        moduleName: "visit",
        actionName: "create",
      },
      {
        label: "Grooming Services",
        href: "/setup/grooming-services",
        moduleName: "groomer",
        actionName: "create",
      },
    ],
  },
];