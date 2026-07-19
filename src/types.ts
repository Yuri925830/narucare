export type View =
  | "agent"
  | "card"
  | "hospitals"
  | "visit-flow"
  | "navigation"
  | "translation"
  | "companions-notice"
  | "companions-filter"
  | "companions"
  | "companion-detail"
  | "companion-chat"
  | "companion-waiting"
  | "companion-payment"
  | "companion-arrived"
  | "companion-service"
  | "companion-finished"
  | "companion-orders"
  | "emergency-confirm"
  | "emergency-calling"
  | "profile"
  | "records"
  | "language";

export interface MedicalCard {
  name: string;
  nationality: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  age: string;
  gender: string;
  documentType: string;
  documentNumber: string;
  insurance: string;
  conditions: string;
  medications: string;
  surgeries: string;
  symptoms: string;
  notes: string;
  language: string;
  korean?: Record<string, string>;
}

export interface SessionUser {
  id: string;
  card: MedicalCard | null;
}

export interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface MedicalEvidenceSource {
  title: string;
  url: string;
  year?: string;
}

export interface ChatResponse {
  reply: string;
  intent: "emergency" | "hospital" | "recovery" | "card" | "flow" | "translation" | "companion" | "education" | "general";
  symptoms?: string;
  symptomStatus?: "none" | "new" | "ongoing" | "improving" | "resolved" | "unknown";
  sources?: MedicalEvidenceSource[];
}

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
  type: string;
  address?: string;
  openingHours?: string;
  openNow?: boolean;
  emergency?: boolean;
  reservation?: "required" | "recommended" | "not_required" | "unknown";
  phone?: string;
  website?: string;
  dataSource?: string;
  sourceUrl?: string;
  lastVerified?: string;
  officialInstitutionType?: string;
  officialDoctorCount?: number;
  officialSpecialties?: string[];
  officialSpecialistCount?: number;
  officialEquipment?: string[];
  officialSpecialCare?: string[];
}

export interface Companion {
  id: string;
  name: string;
  nativeName: string;
  gender: "female" | "male";
  nationality: string;
  age: number;
  languages: string[];
  rating: number;
  reviewCount: number;
  price: number;
  eta: number;
  hospitals: string[];
  experience: string;
  match?: number;
  phone?: string;
}

export interface CompanionFilters {
  gender: string;
  nationality: string;
  age: string;
  eta: string;
  languages: string[];
  rating: string;
  minPrice: number;
  maxPrice: number;
}

export interface LocationState {
  lat: number;
  lng: number;
  address: string;
  verified: boolean;
  accuracy?: number;
  timestamp?: number;
}

export interface VisitRecord {
  id: string;
  hospital: string;
  department: string;
  symptoms: string;
  date: string;
  status: string;
  details?: VisitRecordDetails;
}

export interface TranslationRecordEntry {
  speaker: "patient" | "staff";
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: string;
}

export interface VisitRecordDetails {
  translations?: TranslationRecordEntry[];
  companion?: {
    orderId: string;
    name: string;
    status: CompanionOrder["status"];
    durationMinutes: number;
    hospital: string;
  };
  fees?: {
    currency: "KRW";
    serviceTotal: number;
    depositPaid: number;
    balancePaid: number;
    balanceDue: number;
    paymentMethod: string;
    status: "unpaid" | "deposit_paid" | "paid";
  };
}

export interface CompanionOrder {
  id: string;
  companion: Companion;
  hospital: Hospital | null;
  status: "requested" | "accepted" | "deposit_paid" | "arrived" | "in_service" | "completed" | "cancelled";
  durationMinutes: number;
  serviceStartedAt?: string;
  actualDurationMinutes?: number;
  deposit: number;
  paymentMethod: string;
  balancePaid?: boolean;
  createdAt?: string;
  updatedAt?: string;
  rating?: number | null;
  review?: string;
}
