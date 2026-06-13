"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-auth";
import {
  DiagnosisType,
  Prisma,
  SoapStatus,
  type VisitStatus,
  type VisitType,
} from "@/generated/prisma/client";

const DIAGNOSIS_TYPES: DiagnosisType[] = [
  DiagnosisType.PRIMARY,
  DiagnosisType.SECONDARY,
  DiagnosisType.DIFFERENTIAL,
];

type SoapPayload = {
  soapNoteId: string | null;
  visitId: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  historyOfPresentIllness: string | null;
  symptomDuration: string | null;
  symptomProgression: string | null;
  medicationHistory: string | null;
  vaccinationHistory: string | null;
  ownerConcern: string | null;
  generalAppearanceNote: string | null;
  eyesNote: string | null;
  earsNote: string | null;
  noseNote: string | null;
  oralCavityNote: string | null;
  skinCoatNote: string | null;
  cardiovascularNote: string | null;
  respiratoryNote: string | null;
  gastrointestinalNote: string | null;
  musculoskeletalNote: string | null;
  neurologicalNote: string | null;
  urogenitalNote: string | null;
  lymphNodeNote: string | null;
  painTendernessNote: string | null;
  physicalExamSummary: string | null;
  problemList: string | null;
  diagnosisSummary: string | null;
  differentialNote: string | null;
  prognosisNote: string | null;
  treatmentPlanSummary: string | null;
  medicationPlanNote: string | null;
  labImagingPlanNote: string | null;
  procedurePlanNote: string | null;
  vaccinePlanNote: string | null;
  dietHomeCareAdvice: string | null;
  clientCommunicationNote: string | null;
  followUpNote: string | null;
  followUpDate: Date | null;
};

function requiredString(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = optionalString(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.");
  }

  return date;
}

function toJsonDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function isValidDiagnosisType(value: string): value is DiagnosisType {
  return DIAGNOSIS_TYPES.includes(value as DiagnosisType);
}

function getSoapPayload(formData: FormData): SoapPayload {
  const visitId = requiredString(formData.get("visitId"));

  if (!visitId) {
    throw new Error("Visit ID is required.");
  }

  return {
    soapNoteId: optionalString(formData.get("soapNoteId")),
    visitId,
    subjective: optionalString(formData.get("subjective")),
    objective: optionalString(formData.get("objective")),
    assessment: optionalString(formData.get("assessment")),
    plan: optionalString(formData.get("plan")),
    historyOfPresentIllness: optionalString(
      formData.get("historyOfPresentIllness"),
    ),
    symptomDuration: optionalString(formData.get("symptomDuration")),
    symptomProgression: optionalString(formData.get("symptomProgression")),
    medicationHistory: optionalString(formData.get("medicationHistory")),
    vaccinationHistory: optionalString(formData.get("vaccinationHistory")),
    ownerConcern: optionalString(formData.get("ownerConcern")),
    generalAppearanceNote: optionalString(formData.get("generalAppearanceNote")),
    eyesNote: optionalString(formData.get("eyesNote")),
    earsNote: optionalString(formData.get("earsNote")),
    noseNote: optionalString(formData.get("noseNote")),
    oralCavityNote: optionalString(formData.get("oralCavityNote")),
    skinCoatNote: optionalString(formData.get("skinCoatNote")),
    cardiovascularNote: optionalString(formData.get("cardiovascularNote")),
    respiratoryNote: optionalString(formData.get("respiratoryNote")),
    gastrointestinalNote: optionalString(formData.get("gastrointestinalNote")),
    musculoskeletalNote: optionalString(formData.get("musculoskeletalNote")),
    neurologicalNote: optionalString(formData.get("neurologicalNote")),
    urogenitalNote: optionalString(formData.get("urogenitalNote")),
    lymphNodeNote: optionalString(formData.get("lymphNodeNote")),
    painTendernessNote: optionalString(formData.get("painTendernessNote")),
    physicalExamSummary: optionalString(formData.get("physicalExamSummary")),
    problemList: optionalString(formData.get("problemList")),
    diagnosisSummary: optionalString(formData.get("diagnosisSummary")),
    differentialNote: optionalString(formData.get("differentialNote")),
    prognosisNote: optionalString(formData.get("prognosisNote")),
    treatmentPlanSummary: optionalString(formData.get("treatmentPlanSummary")),
    medicationPlanNote: optionalString(formData.get("medicationPlanNote")),
    labImagingPlanNote: optionalString(formData.get("labImagingPlanNote")),
    procedurePlanNote: optionalString(formData.get("procedurePlanNote")),
    vaccinePlanNote: optionalString(formData.get("vaccinePlanNote")),
    dietHomeCareAdvice: optionalString(formData.get("dietHomeCareAdvice")),
    clientCommunicationNote: optionalString(
      formData.get("clientCommunicationNote"),
    ),
    followUpNote: optionalString(formData.get("followUpNote")),
    followUpDate: optionalDate(formData.get("followUpDate")),
  };
}

