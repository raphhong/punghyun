import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['tesseract.js','tesseract.js-core','@napi-rs/canvas'],
  outputFileTracingIncludes: {'/api/**': ['./tests/fixtures/ocr-runtime/*','./node_modules/@tesseract.js-data/kor/**/*','./node_modules/@tesseract.js-data/eng/**/*','./node_modules/tesseract.js/src/worker-script/**/*','./node_modules/tesseract.js-core/**/*']},
  experimental: {
    // Server Action 기본 본문 제한(1MB) 상향. 단, Vercel 서버리스는
    // 4.5MB 하드 제한이 있어 대용량 파일은 브라우저 직접 업로드를 사용.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
