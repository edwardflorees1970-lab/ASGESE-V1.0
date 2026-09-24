export type AppRole = "admin" | "user" | "jefe_area" | "director" | "responsable_cdd" | string | null | undefined;

export function isAdminRole(role: AppRole) {
  return role === "admin";
}

export function canSeeAllRole(role: AppRole) {
  return role === "admin" || role === "jefe_area" || role === "director";
}

export function canManageOnlyAdmin(role: AppRole) {
  return role === "admin";
}

export function roleLabel(role: AppRole) {
  if (role === "admin") return "Administrador";
  if (role === "jefe_area") return "Jefe de area";
  if (role === "director") return "Director(a)";
  if (role === "responsable_cdd") return "Responsable CdD";
  if (role === "director_iiee") return "Director IIEE";
  if (role && !["user"].includes(role)) return String(role).replaceAll("_", " ");
  return "Especialista";
}
