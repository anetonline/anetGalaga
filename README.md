# A‑NET GALAGA — Synchronet JS Door Game

A-NET GALAGA is a full-featured Synchronet door-game written in JavaScript (galaga.js).  
Version: .06 — by StingRay (A‑Net Online BBS)  
Website: https://a-net-online.lol

This README gives installation instructions, requirements, quick setup steps and gameplay basics so you can drop
the game into your Synchronet BBS xtrn directory and get testing quickly.

---

## Requirements

- Synchronet 3.19 or newer (Windows or Linux).
- dd_lightbar_menu.js — required by the main menu (must be accessible via `require("dd_lightbar_menu.js","DDLightbarMenu")'.
- scroller (xtrn/scroller/scroller.js) — used to view the ANSI scoreboard and instruction pages.
  - If you don’t have scroller, download from Constructive Chaos BBS (Codefenix) at ConChaos.synchro.net.
- frame.js, scrollbar.js, event-timer.js — standard Synchronet JS packages.
- Optional: `sprite.js` and an `art/` folder containing .ans files for enhanced ANSI art. If absent, the game falls back to colored ASCII.

Notes:
- Works in Windows and Linux.
- In Linux, ensure read/write permissions for the game directory and data directories (see below).

---

## Files & Example Locations

Place the primary game file and optional art in your Synchronet xtrn / external programs directory:

Example Linux:
- Game directory: `/sbbs/xtrn/galaga`
- Script: `/sbbs/xtrn/galaga/galaga.js`
- Scroller: `/sbbs/xtrn/scroller` (standard)

Example Windows:
- Game directory: `C:\sbbs\xtrn\galaga`
- Script: `C:\sbbs\xtrn\galaga\galaga.js`
- Scroller: `C:\sbbs\xtrn\scroller`

The script will create and use `galaga_data\players\` and `galaga_data\leaderboards\` under the xtrn dir for saves and leaderboard JSON.

---

## File Permissions (Linux)

If running on Linux, make sure the game directory and data directories are readable and writable by the Synchronet user:
- Example:
  - chown -R sbbs:sbbs /sbbs/xtrn/galaga
  - chmod -R 755 /sbbs/xtrn/galaga
- Ensure Synchronet user can write to `galaga_data/` so player saves and leaderboards are stored.

---

## SBBS SCFG — External Program Setup

Add the game in Synchronet Configuration (SCFG) → External Programs:

- Directory: path to the game directory (e.g. `/sbbs/xtrn/galaga` or `C:\sbbs\xtrn\galaga`)
- Command: ?galaga.js
- Menu text: A-NET GALAGA (or whatever label you prefer)
- Make sure Options allow ANSI output as appropriate for your system.

---

## Quick Startup Checklist

1. Put `galaga.js` in your game directory (e.g. `/sbbs/xtrn/galaga/galaga.js`).
2. Make sure `scroller` is installed at `xtrn/scroller/scroller.js`.
3. Ensure your Synchronet user has write permission to create `/galaga_data/` directories.
4. Configure External Program in SCFG:
   - Directory: game directory
   - Command: `?galaga.js`
5. Launch the external program from the BBS.

---

## Controls (in-game)

- Move left: `A`
- Move right: `D`
- Fire: `Space` (also accepted: `W`, `F`)
- Pause: `P`
- Quit: `Q` or `Esc`

In menus:
- Use Up / Down arrow keys and `ENTER` to select
- `Q` to quit/go back

---

## Gameplay Basics

- Objective: clear waves of enemies and beat boss waves. Advance levels to increase difficulty.
- Enemy types:
  - `>` Standard enemy — small HP, point reward.
  - `}` Shooter — fires bullets at player.
  - `O` Capture enemy — may capture your ship; collect rescue power-up to free yourself.
  - `W` Boss — multi-hit enemy that appears at designated levels.
  - `<` Homing (if present) — attempts to adjust position toward player.
- Power-ups:
  - `+` Extra life
  - `P` Weapon upgrade (temporary in-run; permanent upgrades via Shop)
  - `$` Score bonus
  - `R` Rescue (frees you if captured)
- Weapon levels: L1..L5. Higher levels grant multi-shot patterns and more damage.
- Capture mechanic: certain enemies can capture you; while captured you cannot fire. Collect `R` Rescue or wait to be freed (or lose a life if held too long).

---

## Shop & Credits

- Earn credits via gameplay (some levels give credits), or convert score to credits in Shop.
- Shop options:
  - Permanent weapon upgrade (costs credits)
  - Buy extra lives
  - Convert score to credits
- Shop is accessible from the main menu.

---

## Leaderboard / Scroller

- High scores are stored in JSON under `galaga_data/leaderboards/galaga-leaderboard.json`.
- An ANSI scoreboard `galaga-scores.ans` is generated in the exec_dir when the leaderboard updates.
- Use the "High Scores (ANSI)" option in the main menu to view with scroller.

If scroller is missing, the game displays text fallback of scores in the console.

Download scroller if needed from:
- Constructive Chaos BBS (Codefenix) — ConChaos.synchro.net

---

## Troubleshooting

- “DDLightbarMenu not found!” — ensure `dd_lightbar_menu.js` is present in your `exec_dir` (the same location that door_scores.js uses) and is accessible to require. If your door_scores runs, copy the same dd_lightbar_menu.js to the galaga exec dir.
- Scroller not found — install scroller in `xtrn/scroller` or adjust paths accordingly.
- Permissions errors on Linux — ensure Synchronet user has read/write permissions on the game directory and on `galaga_data`.

---

## Credits & License

- Author: StingRay — A-Net Online BBS (https://a-net-online.lol)

- Scroller by Codefenix (Constructive Chaos BBS) required for ANSI viewing.

- Uses Synchronet JS APIs and standard utilities.

License: You may host and distribute this script for use on Synchronet BBS systems. If you modify or redistribute, please retain author credits.
