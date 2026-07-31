export const EXECUTIVE_CHART_COLORS = [
  "#0088b5",
  "#245fc1",
  "#7044bc",
  "#087a54",
  "#c87500",
  "#c83f36",
  "#486b8a",
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
