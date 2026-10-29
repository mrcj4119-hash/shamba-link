import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CalendarDays, Camera, CheckCircle2, ClipboardList, CloudSun,
  FileImage, FlaskConical, Flower2, Languages, Leaf, MapPin, Phone, Plus, ShieldCheck,
  Sprout, Stethoscope, Wheat,
} from "lucide-react";
import { ApiError, api, imageUrl } from "./api";
import { useAuth } from "./auth";
import type { CaseStatus, CropCase, Farm, FarmInputRecord, RecommendedAgrovet } from "./types";
import "./farmer-workspace.css";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "We couldn't save this. Check your connection and try again.";
}

const statusLabels: Record<CaseStatus, string> = {
  reported: "Reported",
  under_review: "Under review",
  action_required: "Action required",
  follow_up_due: "Follow-up due",
  improving: "Improving (farmer observed)",
  referred_to_expert: "Referred to expert",
  closed: "Closed",
};

function googleMapsSearch(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function useFarmerRecords() {
  const { token } = useAuth();
  const farms = useQuery({
    queryKey: ["farms"],
    queryFn: () => api<{ data: Farm[] }>("/api/farms", {}, token),
  });
  const cases = useQuery({
    queryKey: ["crop-cases"],
    queryFn: () => api<{ data: CropCase[] }>("/api/cases", {}, token),
  });
  return { farms, cases };
}

function SectionTitle({ eyebrow, title, detail, action }: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return <div className="farmer-section-title"><div><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>{action}</div>;
}

function RecordsError({ error }: { error: unknown }) {
  return <p className="farmer-error" role="alert">{errorMessage(error)}</p>;
}

export function FarmerDashboard() {
  const { user, token } = useAuth();
  const { farms, cases } = useFarmerRecords();
  const [language, setLanguage] = useState<"en" | "sw">(user?.preferredLanguage ?? "en");
  const [languageError, setLanguageError] = useState("");
  const saveLanguage = useMutation({
    mutationFn: (preferredLanguage: "en" | "sw") =>
      api("/api/farmer/profile", { method: "PATCH", body: JSON.stringify({ preferredLanguage }) }, token),
    onSuccess: () => setLanguageError(""),
    onError: (error) => setLanguageError(errorMessage(error)),
  });
  const activeCases = cases.data?.data.filter((item) => item.status !== "closed") ?? [];
  const dueCases = activeCases.filter((item) =>
    item.followUpOn && item.followUpOn <= new Date().toISOString().slice(0, 10));
  const firstName = user?.name.trim().split(/\s+/)[0] ?? "";
  const sw = language === "sw";

  return <div className="farmer-workspace">
    <section className="farmer-welcome">
      <div><span className="farmer-eyebrow"><Sprout size={15} /> SHAMBA LINK · {sw ? "SHAMBA YAKO" : "YOUR FARM SPACE"}</span>
        <h1>{sw ? `Karibu, ${firstName}` : `Welcome, ${firstName}`}</h1>
        <p>{sw ? "Rekodi ya shamba lako, hatua moja kwa wakati." : "Your farm record, next steps and crop recovery progress — all in one place."}</p>
        <div className="farmer-welcome-actions">
          <Link className="button button-dark" to="/app/cases?new=1"><Camera size={17} />{sw ? "Ripoti tatizo la zao au mnyama" : "Report a Crop or Animal Problem"}</Link>
          <Link className="button button-light" to="/app/farms"><Wheat size={17} />{sw ? "Mashamba yangu" : "My farms & crops"}</Link>
        </div>
      </div>
      <label className="farmer-language"><Languages size={17} /><span>{sw ? "Lugha" : "Language"}</span>
        <select aria-label="Choose language" value={language} disabled={saveLanguage.isPending} onChange={(event) => {
          const next = event.target.value as "en" | "sw";
          setLanguage(next);
          saveLanguage.mutate(next);
        }}><option value="en">English</option><option value="sw">Kiswahili</option></select>
      </label>
    </section>
    {languageError && <RecordsError error={languageError} />}

    <section className="farmer-stat-grid">
      <article><span><Wheat size={18} /></span><small>{sw ? "Mashamba" : "Registered farms"}</small><strong>{farms.data?.data.length ?? "—"}</strong></article>
      <article><span><Flower2 size={18} /></span><small>{sw ? "Mashamba ya mazao" : "Crop passports"}</small><strong>{farms.data?.data.reduce((sum, farm) => sum + farm.fields.length, 0) ?? "—"}</strong></article>
      <article><span><ClipboardList size={18} /></span><small>{sw ? "Matatizo yanayoendelea" : "Active recovery cases"}</small><strong>{activeCases.length}</strong></article>
      <article><span><CalendarDays size={18} /></span><small>{sw ? "Ufuatiliaji unaohitajika" : "Follow-ups due"}</small><strong>{dueCases.length}</strong></article>
    </section>

    <section className="farmer-primary-grid">
      <Link className="farmer-feature-card farmer-feature-report" to="/app/cases?new=1">
        <span className="farmer-feature-icon"><Camera size={21} /></span><span className="farmer-feature-copy">
          <small>01 · {sw ? "USAIDIZI WA SHAMBA" : "CROP & ANIMAL SUPPORT"}</small>
          <strong>{sw ? "Ripoti tatizo la zao au mnyama" : "Report a Crop or Animal Problem"}</strong>
          <span>{sw ? "Eleza dalili na uweke picha kwa mwongozo wa AI na ufuatiliaji." : "Describe crop or animal symptoms, add a photo, and request cautious AI guidance."}</span>
        </span><span className="farmer-feature-open">+</span>
      </Link>
      <Link className="farmer-feature-card" to="/app/cases">
        <span className="farmer-feature-icon"><ShieldCheck size={21} /></span><span className="farmer-feature-copy">
          <small>02 · {sw ? "UFUATILIAJI" : "PROOF-TO-RECOVERY"}</small>
          <strong>{sw ? "Kesi za ufuatiliaji" : "My Active Recovery Cases"}</strong>
          <span>{sw ? "Rekodi hatua, picha na matokeo unayoyaona." : "Log actions, follow-up photos, and the outcomes you observe."}</span>
        </span><span className="farmer-feature-count">{activeCases.length}</span>
      </Link>
      <article className="farmer-feature-card farmer-today-card">
        <span className="farmer-feature-icon"><CheckCircle2 size={21} /></span><span className="farmer-feature-copy">
          <small>03 · {sw ? "HATUA INAYOFUATA" : "NEXT STEP"}</small>
          <strong>{sw ? "Nifanye nini leo?" : "What Should I Do Today?"}</strong>
          {dueCases.length
            ? <span>{dueCases.length} case follow-up{dueCases.length === 1 ? "" : "s"} due. Record what you observe, even if nothing has changed.</span>
            : <span>{activeCases.length ? "No follow-up is due today. Keep your next check-in date up to date." : "Add a farm or report a concern to build your personal farm action list."}</span>}
        </span>
        {dueCases.length > 0 && <Link className="farmer-today-link" to="/app/cases">Review due cases</Link>}
      </article>
    </section>

    <section className="farmer-secondary-grid">
      <Link className="farmer-service-card" to="/app/consultations"><Stethoscope size={20} /><strong>{sw ? "Uliza mtaalamu wa kilimo" : "Ask an Agricultural Expert"}</strong><span>Submit a consultation request. Replies and availability are not guaranteed by this demo service.</span></Link>
      <Link className="farmer-service-card" to="/app/planning"><CloudSun size={20} /><strong>{sw ? "Hali ya hewa ya eneo" : "Local Weather & Alerts"}</strong><span>See an approximate seven-day forecast for a registered farm, with practical weather-based scouting prompts.</span></Link>
      <Link className="farmer-service-card" to="/app/planning"><Leaf size={20} /><strong>{sw ? "Mpangilio wa udongo na mazao" : "Soil Health & Crop Planner"}</strong><span>Save soil-test results, plan farm reminders, and record harvest quantities and seasonal results.</span></Link>
      <Link className="farmer-service-card" to="/app/inputs"><ClipboardList size={20} /><strong>{sw ? "Rekodi za pembejeo" : "Farm Input Journal"}</strong><span>Record products, application dates, batch details, and product concerns for your own records.</span></Link>
    </section>

    <section className="farmer-data-section">
      <SectionTitle eyebrow="YOUR FARM PASSPORTS" title={sw ? "Mashamba na mazao yangu" : "My Farms and Crops"}
        detail={farms.data?.data.length ? "Your registered farm and crop records." : "Register a farm and crop field to start your digital passport."}
        action={<Link className="farmer-inline-link" to="/app/farms">Manage farms</Link>} />
      {farms.isError ? <RecordsError error={farms.error} /> : farms.isLoading ? <p className="farmer-muted">Loading your farm records…</p> : farms.data?.data.length
        ? <div className="farmer-farm-preview">{farms.data.data.slice(0, 3).map((farm) => <article key={farm.id}><span><MapPin size={16} /></span><div><strong>{farm.name}</strong><small>{farm.county}{farm.sizeAcres ? ` · ${farm.sizeAcres} acres` : ""} · {farm.fields.length} crop passport{farm.fields.length === 1 ? "" : "s"}</small></div></article>)}</div>
        : <p className="farmer-empty-inline">No farms recorded yet. Add your first farm and crops.</p>}
    </section>

    <section className="farmer-data-section">
      <SectionTitle eyebrow="PROOF-TO-RECOVERY" title={sw ? "Kesi za ufuatiliaji zinazoendelea" : "My Active Recovery Cases"}
        detail="Cases stay open until you record an outcome and choose to close them."
        action={<Link className="farmer-inline-link" to="/app/cases">Open case tracker</Link>} />
      {cases.isError ? <RecordsError error={cases.error} /> : cases.isLoading ? <p className="farmer-muted">Loading farm-health reports…</p> : activeCases.length
        ? <div className="farmer-case-preview">{activeCases.slice(0, 4).map((item) => <Link key={item.id} to="/app/cases" className="farmer-case-row"><span><AlertTriangle size={17} /></span><div><strong>{item.subjectName} · {item.reference}</strong><small>{item.caseType === "livestock" ? "Animal" : "Crop"} · {item.symptoms}</small></div><StatusBadge status={item.status} /></Link>)}</div>
        : <p className="farmer-empty-inline">No open reports. Report a crop or animal concern to start tracking guidance and evidence.</p>}
    </section>
    <p className="farmer-privacy-note"><ShieldCheck size={15} /> Your farm records are private to your account. This app does not collect precise GPS coordinates.</p>
  </div>;
}

export function FarmerFarmsPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const { farms } = useFarmerRecords();
  const [error, setError] = useState("");
  const createFarm = useMutation({
    mutationFn: (input: unknown) => api<{ data: Farm }>("/api/farms", { method: "POST", body: JSON.stringify(input) }, token),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["farms"] });
      setError("");
    },
    onError: (cause) => setError(errorMessage(cause)),
  });
  const updateField = useMutation({
    mutationFn: ({ fieldId, input }: { fieldId: string; input: unknown }) =>
      api(`/api/fields/${fieldId}`, { method: "PATCH", body: JSON.stringify(input) }, token),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["farms"] });
      setError("");
    },
    onError: (cause) => setError(errorMessage(cause)),
  });
  const createField = useMutation({
    mutationFn: ({ farmId, input }: { farmId: string; input: unknown }) =>
      api(`/api/farms/${farmId}/fields`, { method: "POST", body: JSON.stringify(input) }, token),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["farms"] });
      setError("");
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  function submitFarm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const size = String(form.get("sizeAcres") ?? "");
    createFarm.mutate({
      name: form.get("name"), county: form.get("county"),
      locationDescription: form.get("locationDescription"),
      ...(size ? { sizeAcres: Number(size) } : {}),
    });
    event.currentTarget.reset();
  }

  function submitField(event: FormEvent<HTMLFormElement>, farmId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const plantingDate = String(form.get("plantingDate") ?? "");
    createField.mutate({
      farmId,
      input: {
        name: form.get("name"), cropType: form.get("cropType"),
        soilType: form.get("soilType"), irrigationMethod: form.get("irrigationMethod"),
        ...(plantingDate ? { plantingDate } : {}),
      },
    });
    event.currentTarget.reset();
  }

  function submitFieldUpdate(event: FormEvent<HTMLFormElement>, fieldId: string) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const plantingDate = String(values.get("plantingDate") ?? "");
    updateField.mutate({
      fieldId,
      input: {
        name: values.get("name"), cropType: values.get("cropType"),
        soilType: values.get("soilType"), irrigationMethod: values.get("irrigationMethod"),
        ...(plantingDate ? { plantingDate } : {}),
      },
    });
  }

  return <div className="farmer-workspace">
    <SectionTitle eyebrow="PRIVATE TO YOUR ACCOUNT" title="My Farms and Crop Passports"
      detail="Create a record for each farm and a Smart Farm Passport for every crop field. You can update the crop and planting date as seasons change." />
    <div className="farmer-privacy-banner"><ShieldCheck size={19} /><span><strong>Location privacy</strong> We store your county and optional general location description only. This form does not request GPS coordinates.</span></div>
    <form className="farmer-form-card" onSubmit={submitFarm}>
      <div className="farmer-form-title"><Plus size={18} /><div><strong>Register a farm</strong><span>Farm size is optional; use acres if known.</span></div></div>
      <div className="farmer-form-grid">
        <label>Farm name<input name="name" required minLength={2} maxLength={100} placeholder="e.g. Home farm" /></label>
        <label>County<input name="county" required minLength={2} maxLength={100} defaultValue="" placeholder="e.g. Kiambu" /></label>
        <label>General location (optional)<input name="locationDescription" maxLength={200} placeholder="Nearest town or area; no exact address" /></label>
        <label>Farm size in acres (optional)<input name="sizeAcres" type="number" min="0.01" step="0.01" /></label>
      </div>
      {error && <RecordsError error={error} />}
      <button className="button button-dark" disabled={createFarm.isPending}>{createFarm.isPending ? "Saving farm…" : "Save farm"}</button>
    </form>
    {farms.isError && <RecordsError error={farms.error} />}
    {farms.isLoading ? <p className="farmer-muted">Loading farm records…</p> : farms.data?.data.map((farm) => <article className="farmer-farm-card" key={farm.id}>
      <div className="farmer-farm-heading"><span><Wheat size={20} /></span><div><h2>{farm.name}</h2><p>{farm.county}{farm.locationDescription ? ` · ${farm.locationDescription}` : ""}{farm.sizeAcres ? ` · ${farm.sizeAcres} acres` : ""}</p></div></div>
      <div className="farmer-passport-list">{farm.fields.length ? farm.fields.map((field) => <article key={field.id}>
        <span className="farmer-passport-icon"><Flower2 size={17} /></span><div><strong>{field.name} · {field.cropType}</strong><small>{field.plantingDate ? `Planted ${new Date(`${field.plantingDate}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}` : "Planting date not recorded"} · {field.soilType || "Soil unknown"} · {field.irrigationMethod || "Irrigation not recorded"}</small></div><span className="farmer-passport-tag">SMART FARM PASSPORT</span>
        <details className="farmer-edit-passport"><summary>Edit</summary><form className="farmer-form-grid" onSubmit={(event) => submitFieldUpdate(event, field.id)}>
          <label>Field name<input name="name" required minLength={2} defaultValue={field.name} /></label>
          <label>Crop grown<input name="cropType" required minLength={2} defaultValue={field.cropType} /></label>
          <label>Planting date<input name="plantingDate" type="date" defaultValue={field.plantingDate ?? ""} /></label>
          <label>Soil type<input name="soilType" defaultValue={field.soilType} /></label>
          <label>Irrigation method<input name="irrigationMethod" defaultValue={field.irrigationMethod} /></label>
          <button className="button button-soft" disabled={updateField.isPending}>Update passport</button>
        </form></details>
      </article>) : <p className="farmer-empty-inline">No crop passports on this farm yet.</p>}</div>
      <details className="farmer-add-field"><summary><Plus size={16} /> Add a crop passport</summary>
        <form className="farmer-form-grid" onSubmit={(event) => submitField(event, farm.id)}>
          <label>Field name<input name="name" required minLength={2} placeholder="e.g. North field" /></label>
          <label>Crop grown<input name="cropType" required minLength={2} placeholder="e.g. Maize" /></label>
          <label>Planting date (optional)<input name="plantingDate" type="date" /></label>
          <label>Soil type (optional)<input name="soilType" placeholder="If known" /></label>
          <label>Irrigation method (optional)<input name="irrigationMethod" placeholder="e.g. Rain-fed" /></label>
          <button className="button button-soft" disabled={createField.isPending}>Save crop passport</button>
        </form>
      </details>
    </article>)}
    {!farms.isLoading && farms.data?.data.length === 0 && <div className="farmer-empty-panel"><Wheat size={23} /><strong>Your first farm is ready to be recorded</strong><span>Start with its name and county. You can add crop fields next.</span></div>}
  </div>;
}

export function FarmerCasesPage() {
  const { user, token } = useAuth();
  const client = useQueryClient();
  const { farms, cases } = useFarmerRecords();
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [allowAi, setAllowAi] = useState(false);
  const [caseType, setCaseType] = useState<"crop" | "livestock">("crop");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const photoCameraInput = useRef<HTMLInputElement>(null);
  const photoBrowseInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const recordingTimeout = useRef<number | null>(null);
  const recordingInterval = useRef<number | null>(null);
  const selectedCase = cases.data?.data.find((item) => item.id === selectedId) ?? cases.data?.data[0];
  const agrovets = useQuery({
    queryKey: [
      "case-agrovets",
      selectedCase?.id,
      selectedCase?.aiAssessmentStatus,
      selectedCase?.aiAssessment?.recommendedProductTypes,
    ],
    queryFn: () => api<{ data: RecommendedAgrovet[] }>(`/api/cases/${selectedCase!.id}/agrovets`, {}, token),
    enabled: Boolean(selectedCase) && selectedCase?.caseType === "crop",
  });

  const createCase = useMutation({
    mutationFn: (body: FormData) =>
      api<{ data: CropCase }>("/api/cases", { method: "POST", body }, token),
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setError("");
      setPhotoFile(null);
      setPhotoPreview("");
      setVideoFile(null);
      setVideoPreview("");
      await client.invalidateQueries({ queryKey: ["crop-cases"] });
      await client.invalidateQueries({ queryKey: ["case-agrovets", result.data.id] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });
  const addEvent = useMutation({
    mutationFn: ({ caseId, body }: { caseId: string; body: FormData }) =>
      api<{ data: CropCase }>(`/api/cases/${caseId}/events`, { method: "POST", body }, token),
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setError("");
      await client.invalidateQueries({ queryKey: ["crop-cases"] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });
  const closeCase = useMutation({
    mutationFn: ({ caseId, notes }: { caseId: string; notes: string }) =>
      api<{ data: CropCase }>(`/api/cases/${caseId}/status`, {
        method: "PATCH", body: JSON.stringify({ status: "closed", notes }),
      }, token),
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setError("");
      await client.invalidateQueries({ queryKey: ["crop-cases"] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });
  const requestAiAdvice = useMutation({
    mutationFn: (caseId: string) => api<{ data: CropCase }>(`/api/cases/${caseId}/ai-assessment`, {
      method: "POST",
      body: JSON.stringify({ consent: true }),
    }, token),
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setError("");
      await client.invalidateQueries({ queryKey: ["crop-cases"] });
      await client.invalidateQueries({ queryKey: ["case-agrovets", result.data.id] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  useEffect(() => {
    if (!photoPreview) return undefined;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  useEffect(() => {
    if (!videoPreview) return undefined;
    return () => URL.revokeObjectURL(videoPreview);
  }, [videoPreview]);

  useEffect(() => () => {
    if (recordingTimeout.current !== null) window.clearTimeout(recordingTimeout.current);
    if (recordingInterval.current !== null) window.clearInterval(recordingInterval.current);
    if (recorder.current?.state === "recording") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    cameraStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 8 * 1024 * 1024) {
      setError("Choose a JPEG, PNG or WebP photo smaller than 8 MB.");
      return;
    }
    setPhotoFile(selected);
    setPhotoPreview(URL.createObjectURL(selected));
    setError("");
  }

  async function startVideoRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Video recording is not supported in this browser. Try a recent browser or device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } });
      cameraStream.current = stream;
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const activeRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.current = activeRecorder;
      const chunks: BlobPart[] = [];
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      activeRecorder.onstop = () => {
        const type = activeRecorder.mimeType.startsWith("video/mp4") ? "video/mp4" : "video/webm";
        const extension = type === "video/mp4" ? "mp4" : "webm";
        const clip = new File(chunks, `farm-video.${extension}`, { type, lastModified: Date.now() });
        if (clip.size === 0) {
          setVideoFile(null);
          setVideoPreview("");
          setError("No video was captured. Please try recording again.");
        } else if (clip.size > 50 * 1024 * 1024) {
          setVideoFile(null);
          setVideoPreview("");
          setError("The video is larger than 50 MB. Record a shorter clip and try again.");
        } else {
          setVideoFile(clip);
          setVideoPreview(URL.createObjectURL(clip));
        }
        stream.getTracks().forEach((track) => track.stop());
        cameraStream.current = null;
        if (recordingTimeout.current !== null) window.clearTimeout(recordingTimeout.current);
        if (recordingInterval.current !== null) window.clearInterval(recordingInterval.current);
        setRecording(false);
      };
      setVideoFile(null);
      setVideoPreview("");
      setRecordingSeconds(0);
      activeRecorder.start();
      setRecording(true);
      const startedAt = Date.now();
      recordingInterval.current = window.setInterval(() => {
        setRecordingSeconds(Math.min(60, Math.floor((Date.now() - startedAt) / 1000)));
      }, 250);
      recordingTimeout.current = window.setTimeout(() => {
        if (activeRecorder.state === "recording") activeRecorder.stop();
      }, 60_000);
    } catch (cause) {
      cameraStream.current?.getTracks().forEach((track) => track.stop());
      cameraStream.current = null;
      setError(cause instanceof Error && cause.name === "NotAllowedError"
        ? "Allow camera access to record a farm video."
        : "We couldn't start the camera. Check your camera connection and try again.");
    }
  }

  function stopVideoRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setAllowAi(values.get("allowAi") === "true");
    const body = new FormData();
    for (const [key, value] of values.entries()) {
      if (typeof value === "string" && value.trim()) body.append(key, value);
    }
    if (photoFile) body.append("image", photoFile);
    if (videoFile) body.append("video", videoFile);
    createCase.mutate(body);
    form.reset();
    setAllowAi(false);
  }

  function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCase) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = new FormData();
    for (const [key, value] of values.entries()) {
      if (key === "image") {
        if (value instanceof File && value.size) body.append(key, value);
      } else if (typeof value === "string" && value.trim()) body.append(key, value);
    }
    addEvent.mutate({ caseId: selectedCase.id, body });
    form.reset();
  }

  function submitClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCase) return;
    const notes = String(new FormData(event.currentTarget).get("closeNotes") ?? "");
    closeCase.mutate({ caseId: selectedCase.id, notes });
    event.currentTarget.reset();
  }

  const activeCases = cases.data?.data.filter((item) => item.status !== "closed") ?? [];

  return <div className="farmer-workspace">
    <SectionTitle eyebrow="FARM HEALTH TRACKER" title="Crop & animal problem reports"
      detail="Get cautious AI guidance for crop or animal concerns, keep a timeline, and ask a qualified professional to confirm the cause and treatment."
      action={<Link className="farmer-inline-link" to="/app/farms">My farm passports</Link>} />
    <div className="farmer-privacy-banner"><ShieldCheck size={19} /><span><strong>Responsible guidance</strong> If you opt in, the configured AI provider reviews your report and optional photo for cautious next steps. AI suggestions are not confirmed diagnoses and do not prescribe medicines or chemicals. Animal reports receive cautious triage guidance; urgent animal symptoms need prompt veterinary care. Your optional farm video is saved as context and is not sent for AI analysis. Depending on the provider, report details may be processed by a cloud AI service. This advice is free. Do not include names, phone numbers or other personal details.</span></div>
    {error && <RecordsError error={error} />}
    <section className="farmer-report-card" id="new-crop-case">
      <div className="farmer-form-title"><Camera size={18} /><div><strong>Report a Crop or Animal Problem</strong><span>Choose what needs help. Opt in for cautious AI guidance, then ask a qualified professional to confirm the cause and treatment.</span></div></div>
      <form className="farmer-case-form" onSubmit={submitReport}>
        <label>What needs help?<select name="caseType" value={caseType} onChange={(event) => {
          setCaseType(event.currentTarget.value as "crop" | "livestock");
        }}><option value="crop">A crop</option><option value="livestock">An animal</option></select></label>
        <label>{caseType === "crop" ? "Crop type" : "Animal / species"}<input name="subjectName" required minLength={2} maxLength={100} placeholder={caseType === "crop" ? "e.g. Maize, tomato, beans" : "e.g. Dairy cow, chicken, goat"} /></label>
        <label>Farm (optional)<select name="farmId" defaultValue=""><option value="">Select a registered farm</option>{farms.data?.data.map((farm) => <option value={farm.id} key={farm.id}>{farm.name} · {farm.county}</option>)}</select></label>
        {caseType === "crop" && <label>Crop field / passport (optional)<select name="fieldId" defaultValue=""><option value="">Not linked to a field</option>{farms.data?.data.flatMap((farm) => farm.fields.map((field) => <option value={field.id} key={field.id}>{farm.name} · {field.name} · {field.cropType}</option>))}</select></label>}
        <label>When did it start? (optional)<input type="date" name="startedOn" /></label>
        <label className="farmer-field-wide">{caseType === "crop" ? "Describe visible symptoms" : "Describe the animal's symptoms or behaviour"}<textarea name="symptoms" required minLength={5} maxLength={2000} rows={3} placeholder={caseType === "crop" ? "What changed? Which leaves, stems, fruit or plants are affected?" : "What changed? Include appetite, movement, breathing, and when symptoms began if known."} /></label>
        <label>{caseType === "crop" ? "How quickly is it spreading?" : "How quickly is it changing?"}<select name="spreadRate" defaultValue="unknown"><option value="unknown">Not sure</option><option value="slow">Slowly</option><option value="steady">Steadily</option><option value="rapid">Rapidly</option></select></label>
        <label>{caseType === "crop" ? "Affected part of the farm" : "Affected animal(s)"}<input name="affectedPortion" maxLength={100} placeholder={caseType === "crop" ? "e.g. west side, about 5 rows" : "e.g. one calf, three hens"} /></label>
        <label className="farmer-field-wide">{caseType === "crop" ? "Weather, watering or farm-input details (optional)" : "Recent feed, exposure or other relevant details (optional)"}<textarea name="contextNotes" rows={2} maxLength={2000} placeholder={caseType === "crop" ? "Include dates or product labels if known. Don't mix or apply chemicals based on this form." : "Share recent changes or possible exposures. Do not include personal details."} /></label>
        <div className="farmer-field-wide farmer-media-picker">
          <strong><FileImage size={17} /> Add a {caseType === "crop" ? "crop" : "animal"} photo (optional)</strong>
          <div className="farmer-media-actions">
            <button type="button" className="button button-soft" onClick={() => photoCameraInput.current?.click()}>Take a photo</button>
            <button type="button" className="button button-light" onClick={() => photoBrowseInput.current?.click()}>Browse files</button>
          </div>
          <input ref={photoCameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={selectPhoto} hidden />
          <input ref={photoBrowseInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} hidden />
          {photoPreview && <div className="farmer-media-preview"><img src={photoPreview} alt="Selected crop photo preview" /><div><span>{photoFile?.name}</span><button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}>Remove photo</button></div></div>}
        </div>
        <div className="farmer-field-wide farmer-media-picker">
          <div className="farmer-video-heading"><strong>Optional {caseType === "crop" ? "farm" : "animal"} video</strong><small>Record up to one minute. Saved with your report, not analyzed by AI.</small></div>
          {!recording && !videoPreview && <button type="button" className="button button-light" onClick={startVideoRecording}>Record video</button>}
          {recording && <div className="farmer-media-actions"><span className="farmer-recording-time" aria-live="polite">{recordingSeconds}s / 60s</span><button type="button" className="button button-dark" onClick={stopVideoRecording}>Stop recording</button></div>}
          {videoPreview && <div className="farmer-media-preview"><video controls src={videoPreview}>Your browser cannot play this video.</video><button type="button" onClick={() => { setVideoFile(null); setVideoPreview(""); }}>Remove video</button></div>}
        </div>
        <label className="farmer-field-wide farmer-ai-consent"><input type="checkbox" name="allowAi" value="true" onChange={(event) => setAllowAi(event.currentTarget.checked)} /> Get immediate AI guidance: I agree to send this {caseType === "crop" ? "crop" : "animal"} report and optional photo to the configured AI provider. Guidance is not a confirmed diagnosis or a prescription. For animals, contact a veterinarian for urgent or worsening symptoms. Leave unchecked to save the report without AI.</label>
        <p className="farmer-field-wide farmer-privacy-note"><ShieldCheck size={15} /> Your report is private to you. Exact farm coordinates are not collected or shared.</p>
        <button className="button button-dark" disabled={createCase.isPending}>{createCase.isPending ? "Saving report…" : allowAi ? "Get AI guidance & save report" : "Save report without AI"}</button>
      </form>
    </section>

    <div className="farmer-case-layout">
      <section className="farmer-case-list">
        <SectionTitle eyebrow="YOUR REPORT JOURNAL" title={`Active reports · ${activeCases.length}`} detail="Select a crop or animal report to review its guidance and timeline." />
        {cases.isLoading ? <p className="farmer-muted">Loading your cases…</p> : cases.data?.data.length
          ? cases.data.data.map((item) => <button key={item.id} type="button" className={`farmer-case-select ${selectedCase?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}>
            <span><strong>{item.subjectName}</strong><small>{item.caseType === "livestock" ? "Animal" : "Crop"} · {item.reference}</small></span><StatusBadge status={item.status} />
          </button>)
          : <div className="farmer-empty-panel"><ClipboardList size={22} /><strong>No farm-health reports yet</strong><span>Crop and animal reports will appear here.</span></div>}
      </section>
      <section className="farmer-case-detail">
        {selectedCase ? <>
          <div className="farmer-case-detail-heading"><div><span className="farmer-eyebrow">{selectedCase.reference} · {selectedCase.caseType === "livestock" ? "ANIMAL" : "CROP"}</span><h2>{selectedCase.subjectName} problem</h2></div><StatusBadge status={selectedCase.status} /></div>
          <p className="farmer-case-symptoms">{selectedCase.symptoms}</p>
          <p className="farmer-case-caveat"><ShieldCheck size={16} /> {selectedCase.guidance}</p>
          <Link className="button button-soft farmer-expert-review-link" to="/app/consultations" state={{
            consultationNotes: [
              `Please review ${selectedCase.caseType === "livestock" ? "animal" : "crop"} problem case ${selectedCase.reference}.`,
              `${selectedCase.caseType === "livestock" ? "Animal" : "Crop"}: ${selectedCase.subjectName}.`,
              `Symptoms: ${selectedCase.symptoms}`,
              selectedCase.aiAssessment ? `AI-suggested concern (unconfirmed): ${selectedCase.aiAssessment.likelyIssue}` : "",
            ].filter(Boolean).join(" "),
          }}><Stethoscope size={16} /> Ask a {selectedCase.caseType === "livestock" ? "veterinary professional" : "crop expert"} to review this report</Link>
          {selectedCase.aiAssessmentStatus === "not_requested" && <p className="farmer-case-caveat" role="status"><AlertTriangle size={16} /> This case was saved without AI because consent was not selected. You can request advice now below; no payment is required.</p>}
          {selectedCase.aiAssessmentStatus === "not_configured" && <p className="farmer-case-caveat" role="status"><AlertTriangle size={16} /> Your crop case was saved, but the selected AI provider is not configured yet. Ask a qualified agricultural professional before applying treatments.</p>}
          {selectedCase.aiAssessmentStatus === "unavailable" && <p className="farmer-case-caveat" role="status"><AlertTriangle size={16} /> Your crop case was saved, but the AI assessment could not be completed. Try again later or ask an agricultural expert.</p>}
          {(selectedCase.aiAssessmentStatus === "not_requested" || selectedCase.aiAssessmentStatus === "unavailable") && <div className="farmer-ai-request">
            <p>Request guidance now by sending this report’s details to the configured AI provider. The saved photo will not be sent. The response is cautious and unverified; urgent animal symptoms need a veterinarian.</p>
            <button className="button button-dark" type="button" disabled={requestAiAdvice.isPending} onClick={() => {
              requestAiAdvice.mutate(selectedCase.id);
            }}>
              {requestAiAdvice.isPending ? <><span className="button-spinner" /> Getting guidance…</> : <><FlaskConical size={17} /> Send report & request free AI guidance</>}
            </button>
          </div>}
          {selectedCase.aiAssessment && <section className={`farmer-ai-advice farmer-ai-advice-${selectedCase.aiAssessment.urgency}`} aria-label={`AI ${selectedCase.caseType === "livestock" ? "animal" : "crop"} guidance`}>
            <div className="farmer-ai-heading"><div><span className="farmer-eyebrow">AI-SUGGESTED CONCERN · NOT A CONFIRMED DIAGNOSIS</span><h3>{selectedCase.aiAssessment.likelyIssue}</h3></div><span className={`farmer-status farmer-status-${selectedCase.aiAssessment.urgency}`} aria-label={`AI urgency: ${selectedCase.aiAssessment.urgency}`}>{selectedCase.aiAssessment.urgency} attention</span></div>
            <p className="farmer-ai-confidence">AI confidence estimate: {Math.round(selectedCase.aiAssessment.confidenceScore * 100)}% · Based on the {selectedCase.caseType === "livestock" ? "animal" : "crop"} details you shared. This response is not a diagnosis. {selectedCase.caseType === "livestock" ? "Contact a veterinarian to assess the animal and advise on treatment." : "Ask an agricultural expert to confirm the cause and advise on treatment."}</p>
            <strong>What to do now</strong><ul>{selectedCase.aiAssessment.immediateActions.map((action, index) => <li key={index}>{action}</li>)}</ul>
            {selectedCase.aiAssessment.avoidActions.length > 0 && <><strong>What to avoid</strong><ul>{selectedCase.aiAssessment.avoidActions.map((action, index) => <li key={index}>{action}</li>)}</ul></>}
            {selectedCase.aiAssessment.questionsForAgrovet.length > 0 && <><strong>{selectedCase.caseType === "livestock" ? "Ask a veterinarian" : "Ask an agrovet"}</strong><ul>{selectedCase.aiAssessment.questionsForAgrovet.map((question, index) => <li key={index}>{question}</li>)}</ul></>}
            {selectedCase.caseType === "crop" && selectedCase.aiAssessment.recommendedProductTypes.length > 0 && <p className="farmer-ai-product-note">Product or service categories to discuss with a qualified agrovet: {selectedCase.aiAssessment.recommendedProductTypes.join(", ")}. Ask them to verify the cause, product suitability, local approvals, label directions and precautions before use.</p>}
          </section>}
          <div className="farmer-ai-vendors"><div className="farmer-vendor-heading"><strong>{selectedCase.caseType === "livestock" ? `Veterinary care near ${user?.locationRegion ?? "you"}` : `Nearby agrovets in ${user?.locationRegion ?? "your region"}`}</strong>{user?.locationRegion && <a className="farmer-maps-link" href={googleMapsSearch(`${selectedCase.caseType === "livestock" ? "veterinarian" : "agrovet"} near ${user.locationRegion}`)} target="_blank" rel="noopener noreferrer">{selectedCase.caseType === "livestock" ? "Find veterinary care in Google Maps" : "Search nearby in Google Maps"}</a>}</div><p>{selectedCase.caseType === "livestock" ? "For urgent symptoms, contact a veterinarian directly. Map results are based on your saved region; verify availability and qualifications." : selectedCase.aiAssessment ? "Ranked by your region, available stock and how closely listed items match the suggested product types." : "These agrovets have in-stock listings in your saved region. Listings are not an endorsement of treatment efficacy."}</p>
            {agrovets.isLoading
              ? <p>Finding agrovets with in-stock items in {user?.locationRegion}…</p>
              : agrovets.isError
                ? <p role="alert">We couldn't load local agrovet listings. Browse the <Link to="/app/marketplace">marketplace</Link>.</p>
                : selectedCase.caseType === "livestock"
                  ? <p>AI guidance is not veterinary care. Please use the map to find a local veterinarian or animal-health professional.</p>
                  : agrovets.data?.data.length
                  ? agrovets.data.data.map((vendor) => <article key={vendor.id}><div><strong>{vendor.name}</strong><small>{vendor.locationRegion} · in-stock items: {vendor.products.map((product) => `${product.name} (${product.category})`).join(", ")}</small></div><div className="farmer-vendor-actions"><a href={googleMapsSearch(`${vendor.name}, ${vendor.locationRegion}`)} target="_blank" rel="noopener noreferrer">Find on Maps</a><a href={`tel:${vendor.phone}`} aria-label={`Call ${vendor.name}`}><Phone size={15} /> Call</a></div></article>)
                  : <p>No in-stock agrovet listings were found for {user?.locationRegion}. Browse the <Link to="/app/marketplace">marketplace</Link> or consult an agricultural expert.</p>}
          </div>
          <div className="farmer-case-meta"><span>Started: {selectedCase.startedOn ?? "Not recorded"}</span><span>Spread: {selectedCase.spreadRate}</span>{selectedCase.followUpOn && <span>Follow-up: {selectedCase.followUpOn}</span>}</div>
          <div className="farmer-timeline"><h3>Evidence timeline</h3>{selectedCase.events.map((item) => <article className="farmer-timeline-item" key={item.id}>
            <span className="farmer-timeline-dot" /><div><small>{new Date(item.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })} · {item.type.replaceAll("_", " ")}</small><p>{item.notes}{item.outcome ? ` · Farmer observed: ${item.outcome}` : ""}</p>{item.imageUrl && <a href={imageUrl(item.imageUrl)} target="_blank" rel="noreferrer"><img src={imageUrl(item.imageUrl)} alt={`Crop evidence for ${selectedCase.reference}`} /></a>}{item.videoUrl && <video className="farmer-timeline-video" controls src={imageUrl(item.videoUrl)}>Your browser cannot play this video.</video>}</div>
          </article>)}</div>
          {selectedCase.status !== "closed" && <form className="farmer-event-form" onSubmit={submitEvent}>
            <h3>Record an action, follow-up or observation</h3>
            <label>What are you recording?<select name="eventType" defaultValue="action"><option value="action">Action I took</option><option value="follow_up">Schedule a follow-up check</option><option value="observation">Crop outcome I observed</option><option value="expert_request">Record a request for expert assistance</option></select></label>
            <label>Notes<textarea name="notes" required minLength={3} maxLength={2000} rows={3} placeholder="What did you do or observe? Add dates and product details if relevant." /></label>
            <label>Crop outcome (for an observation)<select name="outcome" defaultValue=""><option value="">Not recording an outcome</option><option value="improved">Improved</option><option value="unchanged">No change</option><option value="worsened">Worsened</option></select></label>
            <label>Next follow-up date (optional)<input type="date" name="followUpOn" /></label>
            <label className="farmer-file-input"><FileImage size={16} /> Add follow-up photo (optional)<input type="file" name="image" accept="image/jpeg,image/png,image/webp" capture="environment" /></label>
            <button className="button button-dark" disabled={addEvent.isPending}>{addEvent.isPending ? "Saving to timeline…" : "Save timeline update"}</button>
          </form>}
          {selectedCase.status !== "closed" && selectedCase.latestOutcome && <form className="farmer-close-form" onSubmit={submitClose}>
            <h3>Close this case?</h3><p>Closing is your choice and keeps the recorded outcome visible. This never labels the crop as recovered automatically.</p>
            <label>Why are you closing this case?<textarea name="closeNotes" required minLength={3} maxLength={2000} rows={2} placeholder="Briefly note your reason." /></label>
            <button className="button button-soft" disabled={closeCase.isPending}>Close with recorded outcome</button>
          </form>}
          {selectedCase.status === "closed" && <p className="farmer-closed-note"><CheckCircle2 size={16} /> Closed by your recorded choice. Outcome: {selectedCase.latestOutcome ?? "not recorded"}.</p>}
        </> : <div className="farmer-empty-panel"><ClipboardList size={22} /><strong>Select a report</strong><span>Create a crop or animal report to start its evidence timeline.</span></div>}
      </section>
    </div>
  </div>;
}