function revalidateSoapPaths(visitId?: string | null, soapNoteId?: string | null) {
  revalidatePath("/visits");

  if (visitId) {
    revalidatePath(`/visits/${visitId}`);
    revalidatePath(`/visits/${visitId}/soap`);
  }

  if (soapNoteId) {
    revalidatePath(`/soap/${soapNoteId}`);
  }
}

function buildVisitAuditValue(visit: {
  visitId: string;
  visitNo: string;
  appointmentId: string | null;
  ownerId: string;
  petId: string;
  vetId: string | null;
  visitDate: Date;
  visitType: VisitType;
  status: VisitStatus;
  checkedInAt?: Date | null;
  completedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}): Prisma.InputJsonObject {
  return {
    visitId: visit.visitId,
    visitNo: visit.visitNo,
    appointmentId: visit.appointmentId,
    ownerId: visit.ownerId,
    petId: visit.petId,
    vetId: visit.vetId,
    visitDate: toJsonDate(visit.visitDate),
    visitType: visit.visitType,
    status: visit.status,
    checkedInAt: toJsonDate(visit.checkedInAt),
    completedAt: toJsonDate(visit.completedAt),
    deletedAt: toJsonDate(visit.deletedAt),
    createdAt: toJsonDate(visit.createdAt),
    updatedAt: toJsonDate(visit.updatedAt),
    createdByUserId: visit.createdByUserId ?? null,
    updatedByUserId: visit.updatedByUserId ?? null,
  };
}

