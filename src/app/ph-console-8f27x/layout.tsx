import type { Metadata } from "next";

// 어드민 전체: 검색엔진 색인 차단
export const metadata: Metadata = {
  title: "풍현 관리자",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
