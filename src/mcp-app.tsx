/**
 * TASE End of Day Data Visualization App
 * Displays Tel Aviv Stock Exchange end of day data with interactive sorting using TanStack Table.
 */
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "./mcp-app.module.css";

interface StockData {
  tradeDate: string;
  symbol: string;
  change: number | null;              // percentage change
  turnover: number | null;
  closingPrice: number | null;
  basePrice: number | null;
  openingPrice: number | null;
  high: number | null;
  low: number | null;
  changeValue: number | null;
  volume: number | null;
  marketCap: number | null;
  minContPhaseAmount: number | null;
  listedCapital: number | null;
  marketType: string | null;
  // Technical indicators
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  cci20: number | null;
  mfi14: number | null;
  turnover10: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  stddev20: number | null;
  upperBollingerBand20: number | null;
  lowerBollingerBand20: number | null;
}

interface MarketData {
  timestamp: string;
  marketSummary: {
    totalStocks: number;
    gainers: number;
    losers: number;
    unchanged: number;
    totalVolume: number;
  };
  stocks: StockData[];
}

function extractMarketData(callToolResult: CallToolResult): MarketData | null {
  const textContent = callToolResult.content?.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") return null;
  try {
    return JSON.parse(textContent.text) as MarketData;
  } catch {
    return null;
  }
}

function formatPrice(price: number): string {
  return price.toFixed(2);
}

function formatPercent(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

function formatVolume(volume: number): string {
  if (volume >= 1000000000) {
    return `${(volume / 1000000000).toFixed(1)}B`;
  }
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US").format(volume);
}

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null) return "—";
  return value.toFixed(decimals);
}

// Create column helper for type-safe column definitions
const columnHelper = createColumnHelper<StockData>();

function TaseApp() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: "TASE End of Day", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.onteardown = async () => {
        console.info("App is being torn down");
        return {};
      };

      app.ontoolinput = async (input) => {
        console.info("Received tool call input:", input);
      };

      app.ontoolresult = async (result) => {
        console.info("Received tool call result:", result);
        const data = extractMarketData(result);
        if (data) {
          setMarketData(data);
        }
      };

      app.ontoolcancelled = (params) => {
        console.info("Tool call cancelled:", params.reason);
      };

      app.onerror = console.error;

      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };
    },
  });

  // Apply host styles for theme integration
  useHostStyles(app ?? null);

  useEffect(() => {
    if (app) {
      setHostContext(app.getHostContext());
    }
  }, [app]);

  if (error) return <div className={styles.error}><strong>ERROR:</strong> {error.message}</div>;
  if (!app) return <div className={styles.loading}>Connecting...</div>;

  return (
    <TaseAppInner
      app={app}
      marketData={marketData}
      hostContext={hostContext}
    />
  );
}

interface TaseAppInnerProps {
  app: App;
  marketData: MarketData | null;
  hostContext?: McpUiHostContext;
}

