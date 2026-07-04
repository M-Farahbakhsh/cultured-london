// The Cultured roundel — a homage to London's most recognisable piece of
// graphic design. Pure inline SVG so it's crisp at any size, zero requests.
export default function Roundel({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Cultured London">
      <circle cx="50" cy="50" r="37" fill="none" stroke="#E32017" strokeWidth="15" />
      <rect x="0" y="40.5" width="100" height="19" rx="2.5" fill="#1A1817" />
      <text
        x="50"
        y="54.8"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="13"
        fontWeight="700"
        letterSpacing="2.2"
        fontFamily="Inter, system-ui, sans-serif"
      >
        CULTURED
      </text>
    </svg>
  )
}
