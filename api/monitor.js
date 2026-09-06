import { Redis } from "@upstash/redis";
import { tcpCheck } from "./check.js";

const redis = Redis.fromEnv();

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

async function monitorServer(key) {
    const server = SERVERS[key];

    const result = await tcpCheck(
        server.host,
        server.port
    );

    const now = Date.now();

    const redisKey = `vpn:server:${key}`;

    let state = await redis.get(redisKey);

    /*
     * Первый запуск
     */

    if (!state) {
        state = {
            server: key,
            name: server.name,

            host: server.host,
            port: server.port,

            status: result.status,

            first_check: now,
            last_check: now,

            online_seconds:
                result.status === "online" ? 60 : 0,

            offline_seconds:
                result.status === "offline" ? 60 : 0,

            incidents:
                result.status === "offline" ? 1 : 0,

            stable_since:
                result.status === "online"
                    ? now
                    : null,

            current_incident_start:
                result.status === "offline"
                    ? now
                    : null,

            last_down:
                result.status === "offline"
                    ? now
                    : null,

            last_up:
                result.status === "online"
                    ? now
                    : null,

            last_latency:
                result.response_time_ms ?? null
        };
    }

    /*
     * Последующие проверки
     */

    else {
        const previousStatus = state.status;

        const elapsedSeconds = Math.min(
            Math.max(
                (now - Number(state.last_check || now)) / 1000,
                0
            ),
            300
        );

        state.last_check = now;

        /*
         * ONLINE
         */

        if (result.status === "online") {
            state.online_seconds =
                Number(state.online_seconds || 0) +
                elapsedSeconds;

            state.last_latency =
                result.response_time_ms ?? null;

            state.last_up = now;

            /*
             * OFFLINE -> ONLINE
             */

            if (previousStatus === "offline") {
                state.stable_since = now;
                state.current_incident_start = null;
            }

            /*
             * Если почему-то stable_since отсутствует
             */

            if (!state.stable_since) {
                state.stable_since = now;
            }
        }

        /*
         * OFFLINE
         */

        else {
            state.offline_seconds =
                Number(state.offline_seconds || 0) +
                elapsedSeconds;

            /*
             * ONLINE -> OFFLINE
             */

            if (previousStatus !== "offline") {
                state.incidents =
                    Number(state.incidents || 0) + 1;

                state.current_incident_start = now;
                state.last_down = now;
            }

            /*
             * Если уже offline, начало инцидента
             * сохраняем
             */

            if (!state.current_incident_start) {
                state.current_incident_start = now;
            }
        }

        state.status = result.status;
    }

    await redis.set(
        redisKey,
        state
    );

    return state;
}

export default async function handler(req, res) {
    try {
        const results = await Promise.all([
            monitorServer("ch"),
            monitorServer("pl")
        ]);

        return res.status(200).json({
            ok: true,
            checked_at: Date.now(),
            results
        });

    } catch (error) {
        console.error(
            "MONITOR ERROR:",
            error
        );

        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}
