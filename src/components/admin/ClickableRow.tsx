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
      data-clickable
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button,input,select,textarea,summary")) return;
        if (window.getSelection()?.toString()) return;
        router.push(href);
      }}
      className="cursor-pointer"
    >
      {children}
    </tr>
  );
}
