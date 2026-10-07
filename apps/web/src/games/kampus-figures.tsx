/**
 * Figurki postaci Kampus Tour (kolejność jak KAMPUS_CHARACTERS): płaskie sylwetki w currentColor.
 * Rekwizyt musi być dużym kształtem, bo na polu figurka ma ok. 25 px.
 * `cut` to kolor tła pod figurką: obrys w tym kolorze oddziela nachodzące na siebie kształty.
 */
const HEAD = <circle cx="16" cy="8" r="4.5" />;
const BODY = <path d="M10 26v-7a6 6 0 0 1 12 0v7zM11 26h4v4h-4zM17 26h4v4h-4z" />;

const FIGURES = [
  // Z plecakiem: plecak za plecami, wystaje z boku.
  <>
    <rect x="5" y="14" width="7" height="11" rx="2" />
    {HEAD}
    <path className="cut" d="M10 26v-7a6 6 0 0 1 12 0v7z" />
    <path d="M11 26h4v4h-4zM17 26h4v4h-4z" />
  </>,
  // Z kawą: kubek w wyciągniętej ręce i para nad nim.
  <>
    {HEAD}
    {BODY}
    <path d="M20 17l5 1.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <rect className="cut" x="23" y="13" width="6" height="7" rx="1.2" />
    <path d="M25 11c-1-1 1-2 0-3.5M27.5 11c-1-1 1-2 0-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
  </>,
  // Na hulajnodze: krótsze nogi na desce, kierownica z przodu.
  <>
    <circle cx="14" cy="8" r="4.5" />
    <path d="M8 24v-5a6 6 0 0 1 12 0v5zM9 24h4v3.5h-4zM15 24h4v3.5h-4z" />
    <path d="M18 16l6-2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M6 28h18l2-15M23 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle className="cut" cx="7.5" cy="29.5" r="2" />
    <circle className="cut" cx="23.5" cy="29.5" r="2" />
  </>,
  // Z laptopem: otwarty laptop przed sobą.
  <>
    {HEAD}
    {BODY}
    <rect className="cut" x="8" y="16" width="16" height="10" rx="1.2" />
    <rect className="cut" x="5" y="26" width="22" height="2.2" rx="1.1" />
  </>,
  // W słuchawkach: pałąk nad głową i duże nauszniki.
  <>
    {HEAD}
    {BODY}
    <path d="M10.5 8.5a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.8" fill="none" />
    <rect className="cut" x="8.5" y="6.5" width="3.5" height="5.5" rx="1.4" />
    <rect className="cut" x="20" y="6.5" width="3.5" height="5.5" rx="1.4" />
    <path d="M26 21v-7l3-1v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="25" cy="21" r="1.6" />
    <circle cx="28" cy="19" r="1.6" />
  </>,
  // Z książkami: stos trzech książek w rękach.
  <>
    {HEAD}
    {BODY}
    <rect className="cut" x="8" y="15.5" width="15" height="3.2" rx="0.8" />
    <rect className="cut" x="9.5" y="18.7" width="15" height="3.2" rx="0.8" />
    <rect className="cut" x="7.5" y="21.9" width="16" height="3.2" rx="0.8" />
  </>,
];

export function Figure({
  character,
  size,
  cut,
  color,
  className,
}: {
  character: number;
  size: number;
  cut: string;
  /** Kolor sylwetki; domyślnie dziedziczony (currentColor). */
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      // Kształty z klasą .cut dostają obrys w kolorze tła (index.css), żeby rekwizyt nie zlewał się z sylwetką.
      style={{ ["--cut" as string]: cut, color }}
      aria-hidden
    >
      {FIGURES[character % FIGURES.length]}
    </svg>
  );
}
