import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ClipboardCheck, Eye, EyeOff, Plus, Save, Users } from "lucide-react";
import { ApiError, api } from "./api";
import { useAuth } from "./auth";
import type { AdminCropCase, AdminUser, CaseStatus, KnowledgeGuide } from "./types";

const caseStatuses: CaseStatus[] = ["reported", "under_review", "action_required", "follow_up_due", "improving", "referred_to_expert", "closed"];
const guideCategories: KnowledgeGuide["category"][] = ["crop", "pest", "disease", "soil", "livestock", "prevention"];

function adminError(error: unknown) {
  return error instanceof ApiError ? error.message : "The request could not be completed. Check your connection and try again.";
}

function AdminPageTitle({ icon, eyebrow, title, detail }: { icon: ReactNode; eyebrow: string; title: string; detail: string }) {
  return <div className="admin-page-title"><span>{icon}</span><div><small>{eyebrow}</small><h1>{title}</h1><p>{detail}</p></div></div>;
}

export function AdminUsersPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => api<{ data: AdminUser[] }>(`/api/admin/users?search=${encodeURIComponent(search)}`, {}, token),
  });
  const updateUser = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { role?: "farmer" | "agrovet" | "expert"; isActive?: boolean } }) =>
      api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) }, token),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      await client.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (cause) => setError(adminError(cause)),
  });

  return <section className="admin-management-page">
    <AdminPageTitle icon={<Users size={20} />} eyebrow="PLATFORM ADMINISTRATION" title="User management" detail="Search accounts, update member roles, and disable or restore access. Administrator accounts are protected." />
    <label className="admin-search"><span>Search accounts</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or region" /></label>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {users.isError ? <p className="admin-error" role="alert">{adminError(users.error)}</p>
      : users.isLoading ? <p className="admin-status">Loading accounts…</p>
        : users.data?.data.length ? <div className="admin-record-list">{users.data.data.map((user) => <article className="admin-record" key={user.id}>
          <div className="admin-record-main"><strong>{user.name}</strong><span>{user.email}</span><small>{user.phone} · {user.locationRegion} · Joined {new Date(user.createdAt).toLocaleDateString()}</small></div>
          <label className="admin-inline-control">Role<select value={user.role} disabled={user.role === "admin" || updateUser.isPending} onChange={(event) => updateUser.mutate({ id: user.id, changes: { role: event.target.value as "farmer" | "agrovet" | "expert" } })}><option value="farmer">Farmer</option><option value="agrovet">Agrovet</option><option value="expert">Expert</option>{user.role === "admin" && <option value="admin">Administrator</option>}</select></label>
          <button type="button" className={`admin-state-button ${user.isActive ? "is-active" : "is-disabled"}`} disabled={user.role === "admin" || updateUser.isPending} onClick={() => updateUser.mutate({ id: user.id, changes: { isActive: !user.isActive } })}>{user.isActive ? <><Eye size={15} /> Active · disable</> : <><EyeOff size={15} /> Disabled · restore</>}</button>
        </article>)}</div> : <p className="admin-status">No accounts matched your search.</p>}
  </section>;
}

interface GuideDraft {
  slug: string;
  category: KnowledgeGuide["category"];
  titleEn: string;
  titleSw: string;
  summaryEn: string;
  summarySw: string;
  bodyEn: string;
  bodySw: string;
  isPublished: boolean;
}

const blankGuide: GuideDraft = {
  slug: "",
  category: "crop",
  titleEn: "",
  titleSw: "",
  summaryEn: "",
  summarySw: "",
  bodyEn: "",
  bodySw: "",
  isPublished: true,
};

function guideDraft(guide: KnowledgeGuide): GuideDraft {
  return {
    slug: guide.slug,
    category: guide.category,
    titleEn: guide.titleEn,
    titleSw: guide.titleSw,
    summaryEn: guide.summaryEn,
    summarySw: guide.summarySw,
    bodyEn: guide.bodyEn,
    bodySw: guide.bodySw,
    isPublished: guide.isPublished,
  };
}

