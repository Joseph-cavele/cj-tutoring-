'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  RecentResult,
  SubjectPerformance,
  TopicPerformance,
} from '@/services/performance.service';

/**
 * Performance charts (brief sections 22 and 15).
 *
 * COLOUR
 * One mark colour, the brand blue, and nothing else. Every chart here is a
 * SINGLE series - one student's percentage - so there is no identity to encode
 * and no categorical palette to cycle. #1b4fd8 passes the lightness band,
 * chroma floor and the 3:1 contrast check against both the white card and the
 * cream page behind it.
 *
 * Colouring bars by score band was the obvious temptation and is deliberately
 * avoided: that would be a status encoding carried by colour alone, and the
 * weak-topic list that sits beside these charts already names the problem
 * areas in words.
 *
 * READING WITHOUT THE CHART
 * The panel that renders these also lists every subject and topic with its
 * number, so nothing here is the only way to reach a value. The charts are the
 * shape; the lists are the table view.
 *
 * Text never wears the series colour - labels and values stay in the navy and
 * slate ink tokens, and the blue mark beside them carries the data.
 */

const MARK = '#1b4fd8';
const INK = '#152a5e';
const MUTED = '#5a6785';
const GRID = '#d8e3fb';

/** The NSC pass mark, drawn as the reference every score is read against. */
const PASS_MARK = 50;

const axisTick = { fill: MUTED, fontSize: 12 };

function ChartFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <h3 className="text-[16px] font-bold text-brand-navy">{title}</h3>
      <p className="mt-0.5 text-[13px] text-brand-slate">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Shared tooltip, so all three charts read the same way. */
function ChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: { value?: number | string; payload?: Record<string, unknown> }[];
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  const count = point.payload?.testCount as number | undefined;

  return (
    <div className="rounded-xl border border-brand-blue-100 bg-white px-3 py-2 shadow-[var(--shadow-soft)]">
      <p className="text-[13px] font-bold text-brand-navy">{label}</p>
      <p className="text-[13px] text-brand-slate">
        {point.value}%{suffix ? ` ${suffix}` : ''}
        {count !== undefined ? ` · ${count} test${count === 1 ? '' : 's'}` : ''}
      </p>
    </div>
  );
}

/**
 * Score over time (brief section 22).
 *
 * `recent` arrives newest first, because that is the order the dashboard list
 * wants. A time axis must run the other way, so it is reversed here - plotting
 * it as given would draw every student's progress backwards.
 */
export function ScoreTrendChart({ recent }: { recent: RecentResult[] }) {
  // One point is not a trend, and a line through it says nothing.
  if (recent.length < 2) return null;

  const data = [...recent]
    .reverse()
    .map((result) => ({
      label: new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short' }).format(
        new Date(result.completedAt)
      ),
      percentage: result.percentage,
      testTitle: result.testTitle,
    }));

  return (
    <ChartFrame
      title="Scores over time"
      description={`The last ${data.length} marked tests, oldest first. The dashed line is 50%.`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
            unit="%"
          />
          <ReferenceLine y={PASS_MARK} stroke={MUTED} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: MUTED, strokeDasharray: '3 3' }}
            content={<ChartTooltip />}
          />
          <Line
            type="monotone"
            dataKey="percentage"
            stroke={MARK}
            strokeWidth={2}
            // Markers big enough to hit on a phone, ringed in the surface
            // colour so a point sitting on the line stays legible.
            dot={{ r: 4, fill: MARK, stroke: '#ffffff', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: MARK, stroke: '#ffffff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Horizontal bars, because subject and topic names do not fit under a tick. */
function MagnitudeBars({
  data,
  height,
}: {
  data: { label: string; percentage: number; testCount: number }[];
  height: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 36, bottom: 0, left: 0 }}
        // 2px of surface between adjacent bars.
        barCategoryGap={6}
      >
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          unit="%"
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: INK, fontSize: 13 }}
          tickLine={false}
          axisLine={false}
          width={112}
        />
        <ReferenceLine x={PASS_MARK} stroke={MUTED} strokeDasharray="4 4" />
        <Tooltip cursor={{ fill: '#eef3fe' }} content={<ChartTooltip suffix="average" />} />
        <Bar
          dataKey="percentage"
          // Rounded only at the data end; the baseline end stays square so the
          // bar is anchored rather than floating.
          radius={[0, 4, 4, 0]}
          barSize={18}
          // The value on each bar, so a number is never colour-only.
          label={{
            position: 'right',
            fill: MUTED,
            fontSize: 12,
            formatter: (value: unknown) => `${value}%`,
          }}
        >
          {data.map((entry) => (
            <Cell key={entry.label} fill={MARK} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SubjectChart({ bySubject }: { bySubject: SubjectPerformance[] }) {
  if (bySubject.length === 0) return null;

  const data = bySubject.map((subject) => ({
    label: subject.subjectName,
    percentage: subject.averagePercentage,
    testCount: subject.testCount,
  }));

  return (
    <ChartFrame title="Average by subject" description="Every marked test, grouped by subject.">
      <MagnitudeBars data={data} height={Math.max(140, data.length * 44)} />
    </ChartFrame>
  );
}

export function TopicChart({ byTopic }: { byTopic: TopicPerformance[] }) {
  // Already sorted weakest first by the service, so the top of the chart is
  // where the attention needs to go. Eight is as many labels as fit legibly.
  const data = byTopic.slice(0, 8).map((topic) => ({
    label: topic.topic,
    percentage: topic.averagePercentage,
    testCount: topic.testCount,
  }));

  if (data.length === 0) return null;

  return (
    <ChartFrame
      title="Average by topic"
      description="Weakest first. Anything under the dashed 50% line needs work."
    >
      <MagnitudeBars data={data} height={Math.max(140, data.length * 40)} />
    </ChartFrame>
  );
}
