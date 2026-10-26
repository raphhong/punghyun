import { notFound } from "next/navigation";

export const metadata = { title: "초단기렌탈", robots: { index: false, follow: false } };

export default function SevenDayPage() {
  // Intake is available only through an existing customer's /s/{token}/seven-day link.
  notFound();
}
