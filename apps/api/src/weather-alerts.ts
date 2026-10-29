export function weatherAlerts(input: {
  rainProbability: number;
  precipitationMm: number;
  maximumC: number;
  maximumHumidity: number | null;
}): string[] {
  const alerts: string[] = [];
  if (input.rainProbability >= 60 || input.precipitationMm >= 10) {
    alerts.push("Rain is likely; check drainage and avoid unnecessary watering.");
  }
  if (
    (input.maximumHumidity ?? 0) >= 80 &&
    (input.rainProbability >= 40 || input.precipitationMm > 0)
  ) {
    alerts.push("Humid, wet conditions may favor some crop diseases; scout leaves and improve airflow where practical.");
  }
  if (input.maximumC >= 34 && input.precipitationMm < 1) {
    alerts.push("Hot, dry conditions are forecast; check soil moisture and young plants.");
  }
  return alerts;
}
