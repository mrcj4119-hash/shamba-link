import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { asyncHandler, authenticate, requireRole } from "./middleware.js";
import { weatherAlerts } from "./weather-alerts.js";

type DbRecord = Record<string, any>;

const router = Router();
router.use(authenticate, requireRole("farmer"));
const weatherLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
});

async function assertFarmOwnership(farmerId: string, farmId?: string, fieldId?: string) {
  if (farmId) {
    const farm = await db("farms").where({ id: farmId, farmer_id: farmerId }).first("id");
    if (!farm) throw new AppError(404, "FARM_NOT_FOUND", "This farm was not found.");
  }
  if (fieldId) {
    const field = await db("crop_fields").where({ id: fieldId, farmer_id: farmerId })
      .first("id", "farm_id");
    if (!field) throw new AppError(404, "FIELD_NOT_FOUND", "This crop field was not found.");
    if (farmId && field.farm_id !== farmId) {
      throw new AppError(400, "FIELD_FARM_MISMATCH", "Choose a field that belongs to the selected farm.");
    }
  }
}

function soilRecord(row: DbRecord) {
  return {
    id: row.id, farmId: row.farm_id, fieldId: row.field_id, cropType: row.crop_type,
    plotSizeAcres: row.plot_size_acres === null ? null : Number(row.plot_size_acres),
    testedOn: row.tested_on, ph: row.ph === null ? null : Number(row.ph),
    nitrogenResult: row.nitrogen_result, phosphorusResult: row.phosphorus_result,
    potassiumResult: row.potassium_result, resultUnits: row.result_units,
    labName: row.lab_name, notes: row.notes, createdAt: row.created_at,
  };
}

const soilSchema = z.object({
  farmId: z.string().uuid(),
  fieldId: z.string().uuid().optional(),
  cropType: z.string().trim().min(2).max(100),
  plotSizeAcres: z.coerce.number().positive().max(100000),
  testedOn: z.string().date().optional(),
  ph: z.coerce.number().min(0).max(14).optional(),
  nitrogenResult: z.string().trim().max(100).default(""),
  phosphorusResult: z.string().trim().max(100).default(""),
  potassiumResult: z.string().trim().max(100).default(""),
  resultUnits: z.string().trim().max(100).default(""),
  labName: z.string().trim().max(150).default(""),
  notes: z.string().trim().max(2000).default(""),
});

router.get("/soil-assessments", asyncHandler(async (req, res) => {
  const rows = await db("soil_assessments").where({ farmer_id: req.auth!.userId })
    .orderBy("created_at", "desc").limit(100) as DbRecord[];
  res.json({ data: rows.map(soilRecord) });
}));

router.post("/soil-assessments", asyncHandler(async (req, res) => {
  const input = soilSchema.parse(req.body);
  await assertFarmOwnership(req.auth!.userId, input.farmId, input.fieldId);
  const [row] = await db("soil_assessments").insert({
    farmer_id: req.auth!.userId, farm_id: input.farmId, field_id: input.fieldId ?? null,
    crop_type: input.cropType, plot_size_acres: input.plotSizeAcres,
    tested_on: input.testedOn ?? null, ph: input.ph ?? null,
    nitrogen_result: input.nitrogenResult, phosphorus_result: input.phosphorusResult,
    potassium_result: input.potassiumResult, result_units: input.resultUnits,
    lab_name: input.labName, notes: input.notes,
  }).returning("*");
  res.status(201).json({ data: soilRecord(row) });
}));

const taskTypes = ["weeding", "top_dressing", "scouting", "irrigation", "planting", "harvest", "other"] as const;
const taskSchema = z.object({
  farmId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  cropType: z.string().trim().max(100).default(""),
  taskType: z.enum(taskTypes),
  title: z.string().trim().min(2).max(160),
  dueOn: z.string().date(),
  notes: z.string().trim().max(1000).default(""),
}).refine((value) => !value.fieldId || Boolean(value.farmId), {
  message: "Choose the farm when linking a field.",
  path: ["farmId"],
});