export function AdminGuidesPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<GuideDraft>(blankGuide);
  const [error, setError] = useState("");
  const guides = useQuery({
    queryKey: ["admin-guides"],
    queryFn: () => api<{ data: KnowledgeGuide[] }>("/api/admin/guides", {}, token),
  });
  const saveGuide = useMutation({
    mutationFn: () => selectedId
      ? api(`/api/admin/guides/${selectedId}`, { method: "PATCH", body: JSON.stringify(draft) }, token)
      : api("/api/admin/guides", { method: "POST", body: JSON.stringify(draft) }, token),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["admin-guides"] });
      await client.invalidateQueries({ queryKey: ["knowledge-guides"] });
      setSelectedId("");
      setDraft(blankGuide);
    },
    onError: (cause) => setError(adminError(cause)),
  });
  const update = <K extends keyof GuideDraft>(key: K, value: GuideDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveGuide.mutate();
  }

  return <section className="admin-management-page">
    <AdminPageTitle icon={<BookOpen size={20} />} eyebrow="PLATFORM ADMINISTRATION" title="Farming guides" detail="Create and maintain searchable English and Kiswahili farming guides. Publishing makes a guide visible in the public library." />
    <div className="admin-guide-layout">
      <div className="admin-record-list">{guides.isLoading ? <p className="admin-status">Loading guides…</p>
        : guides.isError ? <p className="admin-error" role="alert">{adminError(guides.error)}</p>
          : guides.data?.data.map((guide) => <button type="button" className={`admin-guide-select ${selectedId === guide.id ? "selected" : ""}`} key={guide.id} onClick={() => { setSelectedId(guide.id); setDraft(guideDraft(guide)); }}><span><strong>{guide.titleEn}</strong><small>{guide.category} · {guide.isPublished ? "Published" : "Draft"}</small></span></button>)}</div>
      <form className="admin-guide-form" onSubmit={submit}>
        <div className="admin-form-heading"><strong>{selectedId ? "Edit guide" : "Create a guide"}</strong><button type="button" className="admin-text-button" onClick={() => { setSelectedId(""); setDraft(blankGuide); }}><Plus size={15} /> New guide</button></div>
        <label>URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120} value={draft.slug} onChange={(event) => update("slug", event.target.value)} placeholder="healthy-crop-observation" /></label>
        <label>Topic<select value={draft.category} onChange={(event) => update("category", event.target.value as GuideDraft["category"])}>{guideCategories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
        <label>Title · English<input required minLength={3} maxLength={180} value={draft.titleEn} onChange={(event) => update("titleEn", event.target.value)} /></label>
        <label>Kichwa · Kiswahili<input required minLength={3} maxLength={180} value={draft.titleSw} onChange={(event) => update("titleSw", event.target.value)} /></label>
        <label>Short summary · English<input required minLength={5} maxLength={500} value={draft.summaryEn} onChange={(event) => update("summaryEn", event.target.value)} /></label>
        <label>Muhtasari · Kiswahili<input required minLength={5} maxLength={500} value={draft.summarySw} onChange={(event) => update("summarySw", event.target.value)} /></label>
        <label>Guide text · English<textarea required minLength={20} maxLength={10000} rows={5} value={draft.bodyEn} onChange={(event) => update("bodyEn", event.target.value)} /></label>
        <label>Maelezo ya mwongozo · Kiswahili<textarea required minLength={20} maxLength={10000} rows={5} value={draft.bodySw} onChange={(event) => update("bodySw", event.target.value)} /></label>
        <label className="admin-publish-control"><input type="checkbox" checked={draft.isPublished} onChange={(event) => update("isPublished", event.target.checked)} /> Published in public library</label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button type="submit" className="button button-dark" disabled={saveGuide.isPending}><Save size={16} /> {saveGuide.isPending ? "Saving guide…" : selectedId ? "Save changes" : "Create guide"}</button>
      </form>
    </div>
  </section>;
}

export function AdminCasesPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const cases = useQuery({
    queryKey: ["admin-cases", search],
    queryFn: () => api<{ data: AdminCropCase[] }>(`/api/admin/cases?search=${encodeURIComponent(search)}`, {}, token),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: CaseStatus; notes: string }) =>
      api(`/api/admin/cases/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, notes }) }, token),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["admin-cases"] });
      await client.invalidateQueries({ queryKey: ["crop-cases"] });
    },
    onError: (cause) => setError(adminError(cause)),
  });

  function submit(event: FormEvent<HTMLFormElement>, item: AdminCropCase) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateStatus.mutate({
      id: item.id,
      status: String(form.get("status")) as CaseStatus,
      notes: String(form.get("notes") ?? ""),
    });
    event.currentTarget.reset();
  }

  return <section className="admin-management-page">
    <AdminPageTitle icon={<ClipboardCheck size={20} />} eyebrow="PLATFORM ADMINISTRATION" title="Farm health report review" detail="Review crop and animal reports and update their status. Each status change is added to the farmer’s report timeline." />
    <label className="admin-search"><span>Search reports</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, crop, animal, symptoms or farmer" /></label>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {cases.isError ? <p className="admin-error" role="alert">{adminError(cases.error)}</p>
      : cases.isLoading ? <p className="admin-status">Loading farm-health reports…</p>
        : cases.data?.data.length ? <div className="admin-record-list">{cases.data.data.map((item) => <article className="admin-case-record" key={item.id}>
          <div className="admin-case-summary"><div><strong>{item.subjectName} · {item.reference}</strong><small>{item.caseType === "livestock" ? "Animal report" : "Crop report"} · {item.farmerName} · {item.farmerEmail} · {item.farmerRegion}</small></div><p>{item.symptoms}</p></div>
          <form className="admin-case-status-form" onSubmit={(event) => submit(event, item)}><label>Status<select name="status" defaultValue={item.status}>{caseStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><label>Timeline note (optional)<input name="notes" maxLength={500} placeholder="Note visible to the farmer" /></label><button className="button button-dark" disabled={updateStatus.isPending}>Update status</button></form>
        </article>)}</div> : <p className="admin-status">No farm-health reports matched your search.</p>}
  </section>;
}
