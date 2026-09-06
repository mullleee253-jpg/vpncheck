import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const SERVERS = ["ch", "pl"];

function formatDuration(seconds) {
    seconds = Math.max(
        0,
        Math.floor(Number(seconds || 0))
    );

    const days = Math.floor(
        seconds / 86400
    );

    seconds %= 86400;

    const hours = Math.floor(
        seconds / 3600
    );

    seconds %= 3600;

    const minutes = Math.floor(
        seconds / 60
    );

    if (days > 0) {
        return `${days}д ${hours}ч`;
    }

    if (hours > 0) {
        return `${hours}ч ${minutes}м`;
    }

    return `${minutes}м`;
}

function uptimePercent(state) {
    const online =
        Number(state.online_seconds || 0);

    const offline =
        Number(state.offline_seconds || 0);

    const total =
        online + offline;

    if (total <= 0) {
        return 100;
    }

    return Number(
        ((online / total) * 100).toFixed(2)
    );
}

export default async function handler(req, res) {
    try {
        const result = {};

        for (const key of SERVERS) {
            const state = await redis.get(
                `vpn:server:${key}`
            );

            if (!state) {
                result[key] = {
                    initialized: false,
                    status: "unknown",
                    uptime_percent: null,
                    stable_seconds: 0,
                    current_downtime: 0,
                    incidents: 0
                };

                continue;
            }

            let stableSeconds = 0;

            if (
                state.status === "online" &&
                state.stable_since
            ) {
                stableSeconds =
                    Math.floor(
                        (Date.now() -
                            Number(state.stable_since)) /
                            1000
                    );
            }

            let currentDowntime = 0;

            if (
                state.status === "offline" &&
                state.current_incident_start
            ) {
                currentDowntime =
                    Math.floor(
                        (Date.now() -
                            Number(
                                state.current_incident_start
                            )) /
                            1000
                    );
            }

            result[key] = {
                initialized: true,

                server: key,

                name: state.name,

                host: state.host,

                port: state.port,

                status: state.status,

                uptime_percent:
                    uptimePercent(state),

                online_seconds:
                    Number(
                        state.online_seconds || 0
                    ),

                offline_seconds:
                    Number(
                        state.offline_seconds || 0
                    ),

                stable_seconds:
                    stableSeconds,

                current_downtime:
                    currentDowntime,

                incidents:
                    Number(
                        state.incidents || 0
                    ),

                last_latency:
                    state.last_latency ?? null,

                last_check:
                    state.last_check ?? null,

                last_down:
                    state.last_down ?? null,

                last_up:
                    state.last_up ?? null,

                stable_text:
                    formatDuration(
                        stableSeconds
                    ),

                downtime_text:
                    formatDuration(
                        currentDowntime
                    )
            };
        }

        return res.status(200).json({
            ok: true,
            updated_at: Date.now(),
            servers: result
        });

    } catch (error) {
        console.error(
            "STATUS ERROR:",
            error
        );

        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}
