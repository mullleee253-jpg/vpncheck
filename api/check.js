import net from "net";


const ALLOWED_SERVERS = new Set([
    "31.76.4.168:25558",
    "2.26.255.84:27489"
]);


export default async function handler(req, res) {

    res.setHeader(
        "Cache-Control",
        "no-store"
    );


    const host =
        String(
            req.query.host || ""
        ).trim();


    const port =
        Number(
            req.query.port
        );


    /* =========================
       VALIDATION
    ========================= */

    if (!host || !req.query.port) {

        return res.status(400).json({
            status: "error",
            error: "Missing host or port"
        });

    }


    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {

        return res.status(400).json({
            status: "error",
            error: "Invalid port"
        });

    }


    const target =
        `${host}:${port}`;


    /* =========================
       ALLOWED SERVERS ONLY
    ========================= */

    if (
        !ALLOWED_SERVERS.has(target)
    ) {

        return res.status(403).json({
            status: "error",
            error: "Server is not allowed"
        });

    }


    /* =========================
       TCP CHECK
    ========================= */

    const socket =
        new net.Socket();


    const timeout =
        5000;


    const start =
        process.hrtime.bigint();


    let finished = false;


    function finish(
        statusCode,
        data
    ) {

        if (finished) {
            return;
        }


        finished = true;


        try {
            socket.destroy();
        }

        catch {}


        return res
            .status(statusCode)
            .json(data);

    }


    /* =========================
       TIMEOUT
    ========================= */

    socket.setTimeout(
        timeout
    );


    socket.once(
        "timeout",
        () => {

            finish(
                200,
                {
                    status: "offline",

                    host,

                    port,

                    error:
                        "Connection timeout"
                }
            );

        }
    );


    /* =========================
       CONNECTED
    ========================= */

    socket.once(
        "connect",
        () => {

            const end =
                process.hrtime.bigint();


            const responseTime =
                Number(
                    end - start
                ) / 1000000;


            finish(
                200,
                {
                    status: "online",

                    host,

                    port,

                    response_time_ms:
                        Number(
                            responseTime
                                .toFixed(2)
                        )
                }
            );

        }
    );


    /* =========================
       ERROR
    ========================= */

    socket.once(
        "error",
        (error) => {

            finish(
                200,
                {
                    status: "offline",

                    host,

                    port,

                    error:
                        error.code ||
                        "Connection failed"
                }
            );

        }
    );


    /* =========================
       CONNECT
    ========================= */

    try {

        socket.connect({
            host,
            port
        });

    }

    catch (error) {

        finish(
            200,
            {
                status: "offline",

                host,

                port,

                error:
                    error.message
            }
        );

    }

}
