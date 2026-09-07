import net from "net";

const SERVERS = {
    ch: {
        name: "Switzerland",
        flag: "🇨🇭",
        host: "31.76.4.168",
        port: 25558
    },

    pl: {
        name: "Poland",
        flag: "🇵🇱",
        host: "193.36.236.18",
        port: 27489
    }
};

export default function handler(req, res) {

    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );

    const url = new URL(
        req.url,
        "http://localhost"
    );

    const server = url.searchParams.get("server");

    if (!SERVERS[server]) {
        return res.status(400).json({
            error: "Unknown server",
            available: ["ch", "pl"]
        });
    }

    const target = SERVERS[server];

    const socket = new net.Socket();

    const start = Date.now();

    let finished = false;

    function finish(result) {

        if (finished) return;

        finished = true;

        try {
            socket.destroy();
        } catch {}

        return res.status(200).json({
            server,
            name: target.name,
            host: target.host,
            port: target.port,
            ...result
        });
    }

    socket.setTimeout(5000);

    socket.once("connect", () => {

        finish({
            status: "online",
            response_time_ms: Date.now() - start
        });

    });

    socket.once("timeout", () => {

        finish({
            status: "offline",
            response_time_ms: null,
            error: "timeout"
        });

    });

    socket.once("error", (error) => {

        finish({
            status: "offline",
            response_time_ms: null,
            error: error.code || "connection_failed"
        });

    });

    try {

        socket.connect(
            target.port,
            target.host
        );

    } catch (error) {

        finish({
            status: "offline",
            response_time_ms: null,
            error: error.message
        });
    }
}
