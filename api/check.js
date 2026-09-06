import net from "net";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    const { host, port } = req.query;

    if (!host || !port) {
        return res.status(400).json({
            status: "error",
            error: "Missing host or port"
        });
    }

    const portNumber = Number(port);

    if (
        !Number.isInteger(portNumber) ||
        portNumber < 1 ||
        portNumber > 65535
    ) {
        return res.status(400).json({
            status: "error",
            error: "Invalid port"
        });
    }

    /*
     * Ограничиваем проверяемые адреса,
     * чтобы endpoint нельзя было использовать
     * как произвольный TCP scanner.
     */
    const allowedServers = new Set([
        "31.76.4.168:25558",
        "2.26.255.84:27489"
    ]);

    const target = `${host}:${portNumber}`;

    if (!allowedServers.has(target)) {
        return res.status(403).json({
            status: "error",
            error: "Server is not allowed"
        });
    }

    const timeout = 5000;

    const start = process.hrtime.bigint();

    const socket = new net.Socket();

    let finished = false;

    function finish(code, body) {
        if (finished) return;

        finished = true;

        try {
            socket.destroy();
        } catch {}

        return res.status(code).json(body);
    }

    socket.setTimeout(timeout);

    socket.once("connect", () => {
        const end = process.hrtime.bigint();

        const responseTime =
            Number(end - start) / 1_000_000;

        finish(200, {
            status: "online",
            host,
            port: portNumber,
            response_time_ms: Number(responseTime.toFixed(2))
        });
    });

    socket.once("timeout", () => {
        finish(200, {
            status: "offline",
            host,
            port: portNumber,
            error: "Connection timeout"
        });
    });

    socket.once("error", (error) => {
        finish(200, {
            status: "offline",
            host,
            port: portNumber,
            error: error.code || "Connection failed"
        });
    });

    try {
        socket.connect({
            host,
            port: portNumber
        });
    } catch (error) {
        finish(200, {
            status: "offline",
            host,
            port: portNumber,
            error: error.message
        });
    }
}