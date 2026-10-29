export function explainSoilPh(ph: number | null, cropType: string): string {
  if (ph === null) return "No pH recorded; request a soil test if pH guidance is needed.";
  if (ph < 5.5) {
    return `pH ${ph} is acidic. Ask the lab or extension officer to compare it with the target for ${cropType} and your soil type before considering amendments.`;
  }
  if (ph > 7.5) {
    return `pH ${ph} is alkaline. Ask whether pH may affect nutrient availability for ${cropType} on this soil.`;
  }
  return `pH ${ph} is in a broad middle range. Compare it with the target for ${cropType} and your soil type.`;
}

export function explainNutrients(
  cropType: string,
  hasResults: boolean,
  units: string,
): string {
  if (!hasResults) {
    return `No N/P/K lab results recorded. Ask for a soil test and a crop-specific interpretation for ${cropType}.`;
  }
  return `Bring the N/P/K results${units ? ` (${units})` : ""} to the lab or extension officer and ask how each compares with the local ${cropType} target.`;
}
