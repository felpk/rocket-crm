import type { NextConfig } from "next";
import { execSync } from "child_process";

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_VERSION: commitHash,
  },
};

export default nextConfig;
