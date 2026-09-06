import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const SERVERS = ["ch", "pl"];

function formatDuration(seconds) {
    seconds = Math.max(
        0,
        Math.floor(seconds || 0)
    );

    const days =
        Math.floor(seconds / 86400);

    seconds %= 86400;

    const hours =
        Math.floor(seconds / 3600);

    seconds %= 3600;

    const minutes =
        Math.floor(seconds / 60);

    if (days > 0) {
        return `${days}д ${hours}ч`;
    }

    if (hours > 0) {
        return `${hours}ч ${minutes}м`;
    }

    return `${minutes}м`;
}

function uptimePercent(state) {
    const total =
        (state.online_seconds || 0) +
        (state.offline_seconds || 0);

    if (!total) return 100;

    return Number(
        (
            (state.online_seconds / total) *
            100
        ).toFixed(2)
    );
}

export default async function handler(req, res) {
    try {
        const result = {};

        for (const key of SERVERS) {
            const state =
                await redis.get(
                    `vpn:server:${key}`
                );

            if (!state) {
                result[key] = {
                    initialized: false,
                    status: "unknown",
                    uptime_percent: null
                };

                continue;
            }

            let stableSeconds = 0;

            if (
                state.status === "online"
            ) {
                stableSeconds =
                    Math.floor(
                        (
                            Date.now() -
                            state.last_up
                        ) / 1000
                    );
            }

            let currentDowntime = 0;

            if (
                state.status === "offline" &&
                state.current_incident_start
            ) {
                currentDowntime =
                    Math.floor(
                        (
                            Date.now() -
                            state.current_incident_start
                        ) / 1000
                    );
            }

            result[key] = {
                initialized: true,

                status:
                    state.status,

                uptime_percent:
                    uptimePercent(state),

                online_seconds:
                    state.online_seconds,

                offline_seconds:
                    state.offline_seconds,

                stable_seconds:
                    stableSeconds,

                current_downtime:
                    currentDowntime,

                incidents:
                    state.incidents,

                last_latency:
                    state.last_latency,

                last_check:
                    state.last_check,

                last_down:
                    state.last_down,

                last_up:
                    state.last_up,

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
        console.error(error);

        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}
