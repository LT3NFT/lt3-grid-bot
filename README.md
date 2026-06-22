# LT3 Grid Discord Bot

Discord bot for the LT3 community server. Responds to `/grid` with a near-square NFT grid image for any wallet address or ENS name.

## Setup

### 1. Create a Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. Go to **Bot** → create a bot → copy the **token** → `DISCORD_TOKEN`.
3. Copy the **Application ID** from General Information → `DISCORD_APPLICATION_ID`.
4. Enable **Message Content Intent** is not required; only slash commands are used.

### 2. Invite the bot to the LT3 server

Use this URL (replace `YOUR_APPLICATION_ID`):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_APPLICATION_ID&permissions=52224&scope=bot%20applications.commands
```

Copy your LT3 server ID (Developer Mode → right-click server → Copy Server ID) → `DISCORD_GUILD_ID`.

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in:

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_APPLICATION_ID` | Application ID |
| `DISCORD_GUILD_ID` | LT3 Discord server ID |
| `LT3_ALCHEMY_KEY` | Same Alchemy key used by the web grid tool |

Optional:

- `DISCORD_GRID_CHANNEL_ID` — restrict `/grid` to one channel
- `GRID_COOLDOWN_SECONDS` — per-user cooldown (default 30)

### 4. Install and register commands

```bash
npm install
npm run register-commands
```

### 5. Run the bot

```bash
npm start
```

Host on Railway, Render, Fly.io, or a VPS — Discord bots need a persistent process.

## Usage

```
/grid wallet:0xYourAddressHere
/grid wallet:yourname.eth
```

The bot auto-picks the most square layout (same ranking as the web tool) and replies with a PNG or JPEG attachment.

## Local testing

Layout logic without Discord credentials:

```bash
npm run test:layout
```

Full end-to-end (requires `.env` with Alchemy key):

```bash
node -e "import('./src/grid-service.js').then(m => m.buildGridForWalletInput('0x...').then(r => console.log(r.filename, r.count, r.layout.name)))"
```

## Project structure

```
src/
  bot.js              Discord client + command registration
  commands/grid.js    /grid slash command handler
  grid-service.js     Wallet → grid pipeline
  layout/             Ported layout engine from lt3-grid-tool
  nft/                Alchemy fetch, ENS, image loading
  render/             Sharp compositor
```

The web grid tool at `lt3-grid-tool` is unchanged; this bot ports its layout mechanics into a separate codebase.