function buildSoapAuditValue(soapNote: {
  soapNoteId: string;
  visitId: string;
  vetId: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  historyOfPresentIllness?: string | null;
  symptomDuration?: string | null;
  symptomProgression?: string | null;
  medicationHistory?: string | null;
  vaccinationHistory?: string | null;
  ownerConcern?: string | null;
  generalAppearanceNote?: string | null;
  eyesNote?: string | null;
  earsNote?: string | null;
  noseNote?: string | null;
  oralCavityNote?: string | null;
  skinCoatNote?: string | null;
  cardiovascularNote?: string | null;
  respiratoryNote?: string | null;
  gastrointestinalNote?: string | null;
  musculoskeletalNote?: string | null;
  neurologicalNote?: string | null;
  urogenitalNote?: string | null;
  lymphNodeNote?: string | null;
  painTendernessNote?: string | null;
  physicalExamSummary?: string | null;
  problemList?: string | null;
  diagnosisSummary?: string | null;
  differentialNote?: string | null;
  prognosisNote?: string | null;
  treatmentPlanSummary?: string | null;
  medicationPlanNote?: string | null;
  labImagingPlanNote?: string | null;
  procedurePlanNote?: string | null;
  vaccinePlanNote?: string | null;
  dietHomeCareAdvice?: string | null;
  clientCommunicationNote?: string | null;
  followUpNote?: string | null;
  followUpDate?: Date | null;
  status: SoapStatus;
  finalizedAt?: Date | null;
  finalizedByUserId?: string | null;
  finalizationNote?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}): Prisma.InputJsonObject {
  return {
    soapNoteId: soapNote.soapNoteId,
    visitId: soapNote.visitId,
    vetId: soapNote.vetId,
    subjective: soapNote.subjective ?? null,
    objective: soapNote.objective ?? null,
    assessment: soapNote.assessment ?? null,
    plan: soapNote.plan ?? null,
    historyOfPresentIllness: soapNote.historyOfPresentIllness ?? null,
    symptomDuration: soapNote.symptomDuration ?? null,
    symptomProgression: soapNote.symptomProgression ?? null,
    medicationHistory: soapNote.medicationHistory ?? null,
    vaccinationHistory: soapNote.vaccinationHistory ?? null,
    ownerConcern: soapNote.ownerConcern ?? null,
    generalAppearanceNote: soapNote.generalAppearanceNote ?? null,
    eyesNote: soapNote.eyesNote ?? null,
    earsNote: soapNote.earsNote ?? null,
    noseNote: soapNote.noseNote ?? null,
    oralCavityNote: soapNote.oralCavityNote ?? null,
    skinCoatNote: soapNote.skinCoatNote ?? null,
    cardiovascularNote: soapNote.cardiovascularNote ?? null,
    respiratoryNote: soapNote.respiratoryNote ?? null,
    gastrointestinalNote: soapNote.gastrointestinalNote ?? null,
    musculoskeletalNote: soapNote.musculoskeletalNote ?? null,
    neurologicalNote: soapNote.neurologicalNote ?? null,
    urogenitalNote: soapNote.urogenitalNote ?? null,
    lymphNodeNote: soapNote.lymphNodeNote ?? null,
    painTendernessNote: soapNote.painTendernessNote ?? null,
    physicalExamSummary: soapNote.physicalExamSummary ?? null,
    problemList: soapNote.problemList ?? null,
    diagnosisSummary: soapNote.diagnosisSummary ?? null,
    differentialNote: soapNote.differentialNote ?? null,
    prognosisNote: soapNote.prognosisNote ?? null,
    treatmentPlanSummary: soapNote.treatmentPlanSummary ?? null,
    medicationPlanNote: soapNote.medicationPlanNote ?? null,
    labImagingPlanNote: soapNote.labImagingPlanNote ?? null,
    procedurePlanNote: soapNote.procedurePlanNote ?? null,
    vaccinePlanNote: soapNote.vaccinePlanNote ?? null,
    dietHomeCareAdvice: soapNote.dietHomeCareAdvice ?? null,
    clientCommunicationNote: soapNote.clientCommunicationNote ?? null,
    followUpNote: soapNote.followUpNote ?? null,
    followUpDate: toJsonDate(soapNote.followUpDate),
    status: soapNote.status,
    finalizedAt: toJsonDate(soapNote.finalizedAt),
    finalizedByUserId: soapNote.finalizedByUserId ?? null,
    finalizationNote: soapNote.finalizationNote ?? null,
    deletedAt: toJsonDate(soapNote.deletedAt),
    createdAt: toJsonDate(soapNote.createdAt),
    updatedAt: toJsonDate(soapNote.updatedAt),
    createdByUserId: soapNote.createdByUserId ?? null,
    updatedByUserId: soapNote.updatedByUserId ?? null,
  };
}

function buildDiagnosisAuditValue(diagnosis: {
  visitDiagnosisId: string;
  visitId: string;
  diagnosisCodeId?: string | null;
  diagnosisText?: string | null;
  diagnosisType: DiagnosisType;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}): Prisma.InputJsonObject {
  return {
    visitDiagnosisId: diagnosis.visitDiagnosisId,
    visitId: diagnosis.visitId,
    diagnosisCodeId: diagnosis.diagnosisCodeId ?? null,
    diagnosisText: diagnosis.diagnosisText ?? null,
    diagnosisType: diagnosis.diagnosisType,
    deletedAt: toJsonDate(diagnosis.deletedAt),
    createdAt: toJsonDate(diagnosis.createdAt),
    updatedAt: toJsonDate(diagnosis.updatedAt),
    createdByUserId: diagnosis.createdByUserId ?? null,
    updatedByUserId: diagnosis.updatedByUserId ?? null,
  };
}

async function getExistingVisit(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: {
      visitId,
    },
  });

  if (!visit || visit.deletedAt) {
    throw new Error("Visit not found.");
  }

  return visit;
}

async function getExistingSoapNote(soapNoteId: string) {
  const soapNote = await prisma.soapNote.findUnique({
    where: {
      soapNoteId,
    },
  });

  if (!soapNote || soapNote.deletedAt) {
    throw new Error("SOAP note not found.");
  }

  return soapNote;
}

