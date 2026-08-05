type IconName = "bolt" | "loop" | "switch" | "shield" | "check" | "arrow";

const paths: Record<IconName, React.ReactNode> = {
  bolt: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
  loop: (
    <>
      <path d="M17 2.1 21 6l-4 3.9" />
      <path d="M3 12a7 7 0 0 1 7-7h11" />
      <path d="M7 21.9 3 18l4-3.9" />
      <path d="M21 12a7 7 0 0 1-7 7H3" />
    </>
  ),
  switch: (
    <>
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h14a4 4 0 0 1 0 8h-2" />
      <path d="m17 20 4-4-4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({
  name,
  className = "h-6 w-6",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
