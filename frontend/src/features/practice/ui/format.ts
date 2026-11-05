const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "today", "yesterday", "3 days ago", or a date for older times. */
export function formatRelativeDate(timestamp: number | null, now = Date.now()): string {
    if (timestamp === null) return "Never";
    const diffMs = timestamp - now;
    const minutes = Math.round(diffMs / 60000);
    if (Math.abs(minutes) < 60) return minutes === 0 ? "Just now" : capitalize(relativeFormat.format(minutes, "minute"));
    const hours = Math.round(diffMs / 3600000);
    if (Math.abs(hours) < 24) return capitalize(relativeFormat.format(hours, "hour"));
    const days = Math.round(diffMs / 86400000);
    if (Math.abs(days) < 7) return capitalize(relativeFormat.format(days, "day"));
    return new Date(timestamp).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatPercent(value: number | null): string {
    return value === null ? "–" : `${Math.round(value)} %`;
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
