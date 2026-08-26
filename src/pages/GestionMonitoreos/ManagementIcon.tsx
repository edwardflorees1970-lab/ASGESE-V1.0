export function ManagementIcon({ type }: { type: "manage" | "requests" | "create" | "refresh" }) {
  if (type === "refresh") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5" />
        <path strokeLinecap="round" d="M6.1 8.5A7 7 0 0 1 18.6 7M17.9 15.5A7 7 0 0 1 5.4 17" />
      </svg>
    );
  }
  if (type === "create") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>;
  }
  if (type === "requests") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5h11v15H5V8m3-3v3H5l3-3Z" /><path strokeLinecap="round" d="M9 12h6M9 16h6" /></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8v3H8zM6 6H4v14h16V6h-2" /><path strokeLinecap="round" d="M8 12h8M8 16h5" /></svg>;
}