function assertVisitCanHaveSoap(status: VisitStatus) {
  if (status === "CANCELLED") {
    throw new Error("Cancelled visit cannot have SOAP note.");
  }
}

function assertSoapCanBeChanged(status: SoapStatus) {
  if (status === SoapStatus.FINALIZED) {
    throw new Error("Finalized SOAP note cannot be changed. Please create an addendum instead.");
  }
}

function getSoapDataFromPayload(payload: SoapPayload) {
  return {
    subjective: payload.subjective,
    objective: payload.objective,
    assessment: payload.assessment,
    plan: payload.plan,
    historyOfPresentIllness: payload.historyOfPresentIllness,
    symptomDuration: payload.symptomDuration,
    symptomProgression: payload.symptomProgression,
    medicationHistory: payload.medicationHistory,
    vaccinationHistory: payload.vaccinationHistory,
    ownerConcern: payload.ownerConcern,
    generalAppearanceNote: payload.generalAppearanceNote,
    eyesNote: payload.eyesNote,
    earsNote: payload.earsNote,
    noseNote: payload.noseNote,
    oralCavityNote: payload.oralCavityNote,
    skinCoatNote: payload.skinCoatNote,
    cardiovascularNote: payload.cardiovascularNote,
    respiratoryNote: payload.respiratoryNote,
    gastrointestinalNote: payload.gastrointestinalNote,
    musculoskeletalNote: payload.musculoskeletalNote,
    neurologicalNote: payload.neurologicalNote,
    urogenitalNote: payload.urogenitalNote,
    lymphNodeNote: payload.lymphNodeNote,
    painTendernessNote: payload.painTendernessNote,
    physicalExamSummary: payload.physicalExamSummary,
    problemList: payload.problemList,
    diagnosisSummary: payload.diagnosisSummary,
    differentialNote: payload.differentialNote,
    prognosisNote: payload.prognosisNote,
    treatmentPlanSummary: payload.treatmentPlanSummary,
    medicationPlanNote: payload.medicationPlanNote,
    labImagingPlanNote: payload.labImagingPlanNote,
    procedurePlanNote: payload.procedurePlanNote,
    vaccinePlanNote: payload.vaccinePlanNote,
    dietHomeCareAdvice: payload.dietHomeCareAdvice,
    clientCommunicationNote: payload.clientCommunicationNote,
    followUpNote: payload.followUpNote,
    followUpDate: payload.followUpDate,
  };
}

export async function getActiveDiagnosisCodes() {
  await requirePermission("soap", "view");

  return prisma.diagnosisCode.findMany({
    where: {
      activeFlag: true,
      deletedAt: null,
    },
    orderBy: [{ code: "asc" }],
    select: {
      diagnosisCodeId: true,
      code: true,
      nameEn: true,
      nameTh: true,
      description: true,
    },
  });
}

export async function getSoapPageData(visitId: string) {
  await requirePermission("soap", "view");

  return prisma.visit.findFirst({
    where: {
      visitId,
      deletedAt: null,
    },
    include: {
      owner: true,
      pet: {
        include: {
          species: true,
          breed: true,
        },
      },
      vet: true,
      appointment: {
        include: {
          medicalQueue: true,
        },
      },
      medicalQueue: true,
      soapNote: {
        include: {
          vet: true,
          addendums: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              addedAt: "desc",
            },
          },
        },
      },
      diagnoses: {
        where: {
          deletedAt: null,
        },
        include: {
          diagnosisCode: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      vaccineRecords: {
        where: {
          deletedAt: null,
        },
        include: {
          vaccine: true,
        },
        orderBy: {
          injectionDate: "desc",
        },
      },
    },
  });
}

