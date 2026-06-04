type IconProps = {
  className?: string;
};

export function GuitarIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 4.5 8 3l-1.5 1.5L8 6l1.5-1.5" />
      <path d="M14.5 4.5 16 3l1.5 1.5L16 6l-1.5-1.5" />
      <path d="M12 6v3" />
      <path d="M8.5 9.5c-1.2 2.2-.8 5.2 1 7.2 1.2 1.3 2.8 2 4.5 2s3.3-.7 4.5-2c1.8-2 2.2-5 .9-7.2" />
      <circle cx="12" cy="16.5" r="2.2" />
    </svg>
  );
}

export function SpeakerIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18 6.5a8 8 0 0 1 0 11" />
    </svg>
  );
}
