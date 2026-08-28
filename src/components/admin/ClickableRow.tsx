"use client";

import { useRouter } from "next/navigation";

export function ClickableRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer hover:bg-navy-50"
    >
      {children}
    </tr>
  );
}
