import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { validateBearerToken } from "./utils/auth.js";
import { GHLTools } from "./tools/ghl.js";
import { ZoomTools } from "./tools/zoom.js";

const app = express();
app.use(cors());
app.use(express.json());

// Create MCP Server
const server = new McpServer({
    name: "zapier-alternative",
    version: "1.0.0"
});

// Register GHL Tools
server.tool(
    GHLTools.create_contact.name,
    GHLTools.create_contact.description,
    GHLTools.create_contact.inputSchema.shape,
    GHLTools.create_contact.handler
);

server.tool(
    GHLTools.add_tag.name,
    GHLTools.add_tag.description,
    GHLTools.add_tag.inputSchema.shape,
    GHLTools.add_tag.handler
);

server.tool(
    GHLTools.create_opportunity.name,
    GHLTools.create_opportunity.description,
    GHLTools.create_opportunity.inputSchema.shape,
    GHLTools.create_opportunity.handler
);

// Register Zoom Tools
server.tool(
    ZoomTools.get_meeting_registrants.name,
    ZoomTools.get_meeting_registrants.description,
    ZoomTools.get_meeting_registrants.inputSchema.shape,
    ZoomTools.get_meeting_registrants.handler
);

// Transport for SSE
let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
    // Bearer Token Auth
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || !validateBearerToken(token)) {
        res.status(401).send("Unauthorized");
        return;
    }

    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    // Bearer Token Auth
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || !validateBearerToken(token)) {
        res.status(401).send("Unauthorized");
        return;
    }

    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(500).send("Transport not initialized");
    }
});

// Export for Vercel
export default app;

// Local dev support
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`MCP Server is running on port ${PORT}`);
    });
}