function taskRecord(row: DbRecord) {
  return {
    id: row.id, farmId: row.farm_id, fieldId: row.field_id, cropType: row.crop_type,
    taskType: row.task_type, title: row.title, dueOn: row.due_on, notes: row.notes,
    completedAt: row.completed_at, createdAt: row.created_at,
  };
}

router.get("/calendar-tasks", asyncHandler(async (req, res) => {
  const rows = await db("farm_calendar_tasks").where({ farmer_id: req.auth!.userId })
    .orderBy("due_on", "asc").limit(300) as DbRecord[];
  res.json({ data: rows.map(taskRecord) });
}));

router.post("/calendar-tasks", asyncHandler(async (req, res) => {
  const input = taskSchema.parse(req.body);
  await assertFarmOwnership(req.auth!.userId, input.farmId, input.fieldId);
  const [row] = await db("farm_calendar_tasks").insert({
    farmer_id: req.auth!.userId, farm_id: input.farmId ?? null, field_id: input.fieldId ?? null,
    crop_type: input.cropType, task_type: input.taskType, title: input.title,
    due_on: input.dueOn, notes: input.notes,
  }).returning("*");
  res.status(201).json({ data: taskRecord(row) });
}));

router.patch("/calendar-tasks/:taskId", asyncHandler(async (req, res) => {
  const taskId = z.string().uuid().parse(req.params.taskId);
  const completed = z.boolean().parse(req.body.completed);
  const [row] = await db("farm_calendar_tasks").where({
    id: taskId, farmer_id: req.auth!.userId,
  }).update({ completed_at: completed ? db.fn.now() : null }).returning("*");
  if (!row) throw new AppError(404, "TASK_NOT_FOUND", "This farm reminder was not found.");
  res.json({ data: taskRecord(row) });
}));

const harvestSchema = z.object({
  farmId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  cropType: z.string().trim().min(2).max(100),
  harvestedOn: z.string().date(),
  quantity: z.coerce.number().positive().max(100000000),
  unit: z.string().trim().min(1).max(30),
  plotSizeAcres: z.coerce.number().positive().max(100000).optional(),
  season: z.string().trim().max(80).default(""),
  notes: z.string().trim().max(2000).default(""),
}).refine((value) => !value.fieldId || Boolean(value.farmId), {
  message: "Choose the farm when linking a field.",
  path: ["farmId"],
});

function harvestRecord(row: DbRecord) {
  return {
    id: row.id, farmId: row.farm_id, fieldId: row.field_id, cropType: row.crop_type,
    harvestedOn: row.harvested_on, quantity: Number(row.quantity), unit: row.unit,
    plotSizeAcres: row.plot_size_acres === null ? null : Number(row.plot_size_acres),
    season: row.season, notes: row.notes, createdAt: row.created_at,
  };
}

router.get("/harvest-records", asyncHandler(async (req, res) => {
  const rows = await db("harvest_records").where({ farmer_id: req.auth!.userId })
    .orderBy("harvested_on", "desc").limit(300) as DbRecord[];
  res.json({ data: rows.map(harvestRecord) });
}));

router.post("/harvest-records", asyncHandler(async (req, res) => {
  const input = harvestSchema.parse(req.body);
  await assertFarmOwnership(req.auth!.userId, input.farmId, input.fieldId);
  const [row] = await db("harvest_records").insert({
    farmer_id: req.auth!.userId, farm_id: input.farmId ?? null, field_id: input.fieldId ?? null,
    crop_type: input.cropType, harvested_on: input.harvestedOn, quantity: input.quantity,
    unit: input.unit, plot_size_acres: input.plotSizeAcres ?? null,
    season: input.season, notes: input.notes,
  }).returning("*");
  res.status(201).json({ data: harvestRecord(row) });
}));

const weatherCodeLabels: Record<number, string> = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Drizzle",
  55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers",
  81: "Rain showers", 82: "Heavy rain showers", 95: "Thunderstorm",
  96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

async function requestWeatherProvider(url: URL, failureCode: string, failureMessage: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    throw new AppError(502, failureCode, failureMessage);
  }
}

