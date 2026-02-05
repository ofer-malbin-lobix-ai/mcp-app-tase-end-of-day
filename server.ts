import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Define the input schema using Zod
const getTaseDataSchema = {
  sortBy: z.enum(["symbol", "change", "volume", "lastPrice"]).optional().describe("Sort the data by this field"),
  sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort order"),
  filterSector: z.string().optional().describe("Filter by sector (optional)"),
};

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

// Sample TASE end of day data structure
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

// Sample data - replace with actual TASE API integration
function generateSampleData(): StockData[] {
  return [
    { symbol: "TEVA", name: "Teva Pharmaceutical", lastPrice: 52.30, change: 1.20, changePercent: 2.35, volume: 1250000, high: 53.10, low: 51.50, open: 51.80 },
    { symbol: "CHKP", name: "Check Point Software", lastPrice: 185.40, change: -2.60, changePercent: -1.38, volume: 850000, high: 188.20, low: 184.50, open: 187.80 },
    { symbol: "NICE", name: "Nice Ltd", lastPrice: 215.80, change: 4.50, changePercent: 2.13, volume: 620000, high: 217.30, low: 212.40, open: 213.20 },
    { symbol: "LUMI", name: "Bank Leumi", lastPrice: 38.50, change: 0.80, changePercent: 2.12, volume: 2100000, high: 38.90, low: 37.80, open: 38.00 },
    { symbol: "HAPO", name: "Bank Hapoalim", lastPrice: 42.20, change: -0.30, changePercent: -0.71, volume: 1850000, high: 42.80, low: 41.90, open: 42.50 },
    { symbol: "DSCT", name: "Bank Discount", lastPrice: 28.70, change: 0.45, changePercent: 1.59, volume: 980000, high: 29.10, low: 28.30, open: 28.40 },
    { symbol: "BEZQ", name: "Bezeq", lastPrice: 4.85, change: 0.12, changePercent: 2.54, volume: 5200000, high: 4.92, low: 4.75, open: 4.78 },
    { symbol: "ICL", name: "ICL Group", lastPrice: 24.60, change: -0.85, changePercent: -3.34, volume: 1450000, high: 25.30, low: 24.40, open: 25.20 },
    { symbol: "ELCO", name: "Elco Holdings", lastPrice: 156.30, change: 3.20, changePercent: 2.09, volume: 320000, high: 157.80, low: 153.50, open: 154.10 },
    { symbol: "AZRG", name: "Azrieli Group", lastPrice: 285.40, change: -1.80, changePercent: -0.63, volume: 180000, high: 288.20, low: 284.10, open: 287.00 },
  ];
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
      const sortBy = args.sortBy ?? "symbol";
      const sortOrder = args.sortOrder ?? "asc";

      let data = generateSampleData();

      // Sort data
      data.sort((a, b) => {
        const aVal = a[sortBy as keyof StockData];
        const bVal = b[sortBy as keyof StockData];
        const comparison = typeof aVal === "string"
          ? aVal.localeCompare(bVal as string)
          : (aVal as number) - (bVal as number);
        return sortOrder === "desc" ? -comparison : comparison;
      });

      const timestamp = new Date().toISOString();

      // Calculate market summary
      const totalVolume = data.reduce((sum, s) => sum + s.volume, 0);
      const gainers = data.filter(s => s.change > 0).length;
      const losers = data.filter(s => s.change < 0).length;
      const unchanged = data.filter(s => s.change === 0).length;

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
