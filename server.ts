import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// API base URL
const TASE_API_URL = "https://www.professorai.app/api/mcp-endpoint/tase-data-hub/eod/rows/market/date";

// Define the input schema using Zod
const getTaseDataSchema = {
  marketType: z.enum(["STOCK", "BONDS"]).optional().describe("Market type filter (STOCK or BONDS)"),
  tradeDate: z.string().optional().describe("Trade date in YYYY-MM-DD format (default: today)"),
  sortBy: z.enum(["symbol", "change", "volume", "closingPrice"]).optional().describe("Sort the data by this field"),
  sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort order"),
};

// Works both from source (server.ts) and compiled (dist/server.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = __filename.endsWith(".ts")
  ? path.join(__dirname, "dist")
  : __dirname;

// TASE end of day data structure (matches Prisma schema exactly)
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

// API response structure
interface ApiResponse {
  tradeDate: string;
  marketType: string | null;
  count: number;
  items: StockData[];
}

/**
 * Fetch TASE end of day data from the API
 */
async function fetchTaseData(marketType?: string, tradeDate?: string): Promise<{ rows: StockData[]; tradeDate: string }> {
  const params = new URLSearchParams();
  if (marketType) params.set("markeType", marketType);  // Note: API uses "markeType" (typo)
  if (tradeDate) params.set("tradeDate", tradeDate);

  const url = params.toString() ? `${TASE_API_URL}?${params}` : TASE_API_URL;

  console.log(`Fetching TASE data from: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json() as { payload: string };
  const data = JSON.parse(responseData.payload) as ApiResponse;

  // Pass through API response items directly (StockData matches ApiRow)
  const rows: StockData[] = data.items;

  return { rows, tradeDate: data.tradeDate };
}

/**
 * Creates a new MCP server instance with tools and resources registered.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "TASE End of Day Server",
    version: "1.0.0",
  });

  // Two-part registration: tool + resource, tied together by the resource URI.
  const resourceUri = "ui://tase-end-of-day/mcp-app.html";

  // Register a tool with UI metadata
  registerAppTool(server,
    "get-tase-data",
    {
      title: "Get TASE End of Day Data",
      description: "Returns Tel Aviv Stock Exchange end of day data with interactive visualization",
      inputSchema: getTaseDataSchema,
      _meta: { ui: { resourceUri } },
    },
    async (args): Promise<CallToolResult> => {
      const marketType = args.marketType;
      const tradeDate = args.tradeDate;
      const sortBy = args.sortBy ?? "symbol";
      const sortOrder = args.sortOrder ?? "asc";

      const { rows: data, tradeDate: actualTradeDate } = await fetchTaseData(marketType, tradeDate);

      // Sort data
      data.sort((a, b) => {
        const aVal = a[sortBy as keyof StockData];
        const bVal = b[sortBy as keyof StockData];
        const comparison = typeof aVal === "string"
          ? aVal.localeCompare(bVal as string)
          : (aVal as number) - (bVal as number);
        return sortOrder === "desc" ? -comparison : comparison;
      });

      const timestamp = actualTradeDate || new Date().toISOString();

      // Calculate market summary
      const totalVolume = data.reduce((sum, s) => sum + Number(s.volume ?? 0), 0);
      const gainers = data.filter(s => (s.changeValue ?? 0) > 0).length;
      const losers = data.filter(s => (s.changeValue ?? 0) < 0).length;
      const unchanged = data.filter(s => (s.changeValue ?? 0) === 0).length;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              timestamp,
              marketSummary: {
                totalStocks: data.length,
                gainers,
                losers,
                unchanged,
                totalVolume,
              },
              stocks: data,
            }, null, 2),
          },
        ],
      };
    },
  );

  // Register the resource, which returns the bundled HTML/JavaScript for the UI.
  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}
