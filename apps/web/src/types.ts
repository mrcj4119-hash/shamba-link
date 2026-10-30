export type UserRole = "farmer" | "agrovet" | "expert" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  locationRegion: string;
  preferredLanguage: "en" | "sw";
  createdAt: string;
}

export interface AdminUser extends User {
  isActive: boolean;
}

export interface KnowledgeGuide {
  id: string;
  slug: string;
  category: "crop" | "pest" | "disease" | "soil" | "livestock" | "prevention";
  titleEn: string;
  titleSw: string;
  summaryEn: string;
  summarySw: string;
  bodyEn: string;
  bodySw: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCropCase {
  id: string;
  reference: string;
  farmerId: string;
  farmerName: string;
  farmerEmail: string;
  farmerRegion: string;
  caseType: "crop" | "livestock";
  subjectName: string;
  cropType: string;
  symptoms: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CropField {
  id: string;
  farmId: string;
  name: string;
  cropType: string;
  plantingDate: string | null;
  soilType: string;
  irrigationMethod: string;
  createdAt: string;
}

export interface Farm {
  id: string;
  farmerId: string;
  name: string;
  county: string;
  locationDescription: string;
  sizeAcres: number | null;
  createdAt: string;
  fields: CropField[];
}

export interface FarmInputRecord {
  id: string;
  farmerId: string;
  farmId: string | null;
  productName: string;
  intendedUse: string;
  purchaseDate: string | null;
  seller: string;
  batchNumber: string;
  applicationDate: string | null;
  instructionsFollowed: string;
  observedResults: string;
  complaintDetails: string;
  complaintStatus: "none" | "submitted_pending_review";
  createdAt: string;
}

export interface SoilAssessment {
  id: string;
  farmId: string | null;
  fieldId: string | null;
  cropType: string;
  plotSizeAcres: number | null;
  testedOn: string | null;
  ph: number | null;
  nitrogenResult: string;
  phosphorusResult: string;
  potassiumResult: string;
  resultUnits: string;
  labName: string;
  notes: string;
  createdAt: string;
}

export type FarmTaskType = "weeding" | "top_dressing" | "scouting" | "irrigation" | "planting" | "harvest" | "other";

export interface FarmCalendarTask {
  id: string;
  farmId: string | null;
  fieldId: string | null;
  cropType: string;
  taskType: FarmTaskType;
  title: string;
  dueOn: string;
  notes: string;
  completedAt: string | null;
  createdAt: string;
}

export interface HarvestRecord {
  id: string;
  farmId: string | null;
  fieldId: string | null;
  cropType: string;
  harvestedOn: string;
  quantity: number;
  unit: string;
  plotSizeAcres: number | null;
  season: string;
  notes: string;
  createdAt: string;
}

export interface FarmWeatherDay {
  date: string;
  condition: string;
  maximumC: number;
  minimumC: number;
  precipitationProbability: number | null;
  precipitationMm: number;
  alerts: string[];
}

export interface FarmWeather {
  location: string;
  locationBasis: "nearest_town" | "county_search";
  provider: string;
  updatedAt: string;
  days: FarmWeatherDay[];
}

export type CaseStatus =
  | "reported"
  | "under_review"
  | "action_required"
  | "follow_up_due"
  | "improving"
  | "referred_to_expert"
  | "closed";

export interface CropCaseEvent {
  id: string;
  type: "reported" | "action" | "follow_up" | "observation" | "expert_request" | "status_change" | "photo" | "video" | "audio";
  notes: string;
  outcome: "improved" | "unchanged" | "worsened" | null;
  imageUrl: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  followUpOn: string | null;
  createdAt: string;
}

export interface CropCase {
  id: string;
  reference: string;
  farmerId: string;
  caseType: "crop" | "livestock";
  subjectName: string;
  farmId: string | null;
  fieldId: string | null;
  cropType: string;
  symptoms: string;
  startedOn: string | null;
  spreadRate: "slow" | "steady" | "rapid" | "unknown";
  affectedPortion: string;
  contextNotes: string;
  status: CaseStatus;
  followUpOn: string | null;
  latestOutcome: "improved" | "unchanged" | "worsened" | null;
  guidance: string;
  aiAssessment: CropAdvice | null;
  aiAssessmentStatus: "available" | "unavailable" | "not_configured" | "not_requested";
  createdAt: string;
  updatedAt: string;
  events: CropCaseEvent[];
}

export interface CropAdvice {
  likelyIssue: string;
  confidenceScore: number;
  urgency: "routine" | "prompt" | "urgent";
  immediateActions: string[];
  avoidActions: string[];
  questionsForAgrovet: string[];
  recommendedProductTypes: string[];
  requiresExpertReview: boolean;
}

export interface RecommendedAgrovet {
  id: string;
  name: string;
  phone: string;
  locationRegion: string;
  products: { id: string; name: string; category: string; description: string }[];
}

export interface Diagnosis {
  id: string;
  farmerId: string;
  imageUrl: string;
  videoUrl?: string | null;
  detectedDisease: string;
  confidenceScore: number;
  severityLevel: "low" | "moderate" | "high" | "critical" | "unknown";
  treatmentRecommendations: string;
  preventiveMeasures: string;
  requiresExpertReview?: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  vendorId: string;
  vendorName?: string;
  vendorRegion?: string;
  name: string;
  category: string;
  price: string;
  stockQuantity: number;
  description: string;
  imageUrl: string;
  createdAt: string;
}

export interface Expert {
  id: string;
  name: string;
  locationRegion: string;
  expertise: string | null;
  serviceRadiusKm: number | null;
  consultationRateKes: number | null;
}

export interface ExpertProfile {
  licenseNumber: string;
  expertise: string;
  licenseDocumentUrl: string;
  goodConductDocumentUrl: string;
  experienceYears: number;
  available: boolean;
  serviceRadiusKm: number;
  consultationRateKes: number;
  verificationStatus: "pending" | "verified" | "rejected";
  reviewNote: string;
  updatedAt: string;
}

export interface ExpertVerificationRecord extends ExpertProfile {
  userId: string;
  name: string;
  email: string;
  phone: string;
  locationRegion: string;
}

export interface Consultation {
  id: string;
  farmerId: string;
  expertId: string;
  diagnosisId: string | null;
  status: "pending" | "completed" | "cancelled";
  scheduledTime: string;
  notes: string;
  createdAt: string;
}

export interface Order {
  id: string;
  farmerId: string;
  vendorId: string;
  totalAmount: string;
  status: "pending" | "processing" | "delivered";
  createdAt: string;
}

export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}
