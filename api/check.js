import net from "net";

const SERVERS = {
    ch: {
        host: "31.76.4.168",
        port: 25558,
        name: "Switzerland"
    },

    pl: {
        host: "2.26.255.84",
        port: 27489,
        name: "Poland"
    }
};


function checkTCP(host, port) {
    return new Promise((resolve) => {

        const socket = new net.Socket();

        const start = process.hrtime.bigint();

        let finished = false;


        function finish(result) {

            if (finished) {
                return;
            }

            finished = true;

            try {
                socket.destroy();
            } catch {}

            resolve(result);
        }


        socket.setTimeout(5000);


        socket.once("connect", () => {

            const end =
                process.hrtime.bigint();

            const ping =
                Number(end - start) / 1000000;


            finish({
                status: "online",
                response_time_ms:
                    Number(ping.toFixed(2))
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
                error:
                    error.code ||
                    "connection_failed"
            });

        });


        try {

            socket.connect(
                Number(port),
                host
            );

        } catch (error) {

            finish({
                status: "offline",
                response_time_ms: null,
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


        /*
         * Поддерживаем:
         *
         * /api/check?server=ch
         * /api/check?server=pl
         *
         * И старый frontend:
         *
         * /api/check?host=31.76.4.168&port=25558
         * /api/check?host=2.26.255.84&port=27489
         */


        const server =
            url.searchParams.get("server");

        const host =
            url.searchParams.get("host");

        const port =
            url.searchParams.get("port");


        let targetHost;
        let targetPort;
        let serverName;
        let serverKey;


        /*
         * server=ch / server=pl
         */

        if (server) {

            if (!SERVERS[server]) {

                return res.status(400).json({
                    ok: false,
                    error: "Unknown server"
                });

            }


            targetHost =
                SERVERS[server].host;

            targetPort =
                SERVERS[server].port;

            serverName =
                SERVERS[server].name;

            serverKey =
                server;
        }


        /*
         * host + port
         *
         * Именно этот вариант
         * сейчас использует твой сайт.
         */

        else if (host && port) {

            targetHost = host;
            targetPort = Number(port);

            if (
                targetHost ===
                "31.76.4.168" &&
                targetPort === 25558
            ) {
                serverName = "Switzerland";
                serverKey = "ch";
            }

            else if (
                targetHost ===
                "2.26.255.84" &&
                targetPort === 27489
            ) {
                serverName = "Poland";
                serverKey = "pl";
            }

            else {
                serverName = "Unknown";
                serverKey = "custom";
            }

        }


        /*
         * Ничего не передали
         */

        else {

            return res.status(400).json({
                ok: false,
                error: "Missing host and port"
            });

        }


        /*
         * Проверка порта
         */

        if (
            !Number.isInteger(
                Number(targetPort)
            ) ||
            Number(targetPort) < 1 ||
            Number(targetPort) > 65535
        ) {

            return res.status(400).json({
                ok: false,
                error: "Invalid port"
            });

        }


        /*
         * TCP CHECK
         */

        const result =
            await checkTCP(
                targetHost,
                targetPort
            );


        /*
         * JSON
         */

        return res.status(200).json({

            ok: true,

            server: serverKey,

            name: serverName,

            host: targetHost,

            port: Number(targetPort),

            status: result.status,

            response_time_ms:
                result.response_time_ms,

            error:
                result.error || null

        });

    }


    catch (error) {

        console.error(
            "VPN CHECK ERROR:",
            error
        );


        return res.status(500).json({

            ok: false,

            error: error.message

        });

    }

}
