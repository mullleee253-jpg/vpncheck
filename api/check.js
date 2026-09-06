import net from "net";

const SERVERS = {
    ch: {
        host: "31.76.4.168",
        port: 25558
    },

    pl: {
        host: "2.26.255.84",
        port: 27489
    }
};

function tcpCheck(server) {
    return new Promise((resolve) => {
        const started = process.hrtime.bigint();
        const socket = new net.Socket();

        let finished = false;

        function finish(result) {
            if (finished) return;

            finished = true;

            try {
                socket.destroy();
            } catch {}

            resolve(result);
        }

        // Максимальное время ожидания — 5 секунд
        socket.setTimeout(5000);

        // Сервер доступен
        socket.once("connect", () => {
            const ended = process.hrtime.bigint();

            const latency =
                Number(ended - started) / 1_000_000;

            finish({
                status: "online",
                response_time_ms: Number(latency.toFixed(2))
            });
        });

        // Таймаут
        socket.once("timeout", () => {
            finish({
                status: "offline",
                error: "timeout"
            });
        });

        // Ошибка подключения
        socket.once("error", (error) => {
            finish({
                status: "offline",
                error: error.code || "connection_failed"
            });
        });

        try {
            socket.connect({
                host: server.host,
                port: server.port
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

        // Получаем ?server=ch или ?server=pl
        const key =
            url.searchParams.get("server") ||
            req.query?.server;

        // Если параметр вообще не передан
        if (!key) {
            return res.status(400).json({
                ok: false,
                error: "Missing server parameter",
                expected: [
                    "/api/check?server=ch",
                    "/api/check?server=pl"
                ],
                received_url: req.url
            });
        }

        // Если передан неизвестный сервер
        if (!SERVERS[key]) {
            return res.status(400).json({
                ok: false,
                error: "Invalid server",
                received: key,
                available: Object.keys(SERVERS)
            });
        }

        const server = SERVERS[key];

        // TCP-проверка
        const result = await tcpCheck(server);

        return res.status(200).json({
            ok: true,
            server: key,
            host: server.host,
            port: server.port,
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
