import { Building2, MapPin, UserRound } from "lucide-react";
import type { ProspectBrief } from "../types/prospect";
import { Card, Chip, ScoreRing } from "./ui";

const recoTone = {
  contact: { label: "Contact now", tone: "good" as const },
  maybe: { label: "Maybe", tone: "warn" as const },
  skip: { label: "Skip", tone: "bad" as const },
};

export function BriefView({ brief }: { brief: ProspectBrief }) {
  const reco = recoTone[brief.recommendation];
  return (
    <div className="space-y-3">
      <Card className="surface-strong">
        <div className="flex items-start gap-3">
          <ScoreRing score={brief.matchScore} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
              <Building2 size={11} />
              Prospect
            </div>
            <h2 className="mt-0.5 truncate text-base font-semibold" style={{ color: "var(--text)" }}>
              {brief.companyName || "Unknown"}
            </h2>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{brief.sectorOrRole}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone={reco.tone}>{reco.label}</Chip>
              {brief.location ? (
                <Chip>
                  <MapPin size={10} />
                  {brief.location}
                </Chip>
              ) : null}
              {brief.decisionMaker ? (
                <Chip tone="accent">
                  <UserRound size={10} />
                  {brief.decisionMaker}
                </Chip>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <p className="label">Why this score</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{brief.matchReason}</p>
      </Card>

      {brief.signals.length > 0 ? (
        <Card>
          <p className="label">Signals on the page</p>
          <ul className="space-y-1.5">
            {brief.signals.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--text)" }}>
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <p className="label">Best angle</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{brief.angle}</p>
      </Card>

      <Card glow>
        <p className="label">Personalization hook</p>
        <p className="text-xs italic leading-relaxed" style={{ color: "var(--text)" }}>"{brief.personalizationHook}"</p>
      </Card>
    </div>
  );
}
