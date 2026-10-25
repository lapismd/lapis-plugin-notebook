<script lang="ts">
  import type { ColumnSummary } from "./dataframe-types";

  const CONCAT_CHART_HEIGHT = 30;
  const CONCAT_CHART_WIDTH = 70;
  const CONCAT_NULL_BAR_WIDTH = 5;
  const MAX_BAR_HEIGHT = 20;
  const BAR_COLOR = "var(--color-green)";
  const NULL_BAR_COLOR = "var(--color-orange)";
  const MUTED_TEXT_COLOR = "var(--text-muted)";
  const UNHOVERED_BAR_OPACITY = 0.6;
  const BOOLEAN_BAR_HEIGHT = 11;

  type PreviewBar = {
    label?: string;
    count: number;
    isNull?: boolean;
  };

  let {
    summary,
    variant = "detail",
  }: {
    summary: ColumnSummary;
    variant?: "compact" | "detail";
  } = $props();

  let maxHistogramCount = $derived.by(() => {
    if (!previewBars.length) {
      return 0;
    }

    return Math.max(...previewBars.map((bucket) => bucket.count));
  });

  let previewTotal = $derived.by(() =>
    previewBars.reduce((sum, bucket) => sum + bucket.count, 0),
  );

  let previewBars = $derived.by<PreviewBar[]>(() => {
    if (summary.type === "number" || summary.type === "date") {
      return "histogram" in summary
        ? summary.histogram.map((bucket) => ({ count: bucket.count }))
        : [];
    }

    if (summary.type === "boolean") {
      const values: PreviewBar[] = [
        { label: "true", count: summary.trueCount },
        { label: "false", count: summary.falseCount },
      ];

      if (summary.nullCount > 0) {
        values.push({ label: "null", count: summary.nullCount, isNull: true });
      }

      return values;
    }

    if (summary.type === "string") {
      return summary.topValues.slice(0, 4).map((item) => ({
        label: item.value,
        count: item.count,
      }));
    }

    return [];
  });

  function formatCount(value: number): string {
    return new Intl.NumberFormat().format(value);
  }

  function formatNumber(value: number | null): string {
    if (value == null) {
      return "-";
    }

    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatDate(value: string | null): string {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function compactBarHeight(count: number): number {
    if (maxHistogramCount === 0) {
      return 0;
    }

    return Math.max(3, (count / maxHistogramCount) * MAX_BAR_HEIGHT);
  }

  function segmentWidth(count: number): number {
    if (previewTotal === 0) {
      return 0;
    }

    return (count / previewTotal) * 100;
  }

  function compactStringLabel(label: string | undefined): string {
    if (!label) {
      return "";
    }

    return label === "null" ? "Null" : label;
  }

  function compactStringText(label: string | undefined, count: number): string {
    const normalized = compactStringLabel(label);
    const countLabel = formatCount(count);
    return normalized ? `${normalized}: ${countLabel}` : countLabel;
  }

  function clippedStringLabel(
    label: string | undefined,
    count: number,
  ): string {
    const width = segmentWidth(count);
    const normalized = compactStringLabel(label);

    if (!normalized || width <= 10) {
      return "";
    }

    if (width > 50) {
      return normalized.slice(0, 8);
    }

    if (width > 20) {
      return normalized.slice(0, 3);
    }

    return normalized.slice(0, 1);
  }
</script>

{#if variant === "compact"}
  <div
    class="notebook-dataframe__summary-compact"
    style={`color: ${MUTED_TEXT_COLOR};`}
  >
    {#if (summary.type === "number" || summary.type === "date") && previewBars.length}
      <div
        class="notebook-dataframe__summary-chart"
        style={`width: ${CONCAT_CHART_WIDTH + (summary.nullCount > 0 ? CONCAT_NULL_BAR_WIDTH + 1 : 0)}px; height: ${CONCAT_CHART_HEIGHT}px;`}
      >
        {#if summary.nullCount > 0}
          <div
            class="notebook-dataframe__summary-null-bar"
            style={`width: ${CONCAT_NULL_BAR_WIDTH}px; height: ${compactBarHeight(summary.nullCount)}px; background-color: ${NULL_BAR_COLOR}; opacity: 0.6;`}
            title={`${summary.nullCount} null values`}
          ></div>
        {/if}
        <div
          class="notebook-dataframe__summary-bars"
          style={`width: ${CONCAT_CHART_WIDTH}px; height: ${CONCAT_CHART_HEIGHT}px;`}
        >
          {#each previewBars as bucket}
            <div
              class="notebook-dataframe__summary-bar"
              style={`height: ${compactBarHeight(bucket.count)}px; background-color: ${BAR_COLOR}; opacity: 0.6;`}
              title={`${bucket.count} values`}
            ></div>
          {/each}
        </div>
      </div>

      <div class="notebook-dataframe__summary-range">
        {#if summary.type === "number"}
          <span>{formatNumber(summary.min)}</span>
          {#if summary.min !== summary.max}
            <span>-{formatNumber(summary.max)}</span>
          {/if}
        {:else}
          <span>{formatDate(summary.min)}</span>
          {#if summary.min !== summary.max}
            <span>-{formatDate(summary.max)}</span>
          {/if}
        {/if}
      </div>
    {:else if summary.type === "string"}
      <div class="notebook-dataframe__summary-range notebook-dataframe__summary-range--start">
        <span>unique: {formatCount(summary.distinctCount)}</span>
      </div>
    {:else if summary.type === "boolean" && previewBars.length}
      <div class="notebook-dataframe__summary-boolean">
        {#each previewBars as bucket}
          <div class="notebook-dataframe__summary-boolean-row">
            <span
              class="notebook-dataframe__summary-boolean-label"
              style={`color: ${MUTED_TEXT_COLOR};`}
            >
              {bucket.label}
            </span>
            <div
              class="notebook-dataframe__summary-boolean-track"
              style={`height: ${BOOLEAN_BAR_HEIGHT}px;`}
            >
              <div
                class="notebook-dataframe__summary-boolean-fill"
                style={`width: ${segmentWidth(bucket.count)}%; background-color: ${bucket.isNull ? NULL_BAR_COLOR : BAR_COLOR}; color: ${MUTED_TEXT_COLOR}; min-width: ${bucket.count > 0 ? 18 : 0}px; opacity: ${UNHOVERED_BAR_OPACITY};`}
                title={`${bucket.label}: ${formatCount(bucket.count)}`}
              >
                {#if segmentWidth(bucket.count) >= 20}
                  {formatCount(bucket.count)}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="notebook-dataframe__summary-range">
        {#if summary.type === "number"}
          <span>{formatNumber(summary.min)}</span>
          {#if summary.min !== summary.max}
            <span>-{formatNumber(summary.max)}</span>
          {/if}
        {:else if summary.type === "date"}
          <span>{formatDate(summary.min)}</span>
          {#if summary.min !== summary.max}
            <span>-{formatDate(summary.max)}</span>
          {/if}
        {:else if summary.type === "boolean"}
          <span>true: {formatCount(summary.trueCount)}</span>
          <span>false: {formatCount(summary.falseCount)}</span>
        {:else}
          <span>nulls: {formatCount(summary.nullCount)}</span>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <div
    class="notebook-dataframe__column-summary"
  >
    <div class="notebook-dataframe__summary-heading">
      <div class="notebook-dataframe__summary-label">{summary.label}</div>
      <div class="notebook-dataframe__summary-kind">
        {summary.type}
      </div>
    </div>

    <dl class="notebook-dataframe__summary-grid">
      <div>
        <dt class="notebook-dataframe__summary-term">Rows</dt>
        <dd class="notebook-dataframe__summary-value">
          {formatCount(summary.rowCount)}
        </dd>
      </div>
      <div>
        <dt class="notebook-dataframe__summary-term">Distinct</dt>
        <dd class="notebook-dataframe__summary-value">
          {formatCount(summary.distinctCount)}
        </dd>
      </div>
      <div>
        <dt class="notebook-dataframe__summary-term">Non-null</dt>
        <dd class="notebook-dataframe__summary-value">
          {formatCount(summary.nonNullCount)}
        </dd>
      </div>
      <div>
        <dt class="notebook-dataframe__summary-term">Missing</dt>
        <dd class="notebook-dataframe__summary-value">
          {formatCount(summary.nullCount)}
        </dd>
      </div>
    </dl>

    {#if summary.type === "number"}
      <dl class="notebook-dataframe__summary-grid">
        <div>
          <dt class="notebook-dataframe__summary-term">Min</dt>
          <dd class="notebook-dataframe__summary-value">
            {formatNumber(summary.min)}
          </dd>
        </div>
        <div>
          <dt class="notebook-dataframe__summary-term">Max</dt>
          <dd class="notebook-dataframe__summary-value">
            {formatNumber(summary.max)}
          </dd>
        </div>
        <div>
          <dt class="notebook-dataframe__summary-term">Mean</dt>
          <dd class="notebook-dataframe__summary-value">
            {formatNumber(summary.mean)}
          </dd>
        </div>
        <div>
          <dt class="notebook-dataframe__summary-term">Median</dt>
          <dd class="notebook-dataframe__summary-value">
            {formatNumber(summary.median)}
          </dd>
        </div>
      </dl>
    {:else if summary.type === "boolean"}
      <dl class="notebook-dataframe__summary-grid">
        <div>
          <dt class="notebook-dataframe__summary-term">True</dt>
          <dd class="notebook-dataframe__summary-value">
            {formatCount(summary.trueCount)}
          </dd>
        </div>
        <div>
          <dt class="notebook-dataframe__summary-term">False</dt>
          <dd class="notebook-dataframe__summary-value">
            {formatCount(summary.falseCount)}
          </dd>
        </div>
      </dl>
    {:else if summary.type === "date"}
      <dl class="notebook-dataframe__summary-grid notebook-dataframe__summary-grid--single">
        <div>
          <dt class="notebook-dataframe__summary-term">Min date</dt>
          <dd class="notebook-dataframe__summary-value">{formatDate(summary.min)}</dd>
        </div>
        <div>
          <dt class="notebook-dataframe__summary-term">Max date</dt>
          <dd class="notebook-dataframe__summary-value">{formatDate(summary.max)}</dd>
        </div>
      </dl>
    {:else if summary.type === "string"}
      <div class="notebook-dataframe__summary-section">
        <div
          class="notebook-dataframe__summary-section-title"
        >
          Top values
        </div>
        <ul class="notebook-dataframe__summary-top-list">
          {#each summary.topValues as item}
            <li class="notebook-dataframe__summary-top-row">
              <span
                class="notebook-dataframe__summary-top-value"
                title={item.value}>{item.value}</span
              >
              <span class="notebook-dataframe__summary-value"
                >{formatCount(item.count)}</span
              >
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if previewBars.length}
      <div class="notebook-dataframe__summary-section">
        <div
          class="notebook-dataframe__summary-section-title"
        >
          Distribution
        </div>
        <div
          class="notebook-dataframe__distribution"
        >
          {#each previewBars as bucket}
            <div
              class="notebook-dataframe__distribution-bar"
              style:height={`${maxHistogramCount === 0 ? 0 : Math.max(8, (bucket.count / maxHistogramCount) * 100)}%`}
              title={`${bucket.count} values${bucket.label ? ` for ${bucket.label}` : ""}`}
            ></div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
