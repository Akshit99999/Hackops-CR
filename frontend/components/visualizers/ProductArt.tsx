"use client";
import { useId } from "react";
import type { WarrantyItem } from "@/lib/types";

export function ProductArt({
  category,
  className = "",
}: {
  category: WarrantyItem["category"];
  className?: string;
}) {
  const artId = useId().replace(/:/g, "");
  return (
    <div
      className={`product-art product-${category.toLowerCase()} ${className}`}
      aria-hidden="true"
    >
      {category === "Audio" && (
        <svg viewBox="0 0 240 170" fill="none">
          <defs>
            <linearGradient
              id={`${artId}-headphoneMetal`}
              x1="60"
              y1="20"
              x2="180"
              y2="160"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#87847f" />
              <stop offset=".5" stopColor="#3b3b39" />
              <stop offset="1" stopColor="#77736b" />
            </linearGradient>
          </defs>
          <ellipse cx="120" cy="150" rx="53" ry="8" fill="#000" opacity=".25" />
          <path
            d="M67 103V77a53 53 0 0 1 106 0v26"
            stroke="#202120"
            strokeWidth="19"
          />
          <path
            d="M68 82v-5a52 52 0 0 1 104 0v5"
            stroke={`url(#${artId}-headphoneMetal)`}
            strokeWidth="10"
          />
          <rect
            x="52"
            y="83"
            width="33"
            height="57"
            rx="15"
            fill="#252725"
            transform="rotate(-8 52 83)"
          />
          <rect
            x="158"
            y="80"
            width="33"
            height="57"
            rx="15"
            fill="#252725"
            transform="rotate(8 158 80)"
          />
          <rect
            x="60"
            y="88"
            width="15"
            height="47"
            rx="7"
            fill={`url(#${artId}-headphoneMetal)`}
            transform="rotate(-8 60 88)"
          />
          <rect
            x="167"
            y="87"
            width="15"
            height="47"
            rx="7"
            fill={`url(#${artId}-headphoneMetal)`}
            transform="rotate(8 167 87)"
          />
        </svg>
      )}
      {category === "Home" && (
        <svg viewBox="0 0 240 170" fill="none">
          <defs>
            <linearGradient
              id={`${artId}-coffeeMetal`}
              x1="80"
              y1="60"
              x2="160"
              y2="135"
            >
              <stop stopColor="#bdb3a0" />
              <stop offset="1" stopColor="#7e7566" />
            </linearGradient>
          </defs>
          <ellipse cx="120" cy="151" rx="52" ry="7" fill="#000" opacity=".2" />
          <path d="M83 30h55l15 102H81z" fill="#252824" />
          <rect x="82" y="27" width="58" height="9" rx="4" fill="#4c5047" />
          <path d="M99 75h43l-3 57H95z" fill={`url(#${artId}-coffeeMetal)`} />
          <path
            d="M141 84h8c19 0 19 31-5 31"
            stroke="#b0a48f"
            strokeWidth="6"
          />
          <path d="M100 60h30l-8 15h-14z" fill="#8b8172" />
          <rect x="72" y="132" width="91" height="12" rx="5" fill="#33362f" />
          <rect x="91" y="139" width="56" height="5" rx="2" fill="#666b5c" />
        </svg>
      )}
      {category === "Computing" && (
        <svg viewBox="0 0 240 170" fill="none">
          <defs>
            <linearGradient
              id={`${artId}-laptopScreen`}
              x1="90"
              y1="30"
              x2="180"
              y2="130"
            >
              <stop stopColor="#767e66" />
              <stop offset=".6" stopColor="#343e32" />
              <stop offset="1" stopColor="#b2a481" />
            </linearGradient>
          </defs>
          <ellipse cx="120" cy="147" rx="82" ry="6" fill="#000" opacity=".2" />
          <rect x="57" y="35" width="126" height="90" rx="5" fill="#454943" />
          <rect
            x="62"
            y="40"
            width="116"
            height="79"
            rx="2"
            fill={`url(#${artId}-laptopScreen)`}
          />
          <path
            d="m62 110 30-51 24 38 19-25 43 48H62z"
            fill="#91a07d"
            opacity=".35"
          />
          <path d="M57 125h126l24 16H33z" fill="#a5a59b" />
          <path d="M33 141h174l-5 5H38z" fill="#64685d" />
          <path d="M102 133h36l5 6H97z" fill="#878b80" />
        </svg>
      )}
      {category === "Other" && (
        <svg viewBox="0 0 240 170" fill="none">
          <ellipse cx="120" cy="148" rx="48" ry="7" fill="#000" opacity=".2" />
          <rect x="81" y="35" width="78" height="106" rx="26" fill="#555b4b" />
          <rect x="88" y="42" width="64" height="92" rx="22" fill="#343a30" />
          <circle cx="120" cy="88" r="24" stroke="#a5aa94" strokeWidth="2" />
          <path
            d="M120 71v17l10 9"
            stroke="#a5aa94"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
