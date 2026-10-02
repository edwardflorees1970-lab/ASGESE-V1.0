import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // .claude/worktrees contiene copias completas del repo: sus tests no son
    // los de este checkout.
    exclude: [...configDefaults.exclude, ".claude/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/roles.ts",
        "src/lib/monitoreoVigencia.ts",
        "src/lib/dynamicHeader.ts",
        "src/lib/rpcErrors.ts",
        "src/lib/analyticsReportExport.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
