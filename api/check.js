import net from "net";

export default function handler(req, res) {
    const url = new URL(
        req.url,
        "https://localhost"
    );

    const host = url.searchParams.get("host");
    const port = Number(
        url.searchParams.get("port")
    );

    if (!host || !port) {
        return res.status(400).json({
            error: "host and port required"
        });
    }

    const socket = new net.Socket();
    const start = Date.now();

    let finished = false;

    const done = (data) => {
        if (finished) return;

        finished = true;

        try {
            socket.destroy();
        } catch {}

        res.status(200).json(data);
    };

    socket.setTimeout(5000);

    socket.on("connect", () => {
        done({
            status: "online",
            host: host,
            port: port,
            response_time_ms:
                Date.now() - start
        });
    });

    socket.on("timeout", () => {
        done({
            status: "offline",
            host: host,
            port: port,
            response_time_ms: null,
            error: "timeout"
        });
    });

    socket.on("error", (err) => {
        done({
            status: "offline",
            host: host,
            port: port,
            response_time_ms: null,
            error: err.code || "connection_failed"
        });
    });

    try {
        socket.connect(port, host);
    } catch (err) {
        done({
            status: "offline",
            host: host,
            port: port,
            response_time_ms: null,
            error: err.message
        });
    }
}
