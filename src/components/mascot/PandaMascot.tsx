import React from 'react';

export interface PandaMascotProps {
  expression?: 'happy' | 'curious' | 'looking_left' | 'looking_right' | 'blinking' | 'celebrating';
  speechText?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  showName?: boolean;
}

export const PandaMascot: React.FC<PandaMascotProps> = ({
  expression = 'happy',
  speechText = null,
  size = 'md',
  className = '',
  onClick,
  showName = true,
}) => {
  const sizeMap = {
    sm: 'w-20 h-20',
    md: 'w-28 h-28',
    lg: 'w-44 h-44',
  };

  // Pupil offsets based on gaze direction
  let pupilOffsetX = 0;
  let pupilOffsetY = 0;
  if (expression === 'looking_left') pupilOffsetX = -6;
  if (expression === 'looking_right') pupilOffsetX = 6;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Friendly Speech Bubble */}
      {speechText && (
        <div className="mb-2 max-w-xs animate-bounce-subtle rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-md backdrop-blur-sm border border-emerald-100 z-10 text-center">
          <p className="leading-snug">{speechText}</p>
          {/* Arrow pointing down toward Panda */}
          <div className="mx-auto -mb-3 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-white" />
        </div>
      )}

      {/* Interactive Panda Body / Avatar */}
      <div
        onClick={onClick}
        className={`${sizeMap[size]} relative flex items-center justify-center transition-transform duration-300 hover:scale-105 ${
          onClick ? 'cursor-pointer' : ''
        }`}
      >
        <svg
          viewBox="0 0 120 120"
          className="h-full w-full drop-shadow-md overflow-visible"
          role="img"
          aria-label="Bao the panda"
        >
          <defs>
            <radialGradient id="pandaFur" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="85%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </radialGradient>
            <radialGradient id="pandaEar" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </radialGradient>
            <radialGradient id="bambooGreen" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </radialGradient>
          </defs>

          {/* Panda Left Ear */}
          <circle cx="28" cy="28" r="17" fill="url(#pandaEar)" stroke="#0F172A" strokeWidth="1.5" />
          <circle cx="29" cy="29" r="10" fill="#1E293B" opacity="0.6" />

          {/* Panda Right Ear */}
          <circle cx="92" cy="28" r="17" fill="url(#pandaEar)" stroke="#0F172A" strokeWidth="1.5" />
          <circle cx="91" cy="29" r="10" fill="#1E293B" opacity="0.6" />

          {/* Panda Head Base */}
          <ellipse cx="60" cy="62" rx="43" ry="39" fill="url(#pandaFur)" stroke="#CBD5E1" strokeWidth="1.5" />

          {/* Left Black Eye Patch (tilted oval) */}
          <ellipse
            cx="44"
            cy="56"
            rx="12.5"
            ry="15"
            transform="rotate(-18 44 56)"
            fill="#0F172A"
          />

          {/* Right Black Eye Patch (tilted oval) */}
          <ellipse
            cx="76"
            cy="56"
            rx="12.5"
            ry="15"
            transform="rotate(18 76 56)"
            fill="#0F172A"
          />

          {/* Eyes inside patches */}
          {expression === 'blinking' ? (
            <>
              {/* Happy curved blink lines */}
              <path d="M 38 56 Q 44 62 50 56" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
              <path d="M 70 56 Q 76 62 82 56" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : expression === 'celebrating' ? (
            <>
              {/* Starry celebratory eyes */}
              <text x="37" y="62" fontSize="16" fill="#FDE047" textAnchor="middle">✨</text>
              <text x="75" y="62" fontSize="16" fill="#FDE047" textAnchor="middle">✨</text>
            </>
          ) : (
            <>
              {/* Left Eye Sclera & Pupil */}
              <ellipse cx="44" cy="55" rx="5.5" ry="6.5" fill="#FFFFFF" />
              <circle cx={44 + pupilOffsetX} cy={55 + pupilOffsetY} r="3.6" fill="#0F172A" />
              <circle cx={42.5 + pupilOffsetX} cy={53.5 + pupilOffsetY} r="1.4" fill="#FFFFFF" />

              {/* Right Eye Sclera & Pupil */}
              <ellipse cx="76" cy="55" rx="5.5" ry="6.5" fill="#FFFFFF" />
              <circle cx={76 + pupilOffsetX} cy={55 + pupilOffsetY} r="3.6" fill="#0F172A" />
              <circle cx={74.5 + pupilOffsetX} cy={53.5 + pupilOffsetY} r="1.4" fill="#FFFFFF" />
            </>
          )}

          {/* Soft Snout Area */}
          <ellipse cx="60" cy="72" rx="16" ry="12" fill="#FFFFFF" />

          {/* Cute Panda Nose */}
          <path
            d="M 54 69 Q 60 67 66 69 Q 63 75 60 76 Q 57 75 54 69 Z"
            fill="#0F172A"
          />

          {/* Sweet Smile */}
          <path
            d="M 55 77 Q 60 82 65 77"
            fill="none"
            stroke="#0F172A"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Rosy Pastel Cheeks */}
          <ellipse cx="30" cy="69" rx="6" ry="4" fill="#FDA4AF" opacity="0.65" />
          <ellipse cx="90" cy="69" rx="6" ry="4" fill="#FDA4AF" opacity="0.65" />

          {/* Little Bamboo Sprout / Scout Bandana */}
          <path d="M 44 94 L 76 94 L 60 108 Z" fill="url(#bambooGreen)" stroke="#047857" strokeWidth="1" />
          <circle cx="60" cy="98" r="3.5" fill="#FEF08A" />
        </svg>
      </div>

      {showName && (
        <span className="mt-1 text-xs font-bold tracking-wider text-emerald-800 uppercase font-['Quicksand']">
          Bao the Panda
        </span>
      )}
    </div>
  );
};

// Backwards-compatible alias for existing code
export const PipMascot = PandaMascot;
export default PandaMascot;
