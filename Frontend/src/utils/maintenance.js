export function getMaintenanceTypeLabel(value) {
  if (value === "compressor") return "Compresseur";
  if (value === "robot_2") return "Robot de traite 2";
  return "Robot de traite 1";
}

export function formatMaintenanceKitLabel(intervention) {
  const kitLabel = intervention?.maintenance_kit_label;
  if (!kitLabel) return "";
  if (intervention?.maintenance_type === "compressor") return kitLabel;
  if (/^Robot de traite [12] - /.test(kitLabel)) return kitLabel;
  return `${getMaintenanceTypeLabel(intervention?.maintenance_type)} - ${kitLabel}`;
}
