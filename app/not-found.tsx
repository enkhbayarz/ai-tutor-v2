import Link from "next/link";
import { AlertTriangle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-4">
      {/* 404 Text */}
      <h1 className="text-[120px] sm:text-[180px] font-bold text-blue-500 leading-none tracking-tight">
        404
      </h1>

      {/* Cat Illustration */}
      <div className="relative w-80 h-64 my-4">
        {/* Plant */}
        <svg
          className="absolute left-0 bottom-0 w-16 h-24"
          viewBox="0 0 64 96"
          fill="none"
        >
          {/* Pot */}
          <path
            d="M16 60 L48 60 L44 90 L20 90 Z"
            fill="#E07B39"
            stroke="#C66A2D"
            strokeWidth="2"
          />
          <ellipse cx="32" cy="60" rx="16" ry="4" fill="#C66A2D" />
          {/* Leaves */}
          <path
            d="M32 56 Q20 40 28 20 Q32 30 36 20 Q44 40 32 56"
            fill="#4ADE80"
            stroke="#22C55E"
            strokeWidth="1"
          />
          <path
            d="M32 50 Q18 35 22 15"
            fill="none"
            stroke="#22C55E"
            strokeWidth="2"
          />
          <path
            d="M32 50 Q46 35 42 15"
            fill="none"
            stroke="#22C55E"
            strokeWidth="2"
          />
        </svg>

        {/* Cat */}
        <svg
          className="absolute right-4 bottom-0 w-52 h-52"
          viewBox="0 0 200 200"
          fill="none"
        >
          {/* Body */}
          <ellipse cx="100" cy="150" rx="55" ry="35" fill="#F5A855" />
          {/* Body stripes */}
          <path
            d="M70 140 Q85 130 70 155"
            stroke="#E08B33"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M90 135 Q105 125 90 160"
            stroke="#E08B33"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M110 135 Q125 125 110 160"
            stroke="#E08B33"
            strokeWidth="4"
            fill="none"
          />

          {/* Head */}
          <circle cx="100" cy="85" r="45" fill="#F5A855" />
          {/* Head stripes */}
          <path
            d="M75 70 Q85 60 75 85"
            stroke="#E08B33"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M125 70 Q115 60 125 85"
            stroke="#E08B33"
            strokeWidth="3"
            fill="none"
          />

          {/* Ears */}
          <path d="M60 55 L75 40 L80 65 Z" fill="#F5A855" />
          <path d="M65 55 L75 45 L77 60 Z" fill="#FFB6C1" />
          <path d="M140 55 L125 40 L120 65 Z" fill="#F5A855" />
          <path d="M135 55 L125 45 L123 60 Z" fill="#FFB6C1" />

          {/* Face */}
          {/* Eyes */}
          <ellipse cx="82" cy="80" rx="8" ry="10" fill="white" />
          <ellipse cx="118" cy="80" rx="8" ry="10" fill="white" />
          <circle cx="84" cy="82" r="5" fill="#333" />
          <circle cx="120" cy="82" r="5" fill="#333" />
          <circle cx="85" cy="80" r="2" fill="white" />
          <circle cx="121" cy="80" r="2" fill="white" />

          {/* Nose */}
          <ellipse cx="100" cy="95" rx="5" ry="4" fill="#FFB6C1" />

          {/* Mouth */}
          <path
            d="M100 99 L100 105"
            stroke="#333"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M95 108 Q100 112 105 108"
            stroke="#333"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Whiskers */}
          <path d="M65 90 L82 92" stroke="#333" strokeWidth="1.5" />
          <path d="M65 95 L82 95" stroke="#333" strokeWidth="1.5" />
          <path d="M65 100 L82 98" stroke="#333" strokeWidth="1.5" />
          <path d="M135 90 L118 92" stroke="#333" strokeWidth="1.5" />
          <path d="M135 95 L118 95" stroke="#333" strokeWidth="1.5" />
          <path d="M135 100 L118 98" stroke="#333" strokeWidth="1.5" />

          {/* Front paws */}
          <ellipse cx="70" cy="175" rx="12" ry="8" fill="#F5A855" />
          <ellipse cx="130" cy="175" rx="12" ry="8" fill="#F5A855" />
          <path d="M65 172 L68 178" stroke="#E08B33" strokeWidth="2" />
          <path d="M70 172 L70 178" stroke="#E08B33" strokeWidth="2" />
          <path d="M75 172 L72 178" stroke="#E08B33" strokeWidth="2" />
          <path d="M125 172 L128 178" stroke="#E08B33" strokeWidth="2" />
          <path d="M130 172 L130 178" stroke="#E08B33" strokeWidth="2" />
          <path d="M135 172 L132 178" stroke="#E08B33" strokeWidth="2" />

          {/* Tail with yarn */}
          <path
            d="M155 150 Q175 140 185 160 Q190 175 175 180"
            stroke="#F5A855"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />

          {/* Yarn ball */}
          <circle cx="45" cy="165" r="18" fill="#FF6B6B" />
          <path
            d="M32 158 Q45 150 58 158"
            stroke="#E05555"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M30 165 Q45 175 60 165"
            stroke="#E05555"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M35 172 Q45 180 55 172"
            stroke="#E05555"
            strokeWidth="2"
            fill="none"
          />
          {/* Yarn string */}
          <path
            d="M60 155 Q80 145 75 170 Q70 190 50 180"
            stroke="#FF6B6B"
            strokeWidth="3"
            fill="none"
          />
        </svg>
      </div>

      {/* Text */}
      <div className="text-center mt-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center justify-center gap-2">
          Page Not Found
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
        </h2>
        <p className="text-gray-500 mt-2 max-w-md">
          We couldn&apos;t find the page you are looking for. It might have been
          removed or moved.
        </p>
      </div>

      {/* Button */}
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-full px-8 h-10 bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
      >
        <Home className="w-4 h-4" />
        Back to home page
      </Link>
    </div>
  );
}
