import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/admin/customers/*/ai-review': ['./node_modules/pdfjs-dist/legacy/build/pdf.mjs', './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
  experimental: {
    // Server Action 기본 본문 제한(1MB) 상향. 단, Vercel 서버리스는
    // 4.5MB 하드 제한이 있어 대용량 파일은 브라우저 직접 업로드를 사용.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
