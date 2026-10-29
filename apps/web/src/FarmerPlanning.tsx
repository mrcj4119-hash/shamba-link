import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CalendarDays, CloudRain, FlaskConical,
  Leaf, MapPin, Plus, ShieldCheck, Sprout, Wheat,
} from "lucide-react";
import { ApiError, api } from "./api";
import { useAuth } from "./auth";
import { explainNutrients, explainSoilPh } from "./soil-guidance";
import type {
  Farm, FarmCalendarTask, FarmTaskType, FarmWeather, HarvestRecord, SoilAssessment,
} from "./types";
import "./farmer-workspace.css";

function planningError(error: unknown) {
  return error instanceof ApiError ? error.message : "The request could not be completed. Check your connection and try again.";
}

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function FarmSelect({ farms, name = "farmId", required = false }: { farms: Farm[]; name?: string; required?: boolean }) {
  return <label>Farm{required ? "" : " (optional)"}<select name={name} defaultValue="" required={required}>
    <option value="">{required ? "Select a registered farm and location" : "Not linked to a farm"}</option>
    {farms.map((farm) => <option value={farm.id} key={farm.id}>{farm.name} · {farm.county}</option>)}
  </select></label>;
}

function FieldSelect({ farms }: { farms: Farm[] }) {
  return <label>Crop field (optional)<select name="fieldId" defaultValue="">
    <option value="">Not linked to a field</option>
    {farms.flatMap((farm) => farm.fields.map((field) =>
      <option value={field.id} key={field.id}>{farm.name} · {field.name} · {field.cropType}</option>))}
  </select></label>;
}

