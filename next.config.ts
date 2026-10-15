import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The asset importer reads the assets/ folder at runtime - ship it with traced/standalone builds.
  outputFileTracingIncludes: { "/*": ["./assets/**/*"] },
};

module.exports = {
  allowedDevOrigins: ['dominiksliwek.duckdns.org'],
}

export default nextConfig;
