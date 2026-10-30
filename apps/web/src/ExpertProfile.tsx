import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileCheck2, ShieldCheck, UserRoundCheck } from "lucide-react";
import { ApiError, api } from "./api";
import { useAuth } from "./auth";
import type { ExpertProfile, ExpertVerificationRecord } from "./types";
import "./expert-profile.css";

const expertiseLabels: Record<string, string> = {
  veterinary_medicine: "Veterinary medicine",
  agronomy: "Agronomy",
  poultry: "Poultry specialist",
  crop_protection: "Crop protection",
  animal_health: "Animal health",
  other: "Other",
};

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "We couldn't complete this request. Check your connection and try again.";
}

export function ExpertProfilePage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const profile = useQuery({
    queryKey: ["expert-profile"],
    queryFn: () => api<{ data: ExpertProfile | null }>("/api/expert/profile", {}, token),
  });
  const save = useMutation({
    mutationFn: (body: FormData) =>
      api<{ data: ExpertProfile }>("/api/expert/profile", { method: "PUT", body }, token),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["expert-profile"] });
    },
    onError: (cause) => setError(errorText(cause)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set("available", String(body.get("available") === "on"));
    save.mutate(body);
  }

  if (profile.isLoading) return <p className="expert-page-status">Loading your professional profile…</p>;
  if (profile.isError) return <p className="expert-page-error" role="alert">{errorText(profile.error)}</p>;

  const current = profile.data?.data ?? null;
  const status = current?.verificationStatus;
  return <div className="expert-profile-page">
    <header className="expert-page-heading">
      <span className="expert-page-icon"><ShieldCheck size={22} /></span>
      <div><span className="expert-eyebrow">PROFESSIONAL TRUST & SAFETY</span><h1>Your credentials & service profile</h1>
        <p>Submit your license and Certificate of Good Conduct for manual review. Your profile is not listed for farmer bookings until an administrator verifies it.</p></div>
    </header>
    {status && <div className={`expert-status-banner expert-status-${status}`} role="status">
      <BadgeCheck size={19} />
      <span><strong>{status === "pending" ? "Review in progress" : status === "verified" ? "Credentials verified" : "Changes requested"}</strong>
        <small>{current.reviewNote || (status === "pending" ? "Your documents are waiting for an administrator to review them." : status === "verified" ? "Your professional profile can be listed when you mark yourself available." : "Update your details and submit both documents again.")}</small></span>
    </div>}
    <form className="expert-profile-form" onSubmit={submit} key={current?.updatedAt ?? "new"}>
      <section className="expert-form-card">
        <div className="expert-form-title"><FileCheck2 size={19} /><div><h2>Professional registration</h2><p>Use details that match your official credentials.</p></div></div>
        <div className="expert-form-grid">
          <label>License / registration number<input name="licenseNumber" defaultValue={current?.licenseNumber ?? ""} minLength={3} maxLength={100} required /></label>
          <label>Area of expertise<select name="expertise" defaultValue={current?.expertise ?? "veterinary_medicine"} required>{Object.entries(expertiseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Years of field experience<input name="experienceYears" type="number" min="0" max="80" step="1" defaultValue={current?.experienceYears ?? 0} required /></label>
          <label>Service radius (km)<input name="serviceRadiusKm" type="number" min="1" max="1000" defaultValue={current?.serviceRadiusKm ?? 25} required /></label>
          <label>Consultation rate (KES)<input name="consultationRateKes" type="number" min="0" max="1000000" step="0.01" defaultValue={current?.consultationRateKes ?? 0} required /></label>
          <label className="expert-availability"><input name="available" type="checkbox" defaultChecked={current?.available ?? false} /><span><strong>Available for consultation requests</strong><small>Availability is enabled only after credential review.</small></span></label>
        </div>
      </section>
      <section className="expert-form-card">
        <div className="expert-form-title"><ShieldCheck size={19} /><div><h2>Required verification documents</h2><p>Documents are private and only accessible to you and authorized reviewers.</p></div></div>
        <div className="expert-form-grid">
          <label>Professional license / certification<input name="licenseDocument" type="file" accept="image/jpeg,image/png,application/pdf" required /><small>JPEG, PNG or PDF · maximum 10 MB</small></label>
          <label>Certificate of Good Conduct<input name="goodConductDocument" type="file" accept="image/jpeg,image/png,application/pdf" required /><small>JPEG, PNG or PDF · maximum 10 MB</small></label>
        </div>
      </section>
      {error && <p className="expert-page-error" role="alert">{error}</p>}
      <button className="button button-dark" type="submit" disabled={save.isPending}>
        {save.isPending ? "Submitting for review…" : status ? "Resubmit documents for review" : "Submit professional profile"}
      </button>
    </form>
  </div>;
}

export function ExpertVerificationPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [status, setStatus] = useState<"pending" | "verified" | "rejected">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const records = useQuery({
    queryKey: ["expert-verification", status],
    queryFn: () => api<{ data: ExpertVerificationRecord[] }>(`/api/admin/expert-verification?status=${status}`, {}, token),
  });
  const review = useMutation({
    mutationFn: (input: { userId: string; status: "verified" | "rejected"; reviewNote: string }) =>
      api(`/api/admin/expert-verification/${input.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: input.status, reviewNote: input.reviewNote }),
      }, token),
    onSuccess: async () => {
      setError("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["expert-verification"] }),
        client.invalidateQueries({ queryKey: ["experts"] }),
      ]);
    },
    onError: (cause) => setError(errorText(cause)),
  });

  return <div className="expert-profile-page">
    <header className="expert-page-heading">
      <span className="expert-page-icon"><UserRoundCheck size={22} /></span>
      <div><span className="expert-eyebrow">VERIFICATION QUEUE</span><h1>Review professional credentials</h1>
        <p>Check the submitted license and Certificate of Good Conduct before approving a professional for farmer consultations.</p></div>
    </header>
    <label className="expert-review-filter">Show profiles
      <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
        <option value="pending">Awaiting review</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
      </select>
    </label>
    {error && <p className="expert-page-error" role="alert">{error}</p>}
    {records.isLoading ? <p className="expert-page-status">Loading review queue…</p>
      : records.isError ? <p className="expert-page-error" role="alert">{errorText(records.error)}</p>
        : records.data?.data.length ? <div className="expert-review-list">{records.data.data.map((record) => <article className="expert-review-card" key={record.userId}>
          <div className="expert-review-top"><span><strong>{record.name}</strong><small>{record.email} · {record.phone} · {record.locationRegion}</small></span><span className={`expert-status-tag expert-status-${record.verificationStatus}`}>{record.verificationStatus}</span></div>
          <dl className="expert-review-details">
            <div><dt>License number</dt><dd>{record.licenseNumber}</dd></div>
            <div><dt>Expertise</dt><dd>{expertiseLabels[record.expertise] ?? record.expertise}</dd></div>
            <div><dt>Experience</dt><dd>{record.experienceYears} years</dd></div>
            <div><dt>Service area / rate</dt><dd>{record.serviceRadiusKm} km · KES {record.consultationRateKes}</dd></div>
          </dl>
          <div className="expert-document-links">
            <a href={record.licenseDocumentUrl} target="_blank" rel="noreferrer">Open professional license</a>
            <a href={record.goodConductDocumentUrl} target="_blank" rel="noreferrer">Open Certificate of Good Conduct</a>
          </div>
          {status === "pending" && <div className="expert-review-actions">
            <label>Review note<input value={notes[record.userId] ?? ""} onChange={(event) => setNotes((previous) => ({ ...previous, [record.userId]: event.target.value }))} placeholder="Required when rejecting" maxLength={1000} /></label>
            <button type="button" className="button button-dark" disabled={review.isPending} onClick={() => review.mutate({ userId: record.userId, status: "verified", reviewNote: notes[record.userId] ?? "" })}>Verify credentials</button>
            <button type="button" className="button button-light" disabled={review.isPending || (notes[record.userId] ?? "").trim().length < 3} onClick={() => review.mutate({ userId: record.userId, status: "rejected", reviewNote: (notes[record.userId] ?? "").trim() })}>Reject with note</button>
          </div>}
        </article>)}</div>
          : <p className="expert-page-status">There are no {status} professional profiles.</p>}
  </div>;
}
