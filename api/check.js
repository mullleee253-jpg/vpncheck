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

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const url = new URL(req.url, "http://localhost");
  const server = url.searchParams.get("server");

  if (!server || !SERVERS[server]) {
    return res.status(400).json({
      error: "Invalid server. Use ?server=ch or ?server=pl"
    });
  }

  const target = SERVERS[server];
  const socket = new net.Socket();

  const started = Date.now();
  let finished = false;

  const finish = (data) => {
    if (finished) return;
    finished = true;

    socket.destroy();

    return res.status(200).json({
      server,
      ...target,
      ...data
    });
  };

  socket.setTimeout(5000);

  socket.once("connect", () => {
    finish({
      status: "online",
      response_time_ms: Date.now() - started
    });
  });

  socket.once("timeout", () => {
    finish({
      status: "offline",
      response_time_ms: null,
      error: "timeout"
    });
  });

  socket.once("error", (err) => {
    finish({
      status: "offline",
      response_time_ms: null,
      error: err.code || "connection_failed"
    });
  });

  try {
    socket.connect(target.port, target.host);
  } catch (err) {
    finish({
      status: "offline",
      response_time_ms: null,
      error: err.message
    });
  }
}