export function FarmerPlanningPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [allowWeatherLocation, setAllowWeatherLocation] = useState(false);
  const [soilError, setSoilError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [harvestError, setHarvestError] = useState("");
  const farmsQuery = useQuery({
    queryKey: ["farms"],
    queryFn: () => api<{ data: Farm[] }>("/api/farms", {}, token),
  });
  const farms = farmsQuery.data?.data ?? [];
  const weatherFarmId = selectedFarmId || farms[0]?.id || "";
  const weather = useQuery({
    queryKey: ["farm-weather", weatherFarmId],
    queryFn: () => api<{ data: FarmWeather }>(`/api/farmer-planning/weather?farmId=${encodeURIComponent(weatherFarmId)}`, {}, token),
    enabled: Boolean(weatherFarmId && allowWeatherLocation),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const soil = useQuery({
    queryKey: ["soil-assessments"],
    queryFn: () => api<{ data: SoilAssessment[] }>("/api/farmer-planning/soil-assessments", {}, token),
  });
  const tasks = useQuery({
    queryKey: ["farm-calendar-tasks"],
    queryFn: () => api<{ data: FarmCalendarTask[] }>("/api/farmer-planning/calendar-tasks", {}, token),
  });
  const harvests = useQuery({
    queryKey: ["harvest-records"],
    queryFn: () => api<{ data: HarvestRecord[] }>("/api/farmer-planning/harvest-records", {}, token),
  });
  const refresh = async (key: string) => client.invalidateQueries({ queryKey: [key] });

  const addSoil = useMutation({
    mutationFn: (body: Record<string, string | number>) =>
      api("/api/farmer-planning/soil-assessments", { method: "POST", body: JSON.stringify(body) }, token),
    onSuccess: async () => { setSoilError(""); await refresh("soil-assessments"); },
    onError: (error) => setSoilError(planningError(error)),
  });
  const addTask = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api("/api/farmer-planning/calendar-tasks", { method: "POST", body: JSON.stringify(body) }, token),
    onSuccess: async () => { setTaskError(""); await refresh("farm-calendar-tasks"); },
    onError: (error) => setTaskError(planningError(error)),
  });
  const markTask = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api(`/api/farmer-planning/calendar-tasks/${id}`, {
        method: "PATCH", body: JSON.stringify({ completed }),
      }, token),
    onSuccess: async () => { await refresh("farm-calendar-tasks"); },
    onError: (error) => setTaskError(planningError(error)),
  });
  const addHarvest = useMutation({
    mutationFn: (body: Record<string, string | number>) =>
      api("/api/farmer-planning/harvest-records", { method: "POST", body: JSON.stringify(body) }, token),
    onSuccess: async () => { setHarvestError(""); await refresh("harvest-records"); },
    onError: (error) => setHarvestError(planningError(error)),
  });

  function submitSoil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const body: Record<string, string | number> = {
      cropType: values.get("cropType")?.toString() ?? "",
      nitrogenResult: values.get("nitrogenResult")?.toString() ?? "",
      phosphorusResult: values.get("phosphorusResult")?.toString() ?? "",
      potassiumResult: values.get("potassiumResult")?.toString() ?? "",
      resultUnits: values.get("resultUnits")?.toString() ?? "",
      labName: values.get("labName")?.toString() ?? "",
      notes: values.get("notes")?.toString() ?? "",
    };
    for (const key of ["farmId", "fieldId", "testedOn"] as const) {
      const value = values.get(key)?.toString() ?? "";
      if (value) body[key] = value;
    }
    for (const key of ["plotSizeAcres", "ph"] as const) {
      const value = values.get(key)?.toString() ?? "";
      if (value) body[key] = Number(value);
    }
    addSoil.mutate(body, { onSuccess: () => form.reset() });
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const body: Record<string, string> = {};
    for (const key of ["farmId", "fieldId", "cropType", "taskType", "title", "dueOn", "notes"]) {
      const value = values.get(key)?.toString().trim() ?? "";
      if (value) body[key] = value;
    }
    addTask.mutate(body, { onSuccess: () => form.reset() });
  }

  function submitHarvest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const body: Record<string, string | number> = {};
    for (const key of ["farmId", "fieldId", "cropType", "harvestedOn", "unit", "season", "notes"]) {
      const value = values.get(key)?.toString().trim() ?? "";
      if (value) body[key] = value;
    }
    for (const key of ["quantity", "plotSizeAcres"] as const) {
      const value = values.get(key)?.toString() ?? "";
      if (value) body[key] = Number(value);
    }
    addHarvest.mutate(body, { onSuccess: () => form.reset() });
  }

  async function addStarterSchedule(fieldId: string, farmId: string, cropType: string, plantingDate: string | null) {
    if (!plantingDate) {
      setTaskError("Add a planting date to this crop passport before creating starter reminders.");
      return;
    }
    setTaskError("");
    const base = new Date(`${plantingDate}T00:00:00`);
    const starterTasks = [
      { days: 7, taskType: "scouting", title: `Check ${cropType} establishment`, notes: "Observe emergence and record any concerns. Adjust timing to local extension guidance." },
      { days: 14, taskType: "weeding", title: `Check weed pressure in ${cropType}`, notes: "Inspect the field and decide whether action is needed; follow crop- and location-specific guidance." },
      { days: 28, taskType: "scouting", title: `Scout ${cropType} field`, notes: "Check several plants and record changes. This is a reminder, not a crop-specific treatment schedule." },
    ] as const;
    try {
      for (const task of starterTasks) {
        const due = new Date(base);
        due.setDate(due.getDate() + task.days);
        await addTask.mutateAsync({
          farmId, fieldId, cropType, taskType: task.taskType as FarmTaskType,
          title: task.title, dueOn: localDate(due), notes: task.notes,
        });
      }
      await refresh("farm-calendar-tasks");
    } catch (error) {
      setTaskError(planningError(error));
    }
  }

  const today = localDate();
  const sortedTasks = [...(tasks.data?.data ?? [])].sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  return <div className="farmer-workspace farmer-planning">
    <header className="farmer-planning-heading">
      <div><span className="farmer-eyebrow"><Sprout size={15} /> FARM PLANNING</span><h1>Plan, observe and learn</h1>
        <p>Keep soil-test results, local forecasts, field reminders and harvest history together.</p></div>
      <Link className="button button-light" to="/app/farms"><Wheat size={17} /> My farm passports</Link>
    </header>

    {farmsQuery.isError && <p className="farmer-error" role="alert">{planningError(farmsQuery.error)}</p>}

    <section className="farmer-planning-card">
      <div className="farmer-planning-card-heading"><CloudRain size={20} /><div><h2>Local weather and field alerts</h2><p>Seven-day forecast for the approximate farm location, from Open-Meteo.</p></div></div>
      {farms.length > 0 && <label className="planning-farm-picker">Forecast for
        <select value={weatherFarmId} onChange={(event) => {
          setSelectedFarmId(event.target.value);
          setAllowWeatherLocation(false);
        }}>
          {farms.map((farm) => <option value={farm.id} key={farm.id}>{farm.name} · {farm.county}</option>)}
        </select>
      </label>}
      {farmsQuery.isLoading ? <p className="farmer-muted">Loading your farm list…</p>
        : !farms.length ? <p className="farmer-muted">Add a farm and county to see its approximate forecast. <Link to="/app/farms">Register a farm</Link></p>
          : !allowWeatherLocation ? <div className="weather-consent">
            <p>Your selected farm's county or general location will be sent to Open-Meteo to find a nearby forecast. Shamba Link does not send GPS coordinates or your account details.</p>
            <button type="button" className="button button-dark" onClick={() => setAllowWeatherLocation(true)}><CloudRain size={16} /> Load approximate forecast</button>
          </div>
          : weather.isLoading ? <p className="farmer-muted">Loading approximate forecast…</p>
          : weather.isError ? <p className="farmer-error" role="alert">{planningError(weather.error)}</p>
            : weather.data?.data && <>
              <p className="weather-location"><MapPin size={15} /> Forecast area: <strong>{weather.data.data.location}</strong>
                {weather.data.data.locationBasis === "county_search" ? " · approximate county search" : " · nearest-town search"}
              </p>
              <div className="weather-days">{weather.data.data.days.map((day) => <article key={day.date}>
                <strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString("en-KE", { weekday: "short", day: "numeric" })}</strong>
                <span>{day.condition}</span><b>{Math.round(day.maximumC)}° / {Math.round(day.minimumC)}°</b>
                <small>{day.precipitationProbability ?? "—"}% rain · {day.precipitationMm} mm</small>
                {day.alerts.map((alert) => <p className="weather-alert" key={alert}><AlertTriangle size={13} />{alert}</p>)}
              </article>)}</div>
              <p className="farmer-privacy-note"><AlertTriangle size={15} /> Forecasts are regional estimates, not field measurements. Weather alerts are general scouting prompts, not disease diagnoses. Updated {new Date(weather.data.data.updatedAt).toLocaleString()} · Source: {weather.data.data.provider}.</p>
            </>}
    </section>

    <section className="farmer-planning-card">
      <div className="farmer-planning-card-heading"><FlaskConical size={20} /><div><h2>Soil health and test planner</h2><p>Record lab results and get a cautious, crop-linked interpretation without guessed fertilizer rates.</p></div></div>
      <div className="farmer-privacy-banner"><ShieldCheck size={18} /><span><strong>Use crop- and location-specific targets.</strong> Soil pH describes acidity or alkalinity on a 0–14 scale; nutrient values need the laboratory's units and crop-specific reference ranges. This tool explains the reading but does not calculate fertilizer or lime rates. Confirm recommendations with the testing laboratory or a county agricultural extension officer.</span></div>
      {!farms.length && !farmsQuery.isLoading && <p className="farmer-muted">Register the farm's county and plot size before saving a soil plan. <Link to="/app/farms">Add a farm</Link></p>}
      <form className="farmer-form-grid" onSubmit={submitSoil}>
        <FarmSelect farms={farms} required /><FieldSelect farms={farms} />
        <label>Crop grown<input name="cropType" required minLength={2} placeholder="e.g. Maize" /></label>
        <label>Tested plot size in acres<input name="plotSizeAcres" required type="number" min="0.01" step="0.01" /></label>
        <label>Test date (optional)<input name="testedOn" type="date" /></label>
        <label>Soil pH (optional)<input name="ph" type="number" min="0" max="14" step="0.01" placeholder="0–14" /></label>
        <label>Nitrogen result (as shown on report)<input name="nitrogenResult" maxLength={100} /></label>
        <label>Phosphorus result (as shown on report)<input name="phosphorusResult" maxLength={100} /></label>
        <label>Potassium result (as shown on report)<input name="potassiumResult" maxLength={100} /></label>
        <label>Units / lab reference range<input name="resultUnits" maxLength={100} placeholder="Copy units or interpretation from report" /></label>
        <label>Testing laboratory<input name="labName" maxLength={150} /></label>
        <label className="planning-field-wide">Other soil-test results or observations<textarea name="notes" rows={2} maxLength={2000} placeholder="Organic matter, salinity, drainage, or notes printed on the report" /></label>
        {soilError && <p className="farmer-error planning-field-wide" role="alert">{soilError}</p>}
        <button className="button button-dark" disabled={addSoil.isPending}><Plus size={16} />{addSoil.isPending ? "Saving test…" : "Save soil test"}</button>
      </form>
      <div className="soil-plan-guidance"><h3>Your recorded soil assessments</h3>
        {soil.isError ? <p className="farmer-error" role="alert">{planningError(soil.error)}</p>
          : soil.isLoading ? <p className="farmer-muted">Loading soil history…</p>
            : soil.data?.data.length ? soil.data.data.map((record) => {
                const pHText = explainSoilPh(record.ph, record.cropType);
                const nutrientText = explainNutrients(
                  record.cropType,
                  Boolean(record.nitrogenResult || record.phosphorusResult || record.potassiumResult),
                  record.resultUnits,
                );
                return <article className="soil-assessment-row" key={record.id}>
                  <div><strong>{record.cropType}{record.testedOn ? ` · ${dateLabel(record.testedOn)}` : ""}</strong><p>{pHText}</p>
                  {(record.nitrogenResult || record.phosphorusResult || record.potassiumResult) &&
                    <small>N: {record.nitrogenResult || "—"} · P: {record.phosphorusResult || "—"} · K: {record.potassiumResult || "—"} {record.resultUnits}</small>}
                  {record.labName && <small>Lab: {record.labName}</small>}
                  <p className="soil-plan-next-step"><Leaf size={14} /> {nutrientText} Ask for any fertilizer or lime recommendation to state the product, rate and plot area explicitly. Keep healthy ground cover and use clean crop residues where suitable; follow local advice where disease is present.</p>
                </div>
              </article>;
            }) : <p className="farmer-muted">No soil assessments saved yet.</p>}
        <p className="soil-source-note">Guidance: use soil-test interpretation from <a href="https://www.kalro.org/" target="_blank" rel="noreferrer">KALRO</a> and your county agricultural extension service. This tool does not replace a laboratory interpretation or crop-specific recommendation.</p>
      </div>
    </section>

    <section className="farmer-planning-card">
      <div className="farmer-planning-card-heading"><CalendarDays size={20} /><div><h2>Crop planner and farming calendar</h2><p>Set reminders for scouting, weeding, top-dressing, irrigation, planting and harvest.</p></div></div>
      {farms.flatMap((farm) => farm.fields.filter((field) => field.plantingDate).map((field) =>
        <div className="starter-schedule" key={field.id}><span>{farm.name} · {field.name} · {field.cropType}</span>
          <button type="button" className="button button-soft" onClick={() => void addStarterSchedule(field.id, farm.id, field.cropType, field.plantingDate)}>
            <CalendarDays size={15} /> Add starter scouting & weeding reminders
          </button>
        </div>))}
      <p className="farmer-privacy-note"><AlertTriangle size={15} /> Starter reminders are generic prompts, not a crop-specific prescription. Adjust all dates and inputs using crop variety, season, soil test and local extension advice. Reminders appear here when due; this release does not send push notifications.</p>
      <form className="farmer-form-grid" onSubmit={submitTask}>
        <FarmSelect farms={farms} /><FieldSelect farms={farms} />
        <label>Crop<input name="cropType" maxLength={100} placeholder="Optional" /></label>
        <label>Reminder type<select name="taskType" defaultValue="scouting">
          <option value="scouting">Scouting</option><option value="weeding">Weeding</option>
          <option value="top_dressing">Top-dressing</option><option value="irrigation">Irrigation</option>
          <option value="planting">Planting</option><option value="harvest">Harvest</option><option value="other">Other</option>
        </select></label>
        <label>Reminder title<input name="title" required minLength={2} maxLength={160} placeholder="e.g. Check bean leaves" /></label>
        <label>Due date<input name="dueOn" required type="date" defaultValue={today} /></label>
        <label className="planning-field-wide">Notes (optional)<textarea name="notes" rows={2} maxLength={1000} /></label>
        {taskError && <p className="farmer-error planning-field-wide" role="alert">{taskError}</p>}
        <button className="button button-dark" disabled={addTask.isPending}><Plus size={16} />{addTask.isPending ? "Saving reminder…" : "Add reminder"}</button>
      </form>
      {tasks.isError ? <p className="farmer-error" role="alert">{planningError(tasks.error)}</p>
        : tasks.isLoading ? <p className="farmer-muted">Loading calendar…</p>
          : <div className="farm-task-list">{sortedTasks.length ? sortedTasks.map((task) => {
            const completed = Boolean(task.completedAt);
            const overdue = !completed && task.dueOn < today;
            return <article className={`farm-task-row ${overdue ? "is-overdue" : ""}`} key={task.id}>
              <button type="button" className="task-complete-button" aria-label={completed ? "Reopen reminder" : "Mark reminder complete"} onClick={() => markTask.mutate({ id: task.id, completed: !completed })}>
                {completed ? "Reopen" : "Complete"}
              </button><div><strong>{task.title}</strong><span>{task.cropType || "General"} · {task.taskType.replace("_", " ")} · Due {dateLabel(task.dueOn)} {overdue && "· overdue"}</span>
                {task.notes && <small>{task.notes}</small>}</div>
              <span className={`task-status ${completed ? "is-complete" : overdue ? "is-overdue" : ""}`}>{completed ? "Done" : overdue ? "Overdue" : "Upcoming"}</span>
            </article>;
          }) : <p className="farmer-muted">No reminders yet. Add your first field task above.</p>}</div>}
    </section>

    <section className="farmer-planning-card">
      <div className="farmer-planning-card-heading"><Wheat size={20} /><div><h2>Farm history and yield tracker</h2><p>Record harvest quantities, plot size and season to compare results over time.</p></div></div>
      <form className="farmer-form-grid" onSubmit={submitHarvest}>
        <FarmSelect farms={farms} /><FieldSelect farms={farms} />
        <label>Crop harvested<input name="cropType" required minLength={2} maxLength={100} /></label>
        <label>Harvest date<input name="harvestedOn" required type="date" defaultValue={today} /></label>
        <label>Quantity<input name="quantity" required type="number" min="0.01" step="0.01" /></label>
        <label>Unit<input name="unit" required maxLength={30} placeholder="kg, bags (specify bag size), crates…" /></label>
        <label>Harvested plot size in acres (optional)<input name="plotSizeAcres" type="number" min="0.01" step="0.01" /></label>
        <label>Season / year (optional)<input name="season" maxLength={80} placeholder="e.g. Long rains 2026" /></label>
        <label className="planning-field-wide">Actions taken or results (optional)<textarea name="notes" rows={2} maxLength={2000} placeholder="Inputs used, crop problems, quality, or other observations" /></label>
        {harvestError && <p className="farmer-error planning-field-wide" role="alert">{harvestError}</p>}
        <button className="button button-dark" disabled={addHarvest.isPending}><Plus size={16} />{addHarvest.isPending ? "Saving harvest…" : "Record harvest"}</button>
      </form>
      {harvests.isError ? <p className="farmer-error" role="alert">{planningError(harvests.error)}</p>
        : harvests.isLoading ? <p className="farmer-muted">Loading harvest history…</p>
          : <div className="farm-task-list">{harvests.data?.data.length ? harvests.data.data.map((record) => <article className="harvest-row" key={record.id}>
            <span className="harvest-icon"><Wheat size={17} /></span><div><strong>{record.cropType} · {record.quantity} {record.unit}</strong>
              <span>{dateLabel(record.harvestedOn)}{record.season ? ` · ${record.season}` : ""}{record.plotSizeAcres ? ` · ${record.plotSizeAcres} acres` : ""}</span>
              {record.plotSizeAcres && <small>{(record.quantity / record.plotSizeAcres).toFixed(2)} {record.unit}/acre (compare only records with matching units and comparable plots)</small>}
              {record.notes && <small>{record.notes}</small>}</div>
          </article>) : <p className="farmer-muted">No harvest records yet. Record a harvest to start your seasonal history.</p>}</div>}
    </section>
  </div>;
}
