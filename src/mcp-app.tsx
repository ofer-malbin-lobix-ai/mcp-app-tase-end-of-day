/**
 * TASE End of Day Data Visualization App
 * Displays Tel Aviv Stock Exchange end of day data with interactive sorting and filtering.
 */
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "./mcp-app.module.css";

interface StockData {
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
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

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function formatPrice(price: number): string {
  return price.toFixed(2);
}

function formatPercent(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(0)}K`;
  }
  return formatNumber(volume);
}

function TaseApp() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();
  const [sortBy, setSortBy] = useState<string>("symbol");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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
      sortBy={sortBy}
      setSortBy={setSortBy}
      sortOrder={sortOrder}
      setSortOrder={setSortOrder}
    />
  );
}

interface TaseAppInnerProps {
  app: App;
  marketData: MarketData | null;
  hostContext?: McpUiHostContext;
  sortBy: string;
  setSortBy: (value: string) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (value: "asc" | "desc") => void;
}

function TaseAppInner({
  app,
  marketData,
  hostContext,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}: TaseAppInnerProps) {
  const handleRefresh = useCallback(async () => {
    try {
      console.info("Calling get-tase-data tool...");
      const result = await app.callServerTool({
        name: "get-tase-data",
        arguments: { sortBy, sortOrder },
      });
      console.info("get-tase-data result:", result);
      const data = extractMarketData(result);
      if (data) {
        // Data will be set via ontoolresult handler
      }
    } catch (e) {
      console.error("Failed to refresh data:", e);
    }
  }, [app, sortBy, sortOrder]);

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder(column === "symbol" || column === "name" ? "asc" : "desc");
    }
  }, [sortBy, sortOrder, setSortBy, setSortOrder]);

  // Sort stocks locally for immediate UI feedback
  const sortedStocks = marketData?.stocks.slice().sort((a, b) => {
    const aVal = a[sortBy as keyof StockData];
    const bVal = b[sortBy as keyof StockData];
    const comparison = typeof aVal === "string"
      ? aVal.localeCompare(bVal as string)
      : (aVal as number) - (bVal as number);
    return sortOrder === "desc" ? -comparison : comparison;
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
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort("symbol")}>
                Symbol {sortBy === "symbol" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("name")}>
                Name {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("lastPrice")}>
                Last {sortBy === "lastPrice" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("change")}>
                Change {sortBy === "change" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("changePercent")}>
                % {sortBy === "changePercent" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("volume")}>
                Volume {sortBy === "volume" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedStocks?.map((stock) => (
              <tr key={stock.symbol}>
                <td className={styles.symbolCell}>{stock.symbol}</td>
                <td className={styles.nameCell}>{stock.name}</td>
                <td className={styles.priceCell}>{formatPrice(stock.lastPrice)}</td>
                <td
                  className={`${styles.changeCell} ${
                    stock.change > 0 ? styles.positive : stock.change < 0 ? styles.negative : ""
                  }`}
                >
                  {stock.change > 0 ? "+" : ""}{formatPrice(stock.change)}
                </td>
                <td
                  className={`${styles.changeCell} ${
                    stock.changePercent > 0 ? styles.positive : stock.changePercent < 0 ? styles.negative : ""
                  }`}
                >
                  {formatPercent(stock.changePercent)}
                </td>
                <td className={styles.volumeCell}>{formatVolume(stock.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TaseApp />
  </StrictMode>,
);
