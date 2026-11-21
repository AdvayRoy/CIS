export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 9" className={className} fill="#D4FF4A" aria-hidden shapeRendering="crispEdges">
      <rect x="2" y="0" width="6" height="2" />
      <rect x="0" y="2" width="2" height="5" />
      <rect x="2" y="7" width="6" height="2" />
      <rect x="4" y="3.5" width="2" height="2" />
    </svg>
  );
}
