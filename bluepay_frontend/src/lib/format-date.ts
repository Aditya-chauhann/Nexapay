export function formatIst(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "—";
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${date}, ${time} IST`;
}

export function formatIstParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
  return { date, time: `${time} IST` };
}

