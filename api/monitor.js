import { Redis } from "@upstash/redis";
import { tcpCheck } from "./check.js";

const redis = Redis.fromEnv();

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

const CHECK_INTERVAL = 60;

async function monitorServer(key) {
    const server = SERVERS[key];

    const result = await tcpCheck(server);

    const now = Date.now();

    const redisKey = `vpn:server:${key}`;

    let state =
        await redis.get(redisKey);

    if (!state) {
        state = {
            status: result.status,

            first_check: now,

            last_check: now,

            online_seconds:
                result.status === "online"
                    ? CHECK_INTERVAL
                    : 0,

            offline_seconds:
                result.status === "offline"
                    ? CHECK_INTERVAL
                    : 0,

            incidents: 0,

            current_incident_start:
                result.status === "offline"
                    ? now
                    : null,

            last_down: null,

            last_up:
                result.status === "online"
                    ? now
                    : null,

            last_latency:
                result.response_time_ms ?? null
        };
    } else {
        const previousStatus =
            state.status;

        state.last_check = now;

        if (result.status === "online") {
            state.online_seconds +=
                CHECK_INTERVAL;

            state.last_latency =
                result.response_time_ms ?? null;

            state.last_up = now;

            if (
                previousStatus === "offline"
            ) {
                state.current_incident_start =
                    null;
            }
        }

        if (result.status === "offline") {
            state.offline_seconds +=
                CHECK_INTERVAL;

            if (
                previousStatus !== "offline"
            ) {
                state.incidents += 1;

                state.current_incident_start =
                    now;

                state.last_down = now;
            }
        }

        state.status =
            result.status;
    }

    await redis.set(
        redisKey,
        state
    );

    return {
        server: key,
        ...state
    };
}

export default async function handler(req, res) {
    try {
        const results =
            await Promise.all([
                monitorServer("ch"),
                monitorServer("pl")
            ]);

        return res.status(200).json({
            ok: true,
            checked_at: Date.now(),
            results
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}