function TaseAppInner({
  app,
  marketData,
  hostContext,
}: TaseAppInnerProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "symbol", desc: false },
  ]);

  const handleRefresh = useCallback(async () => {
    try {
      console.info("Calling get-tase-data tool...");
      await app.callServerTool({
        name: "get-tase-data",
        arguments: {},
      });
    } catch (e) {
      console.error("Failed to refresh data:", e);
    }
  }, [app]);

  // CRITICAL: Memoize columns to prevent infinite re-renders
  const columns = useMemo(
    () => [
      // Basic info
      columnHelper.accessor("symbol", {
        header: "Symbol",
        cell: (info) => (
          <span className={styles.symbolCell}>{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("marketType", {
        header: "Type",
        cell: (info) => <span className={styles.textCell}>{info.getValue() ?? "—"}</span>,
      }),
      // Price data
      columnHelper.accessor("closingPrice", {
        header: "Close",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("openingPrice", {
        header: "Open",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("high", {
        header: "High",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("low", {
        header: "Low",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("basePrice", {
        header: "Base",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      // Change
      columnHelper.accessor("changeValue", {
        header: "Chg",
        cell: (info) => {
          const value = info.getValue() ?? 0;
          const className = value > 0 ? styles.positive : value < 0 ? styles.negative : "";
          return (
            <span className={`${styles.numericCell} ${className}`}>
              {value > 0 ? "+" : ""}{formatPrice(value)}
            </span>
          );
        },
      }),
      columnHelper.accessor("change", {
        header: "Chg%",
        cell: (info) => {
          const value = info.getValue() ?? 0;
          const className = value > 0 ? styles.positive : value < 0 ? styles.negative : "";
          return (
            <span className={`${styles.numericCell} ${className}`}>
              {formatPercent(value)}
            </span>
          );
        },
      }),
      // Volume & Turnover
      columnHelper.accessor("volume", {
        header: "Volume",
        cell: (info) => (
          <span className={styles.numericCell}>{formatVolume(Number(info.getValue() ?? 0))}</span>
        ),
      }),
      columnHelper.accessor("turnover", {
        header: "Turnover",
        cell: (info) => (
          <span className={styles.numericCell}>{formatVolume(Number(info.getValue() ?? 0))}</span>
        ),
      }),
      columnHelper.accessor("turnover10", {
        header: "Turn10",
        cell: (info) => (
          <span className={styles.numericCell}>{formatVolume(Number(info.getValue() ?? 0))}</span>
        ),
      }),
      // Market data
      columnHelper.accessor("marketCap", {
        header: "Mkt Cap",
        cell: (info) => (
          <span className={styles.numericCell}>{formatVolume(Number(info.getValue() ?? 0))}</span>
        ),
      }),
      columnHelper.accessor("listedCapital", {
        header: "Listed Cap",
        cell: (info) => (
          <span className={styles.numericCell}>{formatVolume(Number(info.getValue() ?? 0))}</span>
        ),
      }),
      columnHelper.accessor("minContPhaseAmount", {
        header: "Min Cont",
        cell: (info) => (
          <span className={styles.numericCell}>{formatVolume(Number(info.getValue() ?? 0))}</span>
        ),
      }),
      // Technical indicators - Momentum
      columnHelper.accessor("rsi14", {
        header: "RSI14",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("mfi14", {
        header: "MFI14",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("cci20", {
        header: "CCI20",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      // MACD
      columnHelper.accessor("macd", {
        header: "MACD",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("macdSignal", {
        header: "MACD Sig",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("macdHist", {
        header: "MACD Hist",
        cell: (info) => {
          const value = info.getValue();
          const className = value !== null ? (value > 0 ? styles.positive : value < 0 ? styles.negative : "") : "";
          return (
            <span className={`${styles.numericCell} ${className}`}>{formatNumber(value)}</span>
          );
        },
      }),
      // Moving averages
      columnHelper.accessor("sma20", {
        header: "SMA20",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("sma50", {
        header: "SMA50",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("sma200", {
        header: "SMA200",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      // Bollinger bands
      columnHelper.accessor("upperBollingerBand20", {
        header: "BB Upper",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("lowerBollingerBand20", {
        header: "BB Lower",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("stddev20", {
        header: "StdDev20",
        cell: (info) => (
          <span className={styles.numericCell}>{formatNumber(info.getValue())}</span>
        ),
      }),
      // Date
      columnHelper.accessor("tradeDate", {
        header: "Date",
        cell: (info) => <span className={styles.textCell}>{info.getValue()}</span>,
      }),
    ],
    []
  );

  // CRITICAL: Memoize data to prevent infinite re-renders
  const data = useMemo(() => marketData?.stocks ?? [], [marketData?.stocks]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <main
      className={styles.main}
      style={{
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      <div className={styles.header}>
        <h1 className={styles.title}>TASE End of Day</h1>
        {marketData && (
          <span className={styles.timestamp}>
            Updated: {new Date(marketData.timestamp).toLocaleString()}
          </span>
        )}
      </div>

      {marketData && (
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Total Stocks</div>
            <div className={styles.summaryValue}>
              {marketData.marketSummary.totalStocks}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Gainers</div>
            <div className={`${styles.summaryValue} ${styles.gainers}`}>
              {marketData.marketSummary.gainers}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Losers</div>
            <div className={`${styles.summaryValue} ${styles.losers}`}>
              {marketData.marketSummary.losers}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Total Volume</div>
            <div className={styles.summaryValue}>
              {formatVolume(marketData.marketSummary.totalVolume)}
            </div>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <button onClick={handleRefresh}>Refresh Data</button>
      </div>

      {!marketData ? (
        <div className={styles.loading}>Waiting for data...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ cursor: "pointer" }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {{
                        asc: " ▲",
                        desc: " ▼",
                      }[header.column.getIsSorted() as string] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.tableInfo}>
        Showing {table.getRowModel().rows.length} stocks
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TaseApp />
  </StrictMode>,
);
