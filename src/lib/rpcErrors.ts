export function isMissingRpc(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "PGRST202" || /function .* does not exist|schema cache/i.test(error?.message ?? "");
}