export async function getPetMedicalHistoryByVisitId(visitId: string) {
  await requirePermission("soap", "view");

  const currentVisit = await prisma.visit.findFirst({
    where: {
      visitId,
      deletedAt: null,
    },
    select: {
      visitId: true,
      petId: true,
    },
  });

  if (!currentVisit) {
    return [];
  }

  return prisma.visit.findMany({
    where: {
      petId: currentVisit.petId,
      deletedAt: null,
      NOT: {
        visitId: currentVisit.visitId,
      },
    },
    include: {
      vet: true,
      appointment: true,
      soapNote: {
        include: {
          vet: true,
          addendums: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              addedAt: "desc",
            },
          },
        },
      },
      diagnoses: {
        where: {
          deletedAt: null,
        },
        include: {
          diagnosisCode: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      vaccineRecords: {
        where: {
          deletedAt: null,
        },
        include: {
          vaccine: true,
        },
        orderBy: {
          injectionDate: "desc",
        },
      },
    },
    orderBy: {
      visitDate: "desc",
    },
    take: 10,
  });
}


export async function createOrUpdateSoapNote(formData: FormData) {
  const currentUser = await requirePermission("soap", "update");
  const payload = getSoapPayload(formData);

  const visit = await getExistingVisit(payload.visitId);
  assertVisitCanHaveSoap(visit.status);

  const existingSoap = await prisma.soapNote.findFirst({
    where: {
      visitId: payload.visitId,
      deletedAt: null,
    },
  });

  if (existingSoap) {
    assertSoapCanBeChanged(existingSoap.status);
  }

  const soapNote = await prisma.$transaction(async (tx) => {
    if (existingSoap) {
      const updatedSoap = await tx.soapNote.update({
        where: {
          soapNoteId: existingSoap.soapNoteId,
        },
        data: {
          ...getSoapDataFromPayload(payload),
          updatedByUserId: currentUser.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.userId,
          action: "UPDATE_SOAP_NOTE",
          entityName: "SoapNote",
          entityId: updatedSoap.soapNoteId,
          oldValue: buildSoapAuditValue(existingSoap),
          newValue: buildSoapAuditValue(updatedSoap),
          ipAddress: null,
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        },
      });

      return updatedSoap;
    }

    const createdSoap = await tx.soapNote.create({
      data: {
        visitId: payload.visitId,
        vetId: visit.vetId ?? currentUser.userId,
        ...getSoapDataFromPayload(payload),
        status: SoapStatus.DRAFT,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_SOAP_NOTE",
        entityName: "SoapNote",
        entityId: createdSoap.soapNoteId,
        newValue: buildSoapAuditValue(createdSoap),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return createdSoap;
  });

  revalidateSoapPaths(soapNote.visitId, soapNote.soapNoteId);

  return soapNote;
}

export async function finalizeSoapNote(formData: FormData) {
  const currentUser = await requirePermission("soap", "finalize");

  const soapNoteId = requiredString(formData.get("soapNoteId"));
  const finalizationNote = optionalString(formData.get("finalizationNote"));

  if (!soapNoteId) {
    throw new Error("SOAP Note ID is required.");
  }

  const existingSoap = await getExistingSoapNote(soapNoteId);
  assertSoapCanBeChanged(existingSoap.status);

  const visit = await getExistingVisit(existingSoap.visitId);
  assertVisitCanHaveSoap(visit.status);

  const diagnosisCount = await prisma.visitDiagnosis.count({
    where: {
      visitId: existingSoap.visitId,
      deletedAt: null,
    },
  });

  const missingRequiredItems: string[] = [];

  if (!existingSoap.subjective && !existingSoap.historyOfPresentIllness) {
    missingRequiredItems.push("Subjective");
  }

  if (!existingSoap.objective && !existingSoap.physicalExamSummary) {
    missingRequiredItems.push("Objective");
  }

  if (
    !existingSoap.assessment &&
    !existingSoap.diagnosisSummary &&
    !existingSoap.problemList
  ) {
    missingRequiredItems.push("Assessment");
  }

  if (!existingSoap.plan && !existingSoap.treatmentPlanSummary) {
    missingRequiredItems.push("Plan");
  }

  if (diagnosisCount <= 0) {
    missingRequiredItems.push("Diagnosis");
  }

  if (missingRequiredItems.length > 0) {
    return {
      success: false as const,
      missingRequiredItems,
      message: `Cannot finalize SOAP. Missing required items: ${missingRequiredItems.join(", ")}.`,
    };
  }

  const finalizedSoap = await prisma.$transaction(async (tx) => {
    const result = await tx.soapNote.update({
      where: {
        soapNoteId,
      },
      data: {
        status: SoapStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedByUserId: currentUser.userId,
        finalizationNote,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "FINALIZE_SOAP_NOTE",
        entityName: "SoapNote",
        entityId: soapNoteId,
        oldValue: buildSoapAuditValue(existingSoap),
        newValue: buildSoapAuditValue(result),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.jobQueue.create({
      data: {
        jobType: "SOAP_FINALIZED_NOTIFICATION",
        payload: {
          soapNoteId: result.soapNoteId,
          visitId: result.visitId,
          vetId: result.vetId,
          finalizedAt: toJsonDate(result.finalizedAt),
        },
        status: "PENDING",
        availableAt: new Date(),
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return result;
  });

  revalidateSoapPaths(finalizedSoap.visitId, finalizedSoap.soapNoteId);

  return { success: true as const, soapNote: finalizedSoap };
}

export async function createSoapAddendum(formData: FormData) {
  const currentUser = await requirePermission("soap", "addendum");

  const soapNoteId = requiredString(formData.get("soapNoteId"));
  const addendumNote = requiredString(formData.get("addendumNote"));

  if (!soapNoteId) {
    throw new Error("SOAP Note ID is required.");
  }

  if (!addendumNote) {
    throw new Error("Addendum note is required.");
  }

  const existingSoap = await getExistingSoapNote(soapNoteId);

  if (existingSoap.status !== SoapStatus.FINALIZED) {
    throw new Error("Addendum can be created only after SOAP note is finalized.");
  }

  const addendum = await prisma.$transaction(async (tx) => {
    const createdAddendum = await tx.soapAddendum.create({
      data: {
        soapNoteId,
        addendumNote,
        addedByUserId: currentUser.userId,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_SOAP_ADDENDUM",
        entityName: "SoapAddendum",
        entityId: createdAddendum.soapAddendumId,
        newValue: {
          soapAddendumId: createdAddendum.soapAddendumId,
          soapNoteId: createdAddendum.soapNoteId,
          addendumNote: createdAddendum.addendumNote,
          addedByUserId: createdAddendum.addedByUserId,
          addedAt: toJsonDate(createdAddendum.addedAt),
        },
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return createdAddendum;
  });

  revalidateSoapPaths(existingSoap.visitId, existingSoap.soapNoteId);

  return addendum;
}

export async function deleteSoapNote(formData: FormData) {
  const currentUser = await requirePermission("soap", "delete");

  const soapNoteId = requiredString(formData.get("soapNoteId"));
  const deleteReason = optionalString(formData.get("deleteReason"));

  if (!soapNoteId) {
    throw new Error("SOAP Note ID is required.");
  }

  const existingSoap = await getExistingSoapNote(soapNoteId);

  if (existingSoap.status === SoapStatus.FINALIZED) {
    throw new Error("Finalized SOAP note cannot be deleted.");
  }

  const deletedSoap = await prisma.$transaction(async (tx) => {
    const result = await tx.soapNote.update({
      where: {
        soapNoteId,
      },
      data: {
        deletedAt: new Date(),
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "DELETE_SOAP_NOTE",
        entityName: "SoapNote",
        entityId: soapNoteId,
        oldValue: buildSoapAuditValue(existingSoap),
        newValue: {
          ...buildSoapAuditValue(result),
          deleteReason,
        },
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return result;
  });

  revalidateSoapPaths(deletedSoap.visitId, deletedSoap.soapNoteId);

  return deletedSoap;
}

export async function addVisitDiagnosis(formData: FormData) {
  const currentUser = await requirePermission("soap", "diagnosis");

  const visitId = requiredString(formData.get("visitId"));
  const diagnosisCodeId = optionalString(formData.get("diagnosisCodeId"));
  const diagnosisText = optionalString(formData.get("diagnosisText"));
  const diagnosisTypeRaw = requiredString(formData.get("diagnosisType"));

  if (!visitId) {
    throw new Error("Visit ID is required.");
  }

  if (!diagnosisCodeId && !diagnosisText) {
    throw new Error("Diagnosis code or diagnosis text is required.");
  }

  if (!isValidDiagnosisType(diagnosisTypeRaw)) {
    throw new Error("Invalid diagnosis type.");
  }

  const visit = await getExistingVisit(visitId);
  assertVisitCanHaveSoap(visit.status);

  const existingSoap = await prisma.soapNote.findFirst({
    where: {
      visitId,
      deletedAt: null,
    },
  });

  if (existingSoap) {
    assertSoapCanBeChanged(existingSoap.status);
  }

  const existingDuplicate = await prisma.visitDiagnosis.findFirst({
    where: {
      visitId,
      deletedAt: null,
      diagnosisType: diagnosisTypeRaw,
      ...(diagnosisCodeId
        ? { diagnosisCodeId }
        : { diagnosisText: { equals: diagnosisText ?? "", mode: "insensitive" } }),
    },
    select: { visitDiagnosisId: true },
  });

  if (existingDuplicate) {
    throw new Error("This diagnosis already exists for this visit.");
  }

  const diagnosisCode = diagnosisCodeId
    ? await prisma.diagnosisCode.findFirst({
        where: {
          diagnosisCodeId,
          activeFlag: true,
          deletedAt: null,
        },
        select: {
          diagnosisCodeId: true,
          code: true,
          nameEn: true,
          nameTh: true,
        },
      })
    : null;

  if (diagnosisCodeId && !diagnosisCode) {
    throw new Error("Diagnosis code not found.");
  }

  const diagnosisLabel =
    diagnosisText ||
    diagnosisCode?.nameTh ||
    diagnosisCode?.nameEn ||
    diagnosisCode?.code ||
    null;

  const diagnosis = await prisma.$transaction(async (tx) => {
    const createdDiagnosis = await tx.visitDiagnosis.create({
      data: {
        visitId,
        diagnosisCodeId,
        diagnosisText,
        diagnosisType: diagnosisTypeRaw,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    if (diagnosisLabel && existingSoap && !existingSoap.diagnosisSummary) {
      await tx.soapNote.update({
        where: { soapNoteId: existingSoap.soapNoteId },
        data: {
          diagnosisSummary: diagnosisLabel,
          updatedByUserId: currentUser.userId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "CREATE_VISIT_DIAGNOSIS",
        entityName: "VisitDiagnosis",
        entityId: createdDiagnosis.visitDiagnosisId,
        newValue: {
          ...buildDiagnosisAuditValue(createdDiagnosis),
          diagnosisLabel,
        },
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return createdDiagnosis;
  });

  revalidateSoapPaths(visitId, existingSoap?.soapNoteId ?? null);

  return diagnosis;
}

export async function removeVisitDiagnosis(formData: FormData) {
  const currentUser = await requirePermission("soap", "diagnosis");

  const visitDiagnosisId = requiredString(formData.get("visitDiagnosisId"));

  if (!visitDiagnosisId) {
    throw new Error("Visit Diagnosis ID is required.");
  }

  const existingDiagnosis = await prisma.visitDiagnosis.findUnique({
    where: {
      visitDiagnosisId,
    },
  });

  if (!existingDiagnosis || existingDiagnosis.deletedAt) {
    throw new Error("Visit diagnosis not found.");
  }

  const visit = await getExistingVisit(existingDiagnosis.visitId);
  assertVisitCanHaveSoap(visit.status);

  const existingSoap = await prisma.soapNote.findFirst({
    where: {
      visitId: existingDiagnosis.visitId,
      deletedAt: null,
    },
  });

  if (existingSoap) {
    assertSoapCanBeChanged(existingSoap.status);
  }

  const deletedDiagnosis = await prisma.$transaction(async (tx) => {
    const result = await tx.visitDiagnosis.update({
      where: {
        visitDiagnosisId,
      },
      data: {
        deletedAt: new Date(),
        updatedByUserId: currentUser.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: "DELETE_VISIT_DIAGNOSIS",
        entityName: "VisitDiagnosis",
        entityId: visitDiagnosisId,
        oldValue: buildDiagnosisAuditValue(existingDiagnosis),
        newValue: buildDiagnosisAuditValue(result),
        ipAddress: null,
        createdByUserId: currentUser.userId,
        updatedByUserId: currentUser.userId,
      },
    });

    return result;
  });

  revalidateSoapPaths(deletedDiagnosis.visitId, existingSoap?.soapNoteId ?? null);

  return deletedDiagnosis;
}
