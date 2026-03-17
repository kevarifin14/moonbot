const TelegramBot = require("node-telegram-bot-api");
const { execSync } = require("child_process");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN env var is required");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log("MoonBot is running...");

// --- Helpers ---

function mp(cmd) {
  try {
    const out = execSync(`moonpay ${cmd}`, {
      encoding: "utf-8",
      timeout: 30000,
      env: { ...process.env },
    });
    return JSON.parse(out.trim());
  } catch (err) {
    const stderr = err.stderr?.trim() || err.message;
    throw new Error(stderr);
  }
}

function send(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function fmtNum(n, decimals = 4) {
  if (n == null || isNaN(n)) return "—";
  const num = Number(n);
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(decimals);
}

function fmtUsd(n) {
  if (n == null || isNaN(n)) return "—";
  return `$${fmtNum(n, 2)}`;
}

// --- Commands ---

bot.onText(/\/start/, (msg) => {
  send(msg.chat.id, [
    "*Welcome to MoonBot!*",
    "",
    "Your MoonPay CLI companion on Telegram.",
    "Type /help to see available commands.",
  ].join("\n"));
});

bot.onText(/\/help/, (msg) => {
  send(msg.chat.id, [
    "*MoonBot Commands*",
    "",
    "`/balance [wallet] [chain]` — Token balances",
    "`/price [token]` — Search token price",
    "`/trending` — Trending tokens (Solana)",
    "`/check [token_address]` — Token safety check",
    "`/swap [from] [to] [amount] [wallet]` — Swap tokens",
    "`/markets` — Trending prediction markets",
    "`/portfolio` — Full portfolio overview",
    "`/help` — This message",
  ].join("\n"));
});

bot.onText(/\/balance(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = (match[1] || "").trim().split(/\s+/);
  const wallet = args[0] || "main";
  const chain = args[1] || "solana";

  try {
    send(chatId, "_Fetching balances..._");
    const data = mp(`token balance list -w ${wallet} --chain ${chain} --json`);
    const tokens = Array.isArray(data) ? data : data?.tokens || [];

    if (!tokens.length) {
      return send(chatId, `No tokens found for wallet *${wallet}* on *${chain}*.`);
    }

    const lines = tokens.slice(0, 15).map((t) => {
      const sym = t.symbol || t.name || "???";
      const bal = fmtNum(t.balance || t.amount);
      const usd = t.usdValue || t.value;
      return `\`${sym}\` — ${bal}${usd != null ? ` (${fmtUsd(usd)})` : ""}`;
    });

    send(chatId, `*Balances — ${wallet} (${chain})*\n\n${lines.join("\n")}`);
  } catch (e) {
    send(chatId, `Error fetching balances: \`${e.message.slice(0, 200)}\``);
  }
});

bot.onText(/\/price\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1].trim();

  try {
    send(chatId, `_Searching for "${query}"..._`);
    const data = mp(`token search "${query}" --json`);
    const tokens = Array.isArray(data) ? data : data?.tokens || [];

    if (!tokens.length) {
      return send(chatId, `No results for "${query}".`);
    }

    const lines = tokens.slice(0, 5).map((t) => {
      const sym = t.symbol || "???";
      const name = t.name || "";
      const price = t.price != null ? fmtUsd(t.price) : "—";
      const chg = t.priceChange24h != null ? `${Number(t.priceChange24h).toFixed(2)}%` : "";
      const mc = t.marketCap != null ? `MC: ${fmtUsd(t.marketCap)}` : "";
      return `*${sym}* ${name}\nPrice: \`${price}\` ${chg ? `(${chg})` : ""} ${mc}`;
    });

    send(chatId, `*Search: ${query}*\n\n${lines.join("\n\n")}`);
  } catch (e) {
    send(chatId, `Error searching: \`${e.message.slice(0, 200)}\``);
  }
});

bot.onText(/\/trending/, (msg) => {
  const chatId = msg.chat.id;

  try {
    send(chatId, "_Fetching trending tokens..._");
    const data = mp("token trending list --chain solana --json");
    const tokens = Array.isArray(data) ? data : data?.tokens || [];

    if (!tokens.length) {
      return send(chatId, "No trending tokens right now.");
    }

    const lines = tokens.slice(0, 10).map((t, i) => {
      const sym = t.symbol || "???";
      const name = t.name || "";
      const price = t.price != null ? fmtUsd(t.price) : "—";
      const chg = t.priceChange24h != null ? `(${Number(t.priceChange24h).toFixed(2)}%)` : "";
      const mc = t.marketCap != null ? `MC: ${fmtUsd(t.marketCap)}` : "";
      return `${i + 1}. *${sym}* ${name}\n   ${price} ${chg} ${mc}`;
    });

    send(chatId, `*Trending on Solana*\n\n${lines.join("\n\n")}`);
  } catch (e) {
    send(chatId, `Error: \`${e.message.slice(0, 200)}\``);
  }
});