export function FarmerInputsPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const { farms } = useFarmerRecords();
  const records = useQuery({
    queryKey: ["farm-inputs"],
    queryFn: () => api<{ data: FarmInputRecord[] }>("/api/farm-inputs", {}, token),
  });
  const [error, setError] = useState("");
  const createRecord = useMutation({
    mutationFn: (input: unknown) => api<{ data: FarmInputRecord }>("/api/farm-inputs", {
      method: "POST", body: JSON.stringify(input),
    }, token),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["farm-inputs"] });
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const optional = (key: string) => String(form.get(key) ?? "").trim();
    createRecord.mutate({
      ...(optional("farmId") ? { farmId: optional("farmId") } : {}),
      productName: optional("productName"),
      intendedUse: optional("intendedUse"),
      ...(optional("purchaseDate") ? { purchaseDate: optional("purchaseDate") } : {}),
      seller: optional("seller"),
      batchNumber: optional("batchNumber"),
      ...(optional("applicationDate") ? { applicationDate: optional("applicationDate") } : {}),
      instructionsFollowed: optional("instructionsFollowed"),
      observedResults: optional("observedResults"),
      complaintDetails: optional("complaintDetails"),
    });
    formElement.reset();
  }

  return <div className="farmer-workspace">
    <SectionTitle eyebrow="PRIVATE FARM RECORDS" title="Farm input journal"
      detail="Track what you buy and apply, where it came from, and what you observed. This is a personal record; complaints are stored as pending review, not treated as verified findings." />
    <div className="farmer-privacy-banner"><ShieldCheck size={19} /><span><strong>Evidence, not accusations</strong> Product complaints are recorded for later review. This demo has no investigator workflow and does not label products unsafe, counterfeit, or defective.</span></div>
    <form className="farmer-form-card" onSubmit={submit}>
      <div className="farmer-form-title"><ClipboardList size={18} /><div><strong>Record an agricultural input</strong><span>Purchase, batch and application details help keep a useful farm history.</span></div></div>
      <div className="farmer-form-grid">
        <label>Product name<input name="productName" required minLength={2} maxLength={150} placeholder="Product name on the label" /></label>
        <label>Intended use<input name="intendedUse" required minLength={3} maxLength={500} placeholder="Use as stated on its label" /></label>
        <label>Farm (optional)<select name="farmId" defaultValue=""><option value="">Not linked to a farm</option>{farms.data?.data.map((farm) => <option value={farm.id} key={farm.id}>{farm.name} · {farm.county}</option>)}</select></label>
        <label>Purchase date (optional)<input name="purchaseDate" type="date" /></label>
        <label>Seller (optional)<input name="seller" maxLength={150} /></label>
        <label>Batch / lot number (optional)<input name="batchNumber" maxLength={150} /></label>
        <label>Application date (optional)<input name="applicationDate" type="date" /></label>
        <label>Instructions followed (optional)<input name="instructionsFollowed" maxLength={2000} placeholder="Record label instructions you followed" /></label>
        <label className="farmer-field-wide">Observed results or unexpected problems (optional)<textarea name="observedResults" rows={2} maxLength={2000} /></label>
        <label className="farmer-field-wide">Submit a product complaint for review (optional)<textarea name="complaintDetails" rows={2} maxLength={2000} placeholder="Describe what happened and include dates or batch information if known." /></label>
      </div>
      {error && <RecordsError error={error} />}
      <button className="button button-dark" disabled={createRecord.isPending}>{createRecord.isPending ? "Saving record…" : "Save farm input record"}</button>
    </form>
    <section className="farmer-data-section"><SectionTitle eyebrow="YOUR INPUT HISTORY" title="Recorded purchases & applications" detail="Only your account can access these records." />
      {records.isError ? <RecordsError error={records.error} /> : records.isLoading ? <p className="farmer-muted">Loading input records…</p> : records.data?.data.length
        ? <div className="farmer-input-list">{records.data.data.map((record) => <article key={record.id}>
          <div><strong>{record.productName}</strong><small>{record.intendedUse}{record.applicationDate ? ` · Applied ${record.applicationDate}` : ""}{record.batchNumber ? ` · Lot ${record.batchNumber}` : ""}</small>
            {record.observedResults && <p>{record.observedResults}</p>}
            {record.complaintDetails && <p className="farmer-complaint-note"><AlertTriangle size={14} /> Complaint submitted · pending review. No verification or safety finding has been made.</p>}
          </div>
          <span className="farmer-input-date">{record.purchaseDate ? `Purchased ${record.purchaseDate}` : "Purchase date not recorded"}</span>
        </article>)}</div>
        : <div className="farmer-empty-panel"><ClipboardList size={22} /><strong>No inputs recorded</strong><span>Record a purchase or application to start your private traceability journal.</span></div>}
    </section>
  </div>;
}

function StatusBadge({ status }: { status: CaseStatus }) {
  return <span className={`farmer-status farmer-status-${status}`}>{statusLabels[status]}</span>;
}
