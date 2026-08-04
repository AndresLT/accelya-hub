"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { RefreshButton } from "@/components/ui/RefreshButton";

type Desk = {
  desk_id: string;
  code: string;
  zone: string;
  sort_order: number;
  pos_x: number;
  pos_y: number;
  booked: boolean;
  booked_by_name: string | null;
  is_mine: boolean;
};

export type DeskDay = {
  date: string; // YYYY-MM-DD (America/Bogota)
  title: string; // "Today" | "Tomorrow"
  subtitle: string;
  desks: Desk[];
};

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded ${swatch}`} />
      {label}
    </span>
  );
}

/**
 * Interactive desk map (UCD1–UCD5). Desks are rendered on a schematic SVG
 * floor plan at their pos_x/pos_y (data-driven — a real floor plan later
 * just re-sets those coordinates). Tap an available desk to book, tap your
 * own to release; taken desks show who's there. All rules are enforced by
 * book_desk()/cancel_desk() in the database.
 */
export function DeskBooking({ days }: { days: DeskDay[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [activeIdx, setActiveIdx] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const day = days[activeIdx];

  // Bounding box per zone, to draw the labelled zone blocks behind the desks.
  const zones = useMemo(() => {
    const box = new Map<
      string,
      { minX: number; maxX: number; minY: number; maxY: number }
    >();
    for (const d of day.desks) {
      const b = box.get(d.zone);
      if (!b) {
        box.set(d.zone, { minX: d.pos_x, maxX: d.pos_x, minY: d.pos_y, maxY: d.pos_y });
      } else {
        b.minX = Math.min(b.minX, d.pos_x);
        b.maxX = Math.max(b.maxX, d.pos_x);
        b.minY = Math.min(b.minY, d.pos_y);
        b.maxY = Math.max(b.maxY, d.pos_y);
      }
    }
    return [...box.entries()].map(([zone, b]) => ({ zone, ...b }));
  }, [day]);

  const myDesk = day.desks.find((d) => d.is_mine) ?? null;

  async function activate(desk: Desk) {
    if (pendingId) return;
    if (desk.booked && !desk.is_mine) return; // taken by someone else

    setPendingId(desk.desk_id);
    try {
      if (desk.is_mine) {
        const { error } = await supabase.rpc("cancel_desk", { p_date: day.date });
        if (error) throw error;
        toast.success("Your desk was released.");
      } else {
        const { error } = await supabase.rpc("book_desk", {
          p_desk_id: desk.desk_id,
          p_date: day.date,
        });
        if (error) throw error;
        toast.success(`Desk ${desk.code} booked.`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-bg-3 bg-bg-1 p-1">
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                i === activeIdx
                  ? "bg-acc-blue text-tx-1-c"
                  : "text-tx-2 hover:text-tx-1"
              }`}
            >
              {d.title}
              <span className="ml-1 hidden font-normal opacity-80 sm:inline">
                · {d.subtitle}
              </span>
            </button>
          ))}
        </div>
        <RefreshButton disabled={pendingId !== null} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-tx-2">
          {myDesk ? (
            <>
              Your desk for {day.title.toLowerCase()}:{" "}
              <span className="font-semibold text-tx-1">{myDesk.code}</span> —
              tap it to release.
            </>
          ) : (
            <>Tap an available desk to book it for {day.title.toLowerCase()}.</>
          )}
        </p>
        <div className="flex items-center gap-4 text-xs text-tx-3">
          <Legend swatch="border border-acc-teal bg-bg-1" label="Available" />
          <Legend swatch="bg-acc-blue" label="Yours" />
          <Legend swatch="bg-bg-3" label="Taken" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-bg-3 bg-bg-2 p-3">
        <svg
          viewBox="0 -3 100 54"
          className="w-full"
          style={{ minWidth: 520 }}
          role="group"
          aria-label={`Desk map for ${day.title}`}
        >
          {zones.map((z) => (
            <g key={z.zone}>
              <rect
                x={z.minX - 5}
                y={z.minY - 9}
                width={z.maxX - z.minX + 10}
                height={z.maxY - z.minY + 14}
                rx={2}
                style={{
                  fill: "var(--color-bg-1)",
                  stroke: "var(--color-bg-3)",
                }}
                strokeWidth={0.3}
              />
              <text
                x={(z.minX + z.maxX) / 2}
                y={z.minY - 6}
                textAnchor="middle"
                style={{
                  fill: "var(--color-tx-3)",
                  fontSize: 2.2,
                  fontWeight: 700,
                }}
              >
                Zone {z.zone}
              </text>
            </g>
          ))}

          {day.desks.map((d) => {
            const mine = d.is_mine;
            const takenByOther = d.booked && !mine;
            const interactive = !takenByOther && pendingId === null;
            const rectStyle = mine
              ? { fill: "var(--color-acc-blue)", stroke: "var(--color-acc-blue)" }
              : takenByOther
                ? { fill: "var(--color-bg-3)", stroke: "var(--color-bg-3)" }
                : { fill: "var(--color-bg-1)", stroke: "var(--color-acc-teal)" };
            const textFill = mine
              ? "var(--color-tx-1-c)"
              : takenByOther
                ? "var(--color-tx-3)"
                : "var(--color-tx-1)";
            const label = mine
              ? `Desk ${d.code}, yours — tap to release`
              : takenByOther
                ? `Desk ${d.code}, taken by ${d.booked_by_name ?? "someone"}`
                : `Desk ${d.code}, available — tap to book`;

            return (
              <g
                key={d.desk_id}
                role="button"
                tabIndex={interactive ? 0 : -1}
                aria-label={label}
                aria-disabled={!interactive}
                onClick={() => interactive && activate(d)}
                onKeyDown={(e) => {
                  if (interactive && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    activate(d);
                  }
                }}
                className={`desk-marker ${
                  interactive ? "cursor-pointer" : "cursor-default"
                }`}
                style={{ opacity: pendingId === d.desk_id ? 0.5 : 1 }}
              >
                <title>{label}</title>
                <rect
                  x={d.pos_x - 3.25}
                  y={d.pos_y - 3.25}
                  width={6.5}
                  height={6.5}
                  rx={1.2}
                  style={rectStyle}
                  strokeWidth={0.35}
                />
                <rect
                  className="desk-focus-ring"
                  x={d.pos_x - 3.9}
                  y={d.pos_y - 3.9}
                  width={7.8}
                  height={7.8}
                  rx={1.5}
                />
                <text
                  x={d.pos_x}
                  y={d.pos_y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fill: textFill, fontSize: 2.4, pointerEvents: "none" }}
                >
                  {d.sort_order}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
