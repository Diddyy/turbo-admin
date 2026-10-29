# Turbo Admin

The admin panel for a [Turbo](..) hotel: a React app that talks to the admin API
inside the Turbo server, which runs beside the Orleans silo and reaches the grains directly.

It has:

- **Dashboard**: players online, rooms loaded, uptime, memory, silos, maintenance state, and the
  busiest rooms. It updates live as the hotel changes (falling back to every 10 seconds if the
  live stream is down). With the hotel's commands, also send a hotel
  alert and schedule or call off maintenance and shutdowns.
- **Performance**: how the server has been running over the last hour, six hours or day: CPU,
  memory, players, rooms, room entry time, room updates reaching players, the thread pool queue
  and garbage collection pauses as charts (each also as a table), and every timed room operation.
- **Rooms**: find any room, invisible ones too, by name, owner or id, and see its settings, who's
  in it right now, rights and bans. Only shown if you have `admin.rooms.view`. With the room
  permissions the hotel asks for, also edit its settings, kick, mute and ban people, lift bans,
  remove rights, make it a staff pick, mute it, clear it, unload it and send it an alert. Its
  Visitors tab lists who went into it lately.
- **Players**: find any player by name or id, the online ones alone if you like, and see whether
  they're online and where, their balances, sanctions, rooms and profile, their badges (worn ones
  first), their furniture by kind (in their inventory and placed in rooms), how many pets and bots
  they have, and the rooms they went into lately. Only shown if you have `admin.players.view`.
  With the matching command permissions, warn, ban, silence, trade lock, disconnect them, change
  their balances, give or take badges and put furniture in their inventory, through the hotel's
  own commands. With
  `admin.players.create`, create new players; with `admin.tickets.issue`, give a player a login
  ticket (single-use or reusable, timed or never running out) for players you outrank.
- **Catalog**: the page tree, each page drawn as the client draws it, and an editor beside it.
  With `catalog.manage`: drag pages about the tree and offers about their page or onto another
  page; pick icons and layouts by sight; fill a layout's pictures and words by name; build offers
  of any items, badges, effects, pets, bots or memberships, alone or bundled; prices, club level,
  visibility, club gifts and limited series; the front page's featured items; and publishing,
  which reloads the catalog and tells everyone online to refresh. Only shown if you have
  `admin.catalog.view`.
- **Command log**: every logged command, who ran it, where from (in game, room chat, the panel,
  the server console) and how it went, filtered by player, command, outcome or source. Only shown
  if you have `admin.commandlog.view`.
- **Chat log**: what players said in rooms, whispers included, filtered by player, room or words,
  and any line in context with what was said around it. Only shown if you have
  `admin.chatlog.view`.
- **Permission log** (under Logs, beside the two above): every change to a group's or a player's
  permissions and who made it, searched by node, key or group. Only shown if you have
  `admin.permissions.view`.
- **Permissions**: groups, any player's permissions and why they hold what they hold, and who is
  given a node. Seeing it needs `admin.permissions.view`; changing it
  needs `permissions.manage`, and only for groups and players below your heaviest group, with
  nodes you hold yourself.
- **Plugins**: every plugin the server found, with its manifest, whether it loaded (and why not),
  and the capabilities, packet headers and migrations it added. Only shown if you have
  `admin.plugins.view`. With `admin.plugins.manage`, reload one, rescan the plugin folders and turn
  one off or on (it stays off across restarts). Installing a plugin package (a zip) also needs
  `admin.plugins.install`, which no wildcard grants, and the server's `Turbo:Plugin:UploadEnabled`.
  So does **Link from GitHub**: a repository whose releases install the plugin's sources at their tag
  (from the folder holding its `manifest.json`, named when it has several), following its newest
  release or one tag, with an optional token (never shown). The server compiles a plugin's sources
  as it loads it; one it refuses (an executable file in its folder, or code plugins may not run) is
  listed as **refused**, with why. The server checks the links on
  a schedule and shows **update available**; **Update** and **Check now** run as a job with its log.
  Every install keeps the version it replaced: **Roll back** under Earlier versions puts one back.
  Every action is in the command log.
- **Console**: the operator commands you may run (`online`, `whois`, `ban`, `hotelalert`,
  `reload`, ...), run as you, with your permissions. Every use is logged like typing it in the
  hotel, and commands that need confirming ask first.
- **Approvals**: what AI assistants, agents and plugins asked to do and wait for a person's yes,
  pending first, with the count by its name in the menu: what it will do, who asked and for whom,
  its arguments as text, and approve (carried out at once, once) or deny with a note. Offered only on
  others' requests whose node you hold. Only shown if you have `admin.approvals.view`.
- **Staff**: setup and reset links for other staff's passkeys. Only shown if you have
  `admin.passkeys.reset`.
- **Account**: your passkeys.

## Signing in: passkeys only

The only way to sign in is a **passkey**: Face ID, Touch ID, Windows Hello, your phone or a
security key. There is no password and no name to type: you press **Sign in with passkey**, your
device offers the panel passkeys it holds, and the one you pick says who you are. Your device
also checks it is you (fingerprint, face or PIN). You need the `admin.panel` permission.

**Getting a passkey.** You make one from a **setup link**, which works **once**, for **24
hours**. Links come from:

- **The server console:** `adminsetup <player>`, for anyone. This is how the first admin gets in.
- **An admin with `admin.passkeys.reset`:** on the panel's Staff page, or `:adminsetup <player>`
  in the hotel.
- **Yourself, once:** `:adminsetup` in the hotel, but only while you have no passkey yet.

**Lost your passkey?** There is no "forgot password". An admin with `admin.passkeys.reset` gives
you a new setup link. Using it **removes all your old passkeys**, so the lost device stops
working. To avoid needing that, keep a second passkey: add one on the Account page, where you
confirm with a passkey you already have first.

**Who can reset whom.** A setup link is the account: whoever opens it first can sign in as that
player. So an admin can only make a link for a player **whose every permission they hold too**.
A moderator cannot take over the owner's account. Nobody can reset their own passkey this way,
only add more while signed in.

**Protection on the server:**

- Your permissions are checked on every request, so taking away `admin.panel` locks you out at
  once.
- Each address gets 10 sign-in attempts a minute.
- Passkeys store public keys only.
- Setup links, passkey prompts and sessions are single-use or short-lived.
- A server restart signs everyone out and voids open links.

## Running it locally

1. **Turn on the API** in the server's `appsettings.Development.json`:

   ```json
   "Turbo": {
       "Admin": {
           "Enabled": true
       }
   }
   ```

   It listens on `http://127.0.0.1:8090`. Its `PanelUrl` defaults to `http://localhost:5173`, the
   address the panel's dev server runs at.

2. **Give yourself access** at the server console, then start Turbo:

   ```
   perm user <your name> set admin.panel
   perm user <your name> set admin.passkeys.reset
   adminsetup <your name>
   ```

   The `admin` group's `*` covers both permissions.

3. **Start the panel:**

   ```bash
   yarn install
   yarn dev
   ```

   The dev server proxies `/api` to Turbo, just as the deployed site does.

4. **Open the setup link** from step 2 (`http://localhost:5173/setup#token=...`) and make your
   passkey. Passkeys work on `localhost` without HTTPS.

## Deploying on its own subdomain (Ploi)

The panel is a static site on its own subdomain, for example `admin.example.com`. Its nginx
serves the built files and proxies `/api` to Turbo, so the browser only ever talks to that one
address. That means no cross-origin requests, and passkeys are bound to that domain.

1. **Create the site** in Ploi for `admin.example.com`, from this repository, and issue a
   certificate in its SSL tab. Passkeys need HTTPS.

2. **Deploy script** (Site > Deployment):

   ```bash
   cd {SITE_DIRECTORY}
   git pull origin {BRANCH}
   bash scripts/ploi/deploy.sh
   ```

   This needs Node 22 or newer on the server. Yarn comes with Node, through Corepack.

3. **nginx** (Site > Manage > Edit NGINX configuration): copy in
   [`scripts/ploi/nginx.conf`](scripts/ploi/nginx.conf). Set `root` to the site's `dist`
   folder, and the `/api/` proxy to where Turbo listens. Behind Cloudflare, also restore the
   real client address as that file shows, or every staff member shares one rate limit.

4. **The Turbo site's Environment tab:**

   ```
   TURBO_ADMIN_ENABLED=true
   TURBO_ADMIN_PANEL_URL=https://admin.example.com
   ```

   `PANEL_URL` is the domain passkeys are bound to, and where setup links point. Deploy Turbo
   after changing it.

5. **The first admin.** There are two ways in:

   - **From the hotel:** if your account already holds `admin.panel` (the `admin` group's `*`
     covers it), type `:adminsetup` in the hotel and open the link.
   - **From the server console:** a Ploi daemon has no terminal, but Supervisor can attach one.
     SSH in as a user with sudo, find the daemon's program name with `sudo supervisorctl status`,
     then run `sudo supervisorctl fg <program name>`. Type `perm user <name> set admin.panel`,
     then `adminsetup <name>`. The link appears in the output. Ctrl+C detaches and leaves Turbo
     running.

   After that, give other staff `admin.panel` and send them links from the Staff page.

**Changing the panel's domain** later means everyone needs a new passkey, because each passkey
belongs to one domain. Send setup links for that.

To serve the API from a different origin instead, build with `VITE_API_URL` set to it (see
`.env.example`), and keep `TURBO_ADMIN_PANEL_URL` pointing at the panel.

## Scripts

| Script | |
| --- | --- |
| `yarn dev` | Development server on port 5173, proxying `/api` to Turbo |
| `yarn build` | Type-check and build to `dist/` |
| `yarn typecheck` | Type-check only |
| `yarn lint` / `yarn lint:fix` | ESLint, with the same style as nitro-next |

## Stack

React 19, React Router, TanStack Query, Zustand, Tailwind 4 and Vite, on Yarn 4. Passkeys use
the browser's WebAuthn API directly; the server checks them with the
[Fido2](https://github.com/passwordless-lib/fido2-net-lib) library.

Hand-item controls are under **Library → Hand items** and a vending definition's **Behaviour**
section. They use the server's local catalogue and authenticated PNG previews. Selected custom
IDs and unrelated extra-data properties are retained when the picker edits a definition.

Run `corepack yarn test` for the vending JSON preservation checks, alongside `typecheck`, `lint`
and `build`.