router.get("/weather", weatherLimiter, asyncHandler(async (req, res) => {
  const input = z.object({ farmId: z.string().uuid() }).parse(req.query);
  const farm = await db("farms").where({ id: input.farmId, farmer_id: req.auth!.userId })
    .first("county", "location_description");
  if (!farm) throw new AppError(404, "FARM_NOT_FOUND", "This farm was not found.");
  const locationName = String(farm.location_description || farm.county).trim();
  const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodeUrl.search = new URLSearchParams({
    name: locationName, count: "10", language: "en", format: "json", countryCode: "KE",
  }).toString();
  const geocodeResponse = await requestWeatherProvider(
    geocodeUrl, "WEATHER_LOCATION_UNAVAILABLE", "The weather service could not find this farm's approximate location.",
  );
  if (!geocodeResponse.ok) throw new AppError(502, "WEATHER_LOCATION_UNAVAILABLE", "The weather service could not find this farm's approximate location.");
  const geocodeData = z.object({
    results: z.array(z.object({
      name: z.string(), latitude: z.number(), longitude: z.number(), country_code: z.string().optional(),
    })).optional(),
  }).parse(await geocodeResponse.json());
  const place = geocodeData.results?.find((item) => item.country_code?.toUpperCase() === "KE");
  if (!place) throw new AppError(404, "WEATHER_LOCATION_NOT_FOUND", "No approximate forecast location was found. Add a nearby town to the farm location and try again.");
  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.search = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
    hourly: "relative_humidity_2m,precipitation_probability",
    forecast_days: "7", timezone: "Africa/Nairobi",
  }).toString();
  const forecastResponse = await requestWeatherProvider(
    forecastUrl, "WEATHER_FORECAST_UNAVAILABLE", "The forecast provider is temporarily unavailable.",
  );
  if (!forecastResponse.ok) throw new AppError(502, "WEATHER_FORECAST_UNAVAILABLE", "The forecast provider is temporarily unavailable.");
  const forecast = z.object({
    daily: z.object({
      time: z.array(z.string()), weather_code: z.array(z.number()),
      temperature_2m_max: z.array(z.number()), temperature_2m_min: z.array(z.number()),
      precipitation_probability_max: z.array(z.number().nullable()),
      precipitation_sum: z.array(z.number()),
    }),
    hourly: z.object({
      time: z.array(z.string()), relative_humidity_2m: z.array(z.number().nullable()),
      precipitation_probability: z.array(z.number().nullable()),
    }),
  }).parse(await forecastResponse.json());
  const days = forecast.daily.time.map((date, index) => {
    const hoursForDay = forecast.hourly.time
      .map((time, hourIndex) => ({ time, humidity: forecast.hourly.relative_humidity_2m[hourIndex] ?? null }))
      .filter((hour) => hour.time.startsWith(date));
    const maxHumidity = hoursForDay.reduce<number | null>(
      (maximum, hour) => hour.humidity === null ? maximum : Math.max(maximum ?? 0, hour.humidity),
      null,
    );
    const weatherCode = forecast.daily.weather_code[index];
    const maximumC = forecast.daily.temperature_2m_max[index];
    const minimumC = forecast.daily.temperature_2m_min[index];
    const precipitationMm = forecast.daily.precipitation_sum[index];
    if (weatherCode === undefined || maximumC === undefined || minimumC === undefined || precipitationMm === undefined) {
      throw new AppError(502, "WEATHER_FORECAST_INVALID", "The forecast provider returned incomplete weather data.");
    }
    const rainProbability = forecast.daily.precipitation_probability_max[index] ?? 0;
    const rainAmount = precipitationMm;
    return {
      date, condition: weatherCodeLabels[weatherCode] ?? "Conditions unavailable",
      maximumC,
      minimumC,
      precipitationProbability: forecast.daily.precipitation_probability_max[index],
      precipitationMm: rainAmount,
      alerts: weatherAlerts({ rainProbability, precipitationMm: rainAmount, maximumC, maximumHumidity: maxHumidity }),
    };
  });
  res.json({
    data: {
      location: place.name,
      locationBasis: farm.location_description ? "nearest_town" : "county_search",
      provider: "Open-Meteo",
      updatedAt: new Date().toISOString(),
      days,
    },
  });
}));

export const farmerPlanningRouter = router;
