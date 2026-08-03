export const EXECUTIVE_CHART_COLORS = [
  "#008fbd",
  "#2563d4",
  "#7a46cc",
  "#0b9662",
  "#d38300",
  "#cf3931",
  "#3f789f",
] as const;

export const EXECUTIVE_CHART = {
  primary: EXECUTIVE_CHART_COLORS[0],
  secondary: EXECUTIVE_CHART_COLORS[3],
  warning: EXECUTIVE_CHART_COLORS[4],
  grid: "rgba(155, 174, 189, 0.14)",
  cursor: "rgba(134, 174, 190, 0.18)",
  tick: "#9bafbf",
  label: "#d7e0e7",
} as const;
