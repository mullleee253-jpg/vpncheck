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

export async function tcpCheck(server) {
    return new Promise((resolve) => {
        const started = process.hrtime.bigint();
        const socket = new net.Socket();

        let done = false;

        const finish = (result) => {
            if (done) return;
            done = true;

            try {
                socket.destroy();
            } catch {}

            resolve(result);
        };

        socket.setTimeout(5000);

        socket.once("connect", () => {
            const ended = process.hrtime.bigint();

            const ms =
                Number(ended - started) / 1000000;

            finish({
                status: "online",
                response_time_ms: Number(ms.toFixed(2))
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
    const key = req.query.server;

    if (!key || !SERVERS[key]) {
        return res.status(400).json({
            error: "Invalid server"
        });
    }

    const result = await tcpCheck(SERVERS[key]);

    return res.status(200).json({
        server: key,
        host: SERVERS[key].host,
        port: SERVERS[key].port,
        ...result
    });
}