bot.onText(/\/check\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const addr = match[1].trim();

  try {
    send(chatId, "_Running safety check..._");
    const data = mp(`token check ${addr} --json`);

    const score = data.score ?? data.safetyScore ?? "?";
    const verdict = data.verdict ?? data.status ?? "unknown";
    const name = data.name || data.symbol || addr.slice(0, 8) + "...";

    const lines = [`*Safety Check: ${name}*`, "", `Score: \`${score}\``, `Verdict: \`${verdict}\``];

    if (data.risks?.length) {
      lines.push("", "*Risks:*");
      data.risks.slice(0, 5).forEach((r) => {
        const desc = typeof r === "string" ? r : r.description || r.name || JSON.stringify(r);
        lines.push(`  - ${desc}`);
      });
    }

    if (data.details || data.info) {
      const extra = data.details || data.info;
      if (typeof extra === "object") {
        Object.entries(extra).slice(0, 6).forEach(([k, v]) => {
          lines.push(`${k}: \`${v}\``);
        });
      }
    }

    send(chatId, lines.join("\n"));
  } catch (e) {
    send(chatId, `Error checking token: \`${e.message.slice(0, 200)}\``);
  }
});

bot.onText(/\/swap\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);

  if (args.length < 3) {
    return send(chatId, "Usage: `/swap [from] [to] [amount] [wallet]`\nExample: `/swap SOL USDC 0.5 main`");
  }

  const [from, to, amount, wallet = "main"] = args;

  try {
    send(chatId, `_Swapping ${amount} ${from} -> ${to} on wallet ${wallet}..._`);
    const data = mp(`token swap --from ${from} --to ${to} --amount ${amount} -w ${wallet} --json`);

    const txHash = data.txHash || data.hash || data.transactionHash || "—";
    const received = data.amountOut || data.received || "—";

    send(chatId, [
      `*Swap Complete*`,
      "",
      `${amount} *${from}* -> *${to}*`,
      `Received: \`${received}\``,
      `Tx: \`${txHash}\``,
    ].join("\n"));
  } catch (e) {
    send(chatId, `Swap failed: \`${e.message.slice(0, 200)}\``);
  }
});

bot.onText(/\/markets/, (msg) => {
  const chatId = msg.chat.id;

  try {
    send(chatId, "_Fetching prediction markets..._");
    const data = mp("prediction-market market trending list --json");
    const markets = Array.isArray(data) ? data : data?.markets || [];

    if (!markets.length) {
      return send(chatId, "No trending markets right now.");
    }

    const lines = markets.slice(0, 8).map((m, i) => {
      const title = m.title || m.question || m.name || "Untitled";
      const yes = m.yesPrice ?? m.yes ?? "—";
      const no = m.noPrice ?? m.no ?? "—";
      const vol = m.volume != null ? `Vol: ${fmtUsd(m.volume)}` : "";
      return `${i + 1}. *${title}*\n   Yes: \`${yes}\` / No: \`${no}\` ${vol}`;
    });

    send(chatId, `*Trending Markets*\n\n${lines.join("\n\n")}`);
  } catch (e) {
    send(chatId, `Error: \`${e.message.slice(0, 200)}\``);
  }
});

bot.onText(/\/portfolio/, (msg) => {
  const chatId = msg.chat.id;

  try {
    send(chatId, "_Building portfolio overview..._");

    const wallets = ["main", "funded", "funded-sol"];
    const sections = [];
    let grandTotal = 0;

    for (const w of wallets) {
      try {
        const data = mp(`token balance list -w ${w} --json`);
        const tokens = Array.isArray(data) ? data : data?.tokens || [];
        if (!tokens.length) continue;

        let walletTotal = 0;
        const lines = tokens.slice(0, 10).map((t) => {
          const sym = t.symbol || "???";
          const bal = fmtNum(t.balance || t.amount);
          const usd = Number(t.usdValue || t.value || 0);
          walletTotal += usd;
          return `  \`${sym}\` ${bal}${usd ? ` (${fmtUsd(usd)})` : ""}`;
        });

        grandTotal += walletTotal;
        sections.push(`*${w}* — ${fmtUsd(walletTotal)}\n${lines.join("\n")}`);
      } catch {
        // wallet may not exist or have no balances
      }
    }

    if (!sections.length) {
      return send(chatId, "No balances found across wallets.");
    }

    send(chatId, [
      `*Portfolio Overview*`,
      `Total: *${fmtUsd(grandTotal)}*`,
      "",
      sections.join("\n\n"),
    ].join("\n"));
  } catch (e) {
    send(chatId, `Error: \`${e.message.slice(0, 200)}\``);
  }
});

// Catch unrecognized commands
bot.on("message", (msg) => {
  if (msg.text?.startsWith("/") && !/^\/(start|help|balance|price|trending|check|swap|markets|portfolio)/.test(msg.text)) {
    send(msg.chat.id, "Unknown command. Type /help for available commands.");
  }
});

console.log("MoonBot ready. Waiting for messages...");
