"use client";

type Level = "basico" | "detalhado" | "completo";

interface Props {
  value: Level;
  onChange: (level: Level) => void;
}

const LEVELS: Array<{ value: Level; label: string }> = [
  { value: "basico", label: "Basico" },
  { value: "detalhado", label: "Detalhado" },
  { value: "completo", label: "Completo" },
];

export default function LevelSelector({ value, onChange }: Props) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10">
      {LEVELS.map((level) => (
        <button
          key={level.value}
          type="button"
          onClick={() => onChange(level.value)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            value === level.value
              ? "bg-accent text-white"
              : "bg-white/10 text-white/60 hover:bg-white/15"
          }`}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}
