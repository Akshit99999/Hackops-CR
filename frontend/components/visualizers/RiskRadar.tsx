const labels = [
  "Dispute autonomy",
  "Account security",
  "Liability balance",
  "Data sovereignty",
  "Transparency",
];
export function RiskRadar({ values }: { values: number[] }) {
  const point = (index: number, value: number) => {
    const angle = ((index * 72 - 90) * Math.PI) / 180;
    return [160 + Math.cos(angle) * value, 145 + Math.sin(angle) * value];
  };
  return (
    <svg
      viewBox="0 0 320 290"
      className="risk-radar"
      role="img"
      aria-label={`Contract balance: ${labels.map((label, i) => `${label} ${values[i]} out of 100`).join(", ")}`}
    >
      {[25, 50, 75, 100].map((value) => (
        <polygon
          key={value}
          points={labels.map((_, i) => point(i, value).join(",")).join(" ")}
          fill="none"
          stroke="#1E293B"
          strokeWidth="1"
        />
      ))}
      {labels.map((_, i) => (
        <line
          key={i}
          x1="160"
          y1="145"
          x2={point(i, 100)[0]}
          y2={point(i, 100)[1]}
          stroke="#1E293B"
        />
      ))}
      <polygon
        points={values.map((value, i) => point(i, value).join(",")).join(" ")}
        fill="#06B6D433"
        stroke="#06B6D4"
        strokeWidth="2"
      />
      {values.map((value, i) => (
        <circle
          key={i}
          cx={point(i, value)[0]}
          cy={point(i, value)[1]}
          r="3"
          fill="#06B6D4"
        />
      ))}
      {labels.map((label, i) => (
        <text
          key={label}
          x={point(i, 125)[0]}
          y={point(i, 125)[1] + 4}
          textAnchor="middle"
          fill="#94A3B8"
          fontSize="9"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
