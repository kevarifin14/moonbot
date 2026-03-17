# MoonBot

A Telegram bot powered by MoonPay CLI for checking balances, swapping tokens, viewing prices, and more.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Telegram bot via [@BotFather](https://t.me/BotFather) and grab the token.

3. Export the token and start:
   ```bash
   export TELEGRAM_BOT_TOKEN="your-token-here"
   npm start
   ```

## Commands

| Command | Description |
|---------|-------------|
| `/balance [wallet] [chain]` | Show token balances for a wallet |
| `/price [token]` | Search for a token and show its price |
| `/trending` | Show trending tokens on Solana |
| `/check [token_address]` | Run a safety check on a token |
| `/swap [from] [to] [amount] [wallet]` | Execute a token swap |
| `/markets` | Show trending prediction markets |
| `/portfolio` | Full portfolio overview with values |
| `/help` | List all available commands |

## Requirements

- Node.js 18+
- MoonPay CLI (`moonpay`) installed and authenticated
