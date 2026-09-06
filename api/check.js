import net from "net";

const SERVERS = {
    ch: {
        name: "Switzerland",
        host: "31.76.4.168",
        port: 25558
    },

    pl: {
        name: "Poland",
        host: "2.26.255.84",
        port: 27489
    }
};

export function tcpCheck(host, port) {
    return new Promise((resolve) => {
        const started = process.hrtime.bigint();
        const socket = new net.Socket();

        let finished = false;

        const finish = (result) => {
            if (finished) return;

            finished = true;

            try {
                socket.destroy();
            } catch {}

            resolve(result);
        };

        socket.setTimeout(5000);

        socket.once("connect", () => {
            const ended = process.hrtime.bigint();

            const latency =
                Number(ended - started) / 1000000;

            finish({
                status: "online",
                response_time_ms: Number(latency.toFixed(2))
            });
        });

        socket.once("timeout", () => {
            finish({
                status: "offline",
                error: "timeout"
            });
        });

        socket.once("error", (error) => {
            finish({
                status: "offline",
                error: error.code || "connection_failed"
            });
        });

        try {
            socket.connect({
                host,
                port: Number(port)
            });
        } catch (error) {
            finish({
                status: "offline",
                error: error.message
            });
        }
    });
}

export default async function handler(req, res) {
    try {
        const url = new URL(
            req.url,
            `https://${req.headers.host || "localhost"}`
        );

        const serverKey = url.searchParams.get("server");

        const customHost = url.searchParams.get("host");
        const customPort = url.searchParams.get("port");

        let host;
        let port;
        let name;
        let key;

        /*
         * /api/check?server=ch
         * /api/check?server=pl
         */

        if (serverKey) {
            const server = SERVERS[serverKey];

            if (!server) {
                return res.status(400).json({
                    ok: false,
                    error: "Invalid server",
                    available: Object.keys(SERVERS)
                });
            }

            host = server.host;
            port = server.port;
            name = server.name;
            key = serverKey;
        }

        /*
         * Поддержка старого frontend:
         *
         * /api/check?host=31.76.4.168&port=25558
         */

        else if (customHost && customPort) {
            host = customHost;
            port = Number(customPort);
            name = "Custom";
            key = "custom";
        }

        else {
            return res.status(400).json({
                ok: false,
                error: "Missing server parameters",
                expected: [
                    "/api/check?server=ch",
                    "/api/check?server=pl",
                    "/api/check?host=31.76.4.168&port=25558"
                ]
            });
        }

        if (
            !Number.isInteger(Number(port)) ||
            Number(port) < 1 ||
            Number(port) > 65535
        ) {
            return res.status(400).json({
                ok: false,
                error: "Invalid port"
            });
        }

        const result = await tcpCheck(host, Number(port));

        return res.status(200).json({
            ok: true,
            server: key,
            name,
            host,
            port: Number(port),
            ...result
        });

    } catch (error) {
        console.error("CHECK ERROR:", error);

        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}
