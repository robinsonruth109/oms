"use client";

import { useMemo, useState } from "react";

export type HourlyAgentCalls = {
  id: string;
  name: string;
  username: string;
  hourlyCalls: number[];
};

type ChartMode = "calls" | "share";

const COLORS = [
  "#2563eb", "#059669", "#e11d48", "#7c3aed", "#d97706",
  "#0891b2", "#db2777", "#4f46e5", "#65a30d", "#ea580c",
  "#0d9488", "#9333ea",
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const LEFT = 66;
const TOP = 30;
const PLOT_HEIGHT = 238;
const PLOT_BOTTOM = TOP + PLOT_HEIGHT;
const STEP = 46;
const BAR_WIDTH = 29;
const CHART_WIDTH = LEFT + STEP * 24 + 16;
const CHART_HEIGHT = 338;

function labelForHour(hour: number) {
  const clock = hour % 12 || 12;
  return clock + ":00 " + (hour < 12 ? "AM" : "PM");
}

function number(value: number) {
  return value.toLocaleString("en-BD");
}

export default function HourlyCallingChart({
  agents,
  from,
  to,
}: {
  agents: HourlyAgentCalls[];
  from: string;
  to: string;
}) {
  const [mode, setMode] = useState<ChartMode>("calls");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const totals = useMemo(
    () => HOURS.map((hour) =>
      agents.reduce((sum, agent) => sum + (agent.hourlyCalls[hour] || 0), 0)
    ),
    [agents]
  );
  const totalCalls = totals.reduce((sum, count) => sum + count, 0);
  const largest = Math.max(...totals);
  const peakHour = totals.indexOf(largest);
  const activeHour = hoveredHour ?? selectedHour ?? peakHour;
  const maxCalls = Math.max(4, Math.ceil(largest / 4) * 4);
  const maxY = mode === "share" ? 100 : maxCalls;
  const hasData = totalCalls > 0;

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Hourly Calling Activity
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Calls grouped by the Bangladesh-time hour of <strong>Called At</strong>.
            Each colour represents one agent.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {from} to {to}
            {from !== to ? " · Calls from multiple dates are combined by clock hour." : ""}
          </p>
        </div>
        <div className="inline-flex rounded-xl border bg-slate-50 p-1 text-sm" aria-label="Chart display mode">
          <button
            type="button"
            onClick={() => setMode("calls")}
            aria-pressed={mode === "calls"}
            className={
              "rounded-lg px-3 py-2 font-semibold transition " +
              (mode === "calls"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-white")
            }
          >
            Calls / Hour
          </button>
          <button
            type="button"
            onClick={() => setMode("share")}
            aria-pressed={mode === "share"}
            className={
              "rounded-lg px-3 py-2 font-semibold transition " +
              (mode === "share"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-white")
            }
          >
            Agent Share %
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b bg-slate-50/70 px-5 py-4 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-xs font-medium text-slate-500">Calls in selected period</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{number(totalCalls)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Busiest clock hour</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {hasData ? labelForHour(peakHour) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Calls during busiest hour</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{hasData ? number(largest) : "—"}</p>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pt-5 sm:px-6">
            {agents.map((agent, index) => (
              <div key={agent.id} className="inline-flex items-center gap-2 text-xs text-slate-700">
                <span className="h-3 w-3 flex-none rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{agent.name} (@{agent.username})</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto px-2 pt-3 pb-2 sm:px-4">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-auto min-w-[960px] w-full"
              role="img"
              aria-label={
                mode === "calls"
                  ? "Hourly stacked bar chart of calls by agent, 12 AM through 11 PM Bangladesh time."
                  : "Hourly stacked bar chart of each agent's percentage of calls during that hour."
              }
            >
              {HOURS.slice(0, 5).map((index) => {
                const tick = (maxY / 4) * index;
                const y = PLOT_BOTTOM - (PLOT_HEIGHT / 4) * index;
                return (
                  <g key={index}>
                    <line x1={LEFT - 8} x2={CHART_WIDTH - 12} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={index ? "4 4" : undefined} />
                    <text x={LEFT - 15} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">
                      {mode === "share" ? tick + "%" : number(tick)}
                    </text>
                  </g>
                );
              })}

              {HOURS.map((hour) => {
                const total = totals[hour];
                const x = LEFT + STEP * hour + (STEP - BAR_WIDTH) / 2;
                const focused = activeHour === hour;
                let stackBottom = PLOT_BOTTOM;
                return (
                  <g
                    key={hour}
                    role="button"
                    tabIndex={0}
                    aria-label={labelForHour(hour) + ": " + number(total) + " calls. Show agent breakdown."}
                    aria-pressed={focused}
                    onMouseEnter={() => setHoveredHour(hour)}
                    onMouseLeave={() => setHoveredHour(null)}
                    onFocus={() => setHoveredHour(hour)}
                    onBlur={() => setHoveredHour(null)}
                    onClick={() => setSelectedHour(hour)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedHour(hour);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    {focused ? (
                      <rect
                        x={x - 5}
                        y={TOP - 7}
                        width={BAR_WIDTH + 10}
                        height={PLOT_HEIGHT + 14}
                        rx="7"
                        fill="#dbeafe"
                        opacity="0.65"
                      />
                    ) : null}

                    {agents.map((agent, index) => {
                      const count = agent.hourlyCalls[hour] || 0;
                      const scaled = mode === "share"
                        ? (total ? (count / total) * 100 : 0)
                        : count;
                      const height = (scaled / maxY) * PLOT_HEIGHT;
                      stackBottom -= height;
                      return height > 0 ? (
                        <rect
                          key={agent.id}
                          x={x}
                          y={stackBottom}
                          width={BAR_WIDTH}
                          height={height}
                          fill={COLORS[index % COLORS.length]}
                          stroke="white"
                          strokeWidth="0.8"
                        />
                      ) : null;
                    })}

                    <rect
                      x={x - 5}
                      y={TOP - 7}
                      width={BAR_WIDTH + 10}
                      height={PLOT_HEIGHT + 14}
                      fill="transparent"
                    />
                    <text x={x + BAR_WIDTH / 2} y={PLOT_BOTTOM + 23} textAnchor="middle" fontSize="11" fontWeight={focused ? 700 : 400} fill={focused ? "#0f172a" : "#64748b"}>
                      {String(hour).padStart(2, "0")}
                    </text>
                  </g>
                );
              })}
              <text x={LEFT - 15} y={CHART_HEIGHT - 17} textAnchor="start" fontSize="12" fill="#64748b">
                Clock hour (Asia/Dhaka, 00–23)
              </text>
            </svg>
          </div>

          <div className="border-t bg-slate-50/80 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {labelForHour(activeHour)} – {labelForHour((activeHour + 1) % 24)}
              </h3>
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900">{number(totals[activeHour])}</strong> calls
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {mode === "share"
                ? "Percentages are each agent's share of all calls during this hour."
                : "Select or hover over another hour for agent-level counts and shares."}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent, index) => {
                const count = agent.hourlyCalls[activeHour] || 0;
                const share = totals[activeHour] ? (count / totals[activeHour]) * 100 : 0;
                return (
                  <div key={agent.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="truncate text-slate-700">{agent.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-slate-900">
                      {number(count)}
                      <span className="ml-1 font-normal text-slate-500">({share.toFixed(1)}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="px-5 py-12 text-center text-sm text-slate-500">
          No calls were recorded within the selected Called At date range.
        </div>
      )}
    </section>
  );
}
