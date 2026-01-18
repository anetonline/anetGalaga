/*
  A-NET GALAGA (galaga.js) - Version: .06
  Author: StingRay - A-Net Online BBS (https://a-net-online.lol)

  Notes:

  - Requirements:
      * dd_lightbar_menu.js available for require("dd_lightbar_menu.js","DDLightbarMenu")
      * frame.js, scrollbar.js, event-timer.js (standard Synchronet)
      * xtrn/scroller/scroller.js (for viewing ANSI files) -By: Codefenix of Constructive Chaos BBS (ConChaos.synchro.net)
      * Optional: sprite.js and art/*.ans files to use richer ANSI sprites
  - Features:
      * Full game engine: 50 levels, formations, boss waves (multi-phase), enemy types,
        capture/rescue mechanic, powerups, weapon levels, explosions, HUD, sounds(testing).
      * Persistent player data and leaderboard JSON.
      * ANSI scoreboard file (galaga-scores.ans) for scroller viewing.
      * Instructions submenu (topics opened via scroller-generated ANSI).
      * Shop for permanent upgrades and converting score -> credits.
  - Installation checklist (quick):
      1) Put this file in your Synchronet xtrn dir (e.g. sbbs/xtrn/galaga.js).
      2) Ensure scroller exists at xtrn/scroller/scroller.js (Get from Constructive Chaos BBS - ConChaos.synchro.net).
  - Usage: run galaga.js from Synchronet's external programs ?galaga.js
*/

load("sbbsdefs.js");

require("dd_lightbar_menu.js", "DDLightbarMenu");

load("frame.js");
load("scrollbar.js");
load("event-timer.js");
try { load("sprite.js"); } catch(e) { /* sprite optional */ }

/* Ensure CP437 glyph rendering */
try { if (typeof console !== "undefined" && typeof console.charset === "string") console.charset = "CP437"; } catch(e){}

/* ------------------------------ Paths & Dirs ------------------------------ */
var BASE_DIR = (typeof js !== "undefined" && js.exec_dir) ? js.exec_dir : ".\\";
if (BASE_DIR.slice(-1) !== "\\" && BASE_DIR.slice(-1) !== "/") BASE_DIR += "\\";
var DATA_DIR = BASE_DIR + "galaga_data\\";
var PLAYERS_DIR = DATA_DIR + "players\\";
var LEADERBOARDS_DIR = DATA_DIR + "leaderboards\\";
var ART_DIR = BASE_DIR + "art\\";
function ensureDirs(){ var dirs = [DATA_DIR, PLAYERS_DIR, LEADERBOARDS_DIR, ART_DIR]; for(var i=0;i<dirs.length;i++){ try{ if(!file_exists(dirs[i])) mkdir(dirs[i]); }catch(e){} } }

/* ------------------------------ Utilities ------------------------------ */
function readJsonFile(fp){ try{ if(!file_exists(fp)) return null; var f = new File(fp); if(!f.open("r")) return null; var raw = f.readAll().join(""); f.close(); return JSON.parse(raw); }catch(e){ return null; } }
function writeJsonFile(fp,obj){ try{ var f = new File(fp); if(!f.open("w")) return false; f.write(JSON.stringify(obj,null,2)); f.close(); return true; }catch(e){ return false; } }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function repeatString(s,n){ var r=""; for(var i=0;i<n;i++) r+=s; return r; }
function padRight(s,len){ s = String(s); while(s.length < len) s += " "; if(s.length > len) return s.substring(0,len); return s; }
function padLeft(s,len){ s = String(s); while(s.length < len) s = " " + s; if(s.length > len) return s.substring(0,len); return s; }

/* ------------------------------ Colors ------------------------------ */
var S = { reset:"\x01n", bright:"\x01h", red:"\x01r", green:"\x01g", yellow:"\x01y", mag:"\x01m", cyan:"\x01c", white:"\x01w", blue:"\x01b" };
var ESC = "\x1b[";
function ansi(code){ return ESC + code + "m"; }
var A = { reset: ansi("0"), bright: ansi("1"), blue: ansi("1;34"), cyan: ansi("1;36"), yellow: ansi("1;33"), white: ansi("1;37"), red: ansi("1;31"), mag: ansi("1;35") };

/* ------------------------------ Persistence ------------------------------ */
function playerFile(userNumber){ return PLAYERS_DIR + "player-" + userNumber + ".json"; }
function loadPlayer(userNumber){
    var p = playerFile(userNumber);
    var j = readJsonFile(p);
    if(!j) return {
        userNumber:userNumber,
        alias:(typeof user !== "undefined" && user && user.alias) ? user.alias : "Guest",
        bestScore:0,
        totalPlays:0,
        totalKills:0,
        weaponLevel:1,
        credits:0,
        unlocked:{},
        lives:3,
        perkPoints:0,
        achievements:{}
    };
    if(!j.weaponLevel) j.weaponLevel = 1;
    if(!j.lives) j.lives = 3;
    if(!j.credits) j.credits = 0;
    if(!j.perkPoints) j.perkPoints = 0;
    if(!j.achievements) j.achievements = {};
    return j;
}
function savePlayer(userNumber,obj){ return writeJsonFile(playerFile(userNumber), obj); }

/* Leaderboard */
function lbFile(){ return LEADERBOARDS_DIR + "galaga-leaderboard.json"; }
function loadLeaderboard(){ var j = readJsonFile(lbFile()); return j || []; }
function saveLeaderboard(arr){ return writeJsonFile(lbFile(), arr); }

/* ------------------------------ Constants ------------------------------ */
var GAME_FPS = 30;
var FRAME_MS = Math.floor(1000 / GAME_FPS);
var PLAYER_MAX_LIVES = 5;
var MAX_LEVEL = 50;

/* ------------------------------ Formation Presets ------------------------------ */
var FORMATIONS = {
    line: function(cols, rows, left, right, top){
        var arr=[], gap = Math.max(3, Math.floor((right-left)/(cols+1))), sx = left + gap;
        for(var r=0;r<rows;r++) for(var c=0;c<cols;c++) arr.push({x: sx + c*gap, y: top + r*2});
        return arr;
    },
    v: function(cols, rows, left, right, top){
        var arr=[], center = Math.floor((left+right)/2), spread = Math.min(6, Math.floor((right-left)/10));
        for(var r=0;r<rows;r++){ var rowCols = Math.max(1, cols - r); for(var c=0;c<rowCols;c++){ var offset = (c - Math.floor(rowCols/2)) * spread; arr.push({x:center + offset, y: top + r*2}); } }
        return arr;
    },
    wedge: function(cols, rows, left, right, top){
        var arr=[], gap = Math.max(3, Math.floor((right-left)/(cols+1))), sx = left + gap;
        for(var r=0;r<rows;r++){ var rowCols = Math.max(1, cols - Math.floor(r/2)); for(var c=0;c<rowCols;c++){ arr.push({x: sx + c*gap + Math.floor(r*0.5), y: top + r*2}); } }
        return arr;
    }
};

/* ------------------------------ Explosions & Sound (test) ------------------------------ */
var EXPLOSION_FRAMES = [["*"],["@","*"],["#","@","*"],[" "]];
function playSound(type){
    // sounds intentionally disabled
}

/* ------------------------------ ANSI scoreboard writer ------------------------------ */
var SCORE_USE_PIPES = true;
var SCORE_COLS = { pos:4, name:24, score:8, date:10 };
function writeScoresAnsi(){
    try{
        var lb = loadLeaderboard();
        var lines = [];
        var now = new Date();
        lines.push(A.blue + A.bright + "        A-NET GALAGA - LOCAL LEADERBOARD        " + A.reset);
        lines.push("");
        lines.push(A.white + "Last Updated: " + now.toISOString().slice(0,10) + " " + now.toISOString().slice(11,19) + A.reset);
        lines.push("");
        function rowToAnsi(pos,name,score,date){
            name = name.toString().substring(0,SCORE_COLS.name);
            var posStr = padRight(pos,SCORE_COLS.pos);
            var nameStr = padRight(name,SCORE_COLS.name);
            var scoreStr = padLeft(score,SCORE_COLS.score);
            var dateStr = padRight(date,SCORE_COLS.date);
            if(SCORE_USE_PIPES) return A.white + posStr + " | " + nameStr + " | " + scoreStr + " | " + dateStr + A.reset;
            return A.white + posStr + "  " + nameStr + "  " + scoreStr + "  " + dateStr + A.reset;
        }
        if(SCORE_USE_PIPES) lines.push(A.blue + "|" + A.reset + " " + A.bright + A.white + format("%-4s | %-24s | %8s | %s","Pos","Player","Score","Date") + A.reset + " " + A.blue + "|" + A.reset);
        else lines.push(A.bright + A.white + format("%-4s  %-24s  %8s  %s","Pos","Player","Score","Date") + A.reset);
        lines.push("");
        if(!lb || lb.length === 0){ lines.push(A.white + "No scores recorded yet." + A.reset); lines.push(""); } else {
            for(var i=0;i<Math.min(lb.length,200);i++){
                var e = lb[i];
                lines.push(rowToAnsi((i+1)+".", e.alias || "Unknown", e.score || 0, (e.date || "").slice(0,10)));
            }
        }
        lines.push("");
        lines.push(A.cyan + "Generated by A-NET GALAGA - " + (new Date()).toISOString() + A.reset);
        lines.push("");
        var content = lines.join("\r\n");
        var path = BASE_DIR + "art\\galaga-scores.ans";
        var f = new File(path);
        if(f.open("w")){ f.write(content); f.close(); }
    }catch(e){}
}

/* ------------------------------ Helpers ------------------------------ */
function hitTest(bx,by,ex,ey,tol){ tol = (typeof tol === "undefined") ? 0.6 : tol; return (Math.abs(bx-ex) <= tol && Math.abs(by-ey) <= tol); }

/* ------------------------------ Frame border helper ------------------------------ */
function drawBorder(frame,color){
    var w = frame.width, h = frame.height;
    try{
        frame.pushxy();
        for(var y=1;y<=h;y++){
            for(var x=1;x<=w;x++){
                if(x>1 && x<w && y>1 && y<h) continue;
                frame.gotoxy(x,y);
                var ch;
                if(y==1 && x==1) ch = ascii(218);
                else if(y==1 && x==w) ch = ascii(191);
                else if(y==h && x==1) ch = ascii(192);
                else if(y==h && x==w) ch = ascii(217);
                else if(y==1 || y==h) ch = ascii(196);
                else ch = ascii(179);
                frame.putmsg((color || S.blue) + ch + S.reset);
            }
        }
        frame.popxy();
    }catch(e){}
}

/* ------------------------------ UI header ------------------------------ */
var WIDTH = console.screen_columns || 80;
var HEIGHT = console.screen_rows || 24;
function drawHeader(){
    console.clear();
    console.gotoxy(1,1);
    var title = "A-Net Galaga";
    var pad = Math.max(0, Math.floor((WIDTH - title.length) / 2));
    console.print(S.bright + S.blue + repeatString(" ", pad) + title + repeatString(" ", pad) + S.reset + "\r\n\r\n");
    console.gotoxy(1, HEIGHT - 1);
    console.print("\x01kPress \x01gUP\x01r/\x01gDOWN \x01kor \x01rENTER\x01g to select \x01rQ\x01g to quit.");
}

/* ------------------------------ Instructions submenu ------------------------------ */
function writeInstructionAnsi(topic, lines){
    try{
        var header = A.blue + A.bright + "        A-NET GALAGA - " + topic + "        " + A.reset + "\r\n\r\n";
        var content = header + lines.join("\r\n") + "\r\n";
        var path = BASE_DIR + ("art\\galaga-instr-" + topic.replace(/\s+/g,"_").toLowerCase() + ".ans");
        var f = new File(path);
        if(f.open("w")){ f.write(content); f.close(); return path; }
    }catch(e){}
    return null;
}
function showInstructions(){
    var topics = [
        { id:"controls", name:"Controls (keys & mapping)" },
        { id:"objective", name:"Objective & Scoring" },
        { id:"symbols", name:"Ships & Symbols (legend)" },
        { id:"powerups", name:"Power-Ups Explained" },
        { id:"capture", name:"Capture / Rescue mechanic" }
    ];

    drawHeader();
    var menu = new DDLightbarMenu(5, 3, WIDTH - 10, HEIGHT - 5);
    for(var i=0;i<topics.length;i++) menu.Add(topics[i].name, i+1);
    menu.colors.itemColor = "\x01k\x01h";
    menu.colors.selectedItemColor = "\x01b\x01h"; // blue
    menu.colors.borderColor = "\x01b";
    menu.AddAdditionalQuitKeys("qQ");
    menu.borderEnabled = true;
    menu.scrollbarEnabled = true;
    var v = menu.GetVal();
    if(!v) return;
    var t = topics[parseInt(v,10)-1];
    if(!t) return;

    var lines = [];
    if(t.id === "controls"){
        lines.push(A.bright + A.white + "Controls" + A.reset);
        lines.push("");
        lines.push("Move Left: A");
        lines.push("Move Right: D");
        lines.push("Fire: SPACE (or W / F)");
        lines.push("Pause: P");
        lines.push("Quit: Q or ESC");
        lines.push("");
        lines.push("In menus use the arrow keys and ENTER to select.");
    } else if(t.id === "objective"){
        lines.push(A.bright + A.white + "Objective & Scoring" + A.reset);
        lines.push("");
        lines.push("Clear waves of enemies and beat boss waves.");
        lines.push("Collect power-ups and credits to upgrade in the Shop.");
        lines.push("Score and medal achievements for high scores.");
        lines.push("Don't let enemy ships reach the bottom row.");
        lines.push("Once an enemy reaches the bottom row there is NO WAY OUT!");
    } else if(t.id === "symbols"){
        lines.push(A.bright + A.white + "Ships & Symbols" + A.reset);
        lines.push("");
        lines.push(A.white + "> " + A.reset + "- Standard enemy");
        lines.push(A.mag + "} " + A.reset + "- Shooter enemy (fires bullets)");
        lines.push(A.yellow + "O " + A.reset + "- Capture enemy (can capture your ship)");
        lines.push(A.cyan + "W " + A.reset + "- Boss (multi-hit)");
        lines.push(A.green + "* " + A.reset + "- Explosion");
    } else if(t.id === "powerups"){
        lines.push(A.bright + A.white + "Power-Ups" + A.reset);
        lines.push("");
        lines.push(A.green + "+ " + A.reset + "- Extra Life");
        lines.push(A.yellow + "P " + A.reset + "- Weapon Upgrade");
        lines.push(A.cyan + "$ " + A.reset + "- Score Bonus");
        lines.push(A.white + "R " + A.reset + "- Rescue - frees you if captured");
    } else if(t.id === "capture"){
        lines.push(A.bright + A.white + "Capture / Rescue" + A.reset);
        lines.push("");
        lines.push("Some enemies can capture your ship.");
        lines.push("While captured you cannot fire. Collect a Rescue power-up to free yourself.");
        lines.push("If captured too long you may lose a life.");
    }

    var path = writeInstructionAnsi(t.name, lines);
    if(path && file_exists(path)){
        try{ bbs.exec('?../xtrn/scroller/scroller.js "' + path + '" "A-NET GALAGA - ' + t.name + '" top'); return; }catch(e){ try{ bbs.exec('?scroller/scroller.js "' + path + '" "A-NET GALAGA - ' + t.name + '" top'); return; }catch(e2){} }
    }

    console.clear();
    for(var li=0;li<lines.length;li++) console.print(lines[li] + "\r\n");
    console.print("\r\nPress any key to continue...\r\n");
    console.getkey();
}

/* ------------------------------ High Scores (scroller) ------------------------------ */
function showHighScoresScroller(){
    ensureDirs();
    writeScoresAnsi();
    var scrollerPath = BASE_DIR + "art\\galaga-scores.ans";
    if(file_exists(scrollerPath)){
        try { bbs.exec('?../xtrn/scroller/scroller.js "' + scrollerPath + '" "A-NET GALAGA - LOCAL LEADERBOARD" top'); return; }catch(e){ try{ bbs.exec('?scroller/scroller.js "' + scrollerPath + '" "A-NET GALAGA - LOCAL LEADERBOARD" top'); return; }catch(e2){} }
    }
    console.clear();
    console.print(S.bright + S.cyan + "GALAGA - local leaderboard (scroller not found)" + S.reset + "\r\n\r\n");
    var lb = loadLeaderboard();
    if(!lb || lb.length === 0) console.print("No scores recorded yet.\r\n\r\n");
    else {
        for(var i=0;i<Math.min(lb.length,50);i++){
            var e = lb[i];
            console.print(format("%2s) %-20s %7s %s\r\n", (i+1)+".", e.alias, e.score, e.date.slice(0,10)));
        }
        console.print("\r\n");
    }
    console.print("Press any key...\r\n");
    console.getkey();
}

/* ------------------------------ Shop ------------------------------ */
function showShop(userNumber){
    var pdata = loadPlayer(userNumber);
    var opts = [
        { id:"weapon", name:"Upgrade Weapon (permanent) - Cost: 200 credits", cost:200, effect:function(p){ p.weaponLevel = Math.min(5, (p.weaponLevel||1) + 1); } },
        { id:"life", name:"Buy 1 Life - Cost: 100 credits", cost:100, effect:function(p){ p.lives = Math.min(PLAYER_MAX_LIVES, (p.lives||3) + 1); } },
        { id:"convert", name:"Convert 500 score -> 50 credits", cost:0, effect:null }
    ];

    drawHeader();
    var menu = new DDLightbarMenu(5, 3, WIDTH - 10, HEIGHT - 6);
    for(var i=0;i<opts.length;i++) menu.Add(opts[i].name, i+1);
    menu.colors.itemColor = "\x01k\x01h";
    menu.colors.selectedItemColor = "\x01b\x01h";
    menu.colors.borderColor = "\x01b";
    menu.AddAdditionalQuitKeys("qQ");
    menu.borderEnabled = true;
    menu.scrollbarEnabled = true;
    var v = menu.GetVal();
    if(!v) return;
    var idx = parseInt(v,10) - 1;
    var it = opts[idx];
    if(!it) return;
    if(it.id === "convert"){
        var avail = Math.floor((pdata.score || 0) / 500);
        if(avail > 0){
            var conv = avail * 50;
            pdata.credits = (pdata.credits || 0) + conv;
            pdata.score -= avail * 500;
            savePlayer(userNumber, pdata);
            console.clear(); console.print("Converted " + (avail*500) + " score to " + conv + " credits.\r\nPress any key..."); console.getkey();
        } else { console.clear(); console.print("Not enough score (need >= 500)\r\nPress any key..."); console.getkey(); }
        return;
    }
    if(pdata.credits >= it.cost){ pdata.credits -= it.cost; it.effect(pdata); savePlayer(userNumber, pdata); console.clear(); console.print("Purchase complete.\r\nPress any key..."); console.getkey(); }
    else { console.clear(); console.print("Not enough credits.\r\nPress any key..."); console.getkey(); }
}

/* ------------------------------ Main menu ------------------------------ */
function showMainMenu(){
    drawHeader();
    var lbMenu = new DDLightbarMenu(5, 3, WIDTH - 10, HEIGHT - 5);
    lbMenu.Add("Play Galaga", 1);
    lbMenu.Add("Instructions", 2);
    lbMenu.Add("High Scores", 3);
    lbMenu.Add("Shop / Upgrades", 4);
    lbMenu.Add("My Profile", 5);
    lbMenu.Add("Quit", 6);

    lbMenu.colors.itemColor = "\x01k\x01h";
    lbMenu.colors.selectedItemColor = "\x01b\x01h"; // blue selected
    lbMenu.colors.borderColor = "\x01b";
    lbMenu.AddAdditionalQuitKeys("qQ");
    lbMenu.borderEnabled = true;
    lbMenu.scrollbarEnabled = true;

    return lbMenu.GetVal();
}

/* ------------------------------ Level scaling ------------------------------ */
function getLevelConfig(level){
    level = Math.max(1, Math.min(MAX_LEVEL, level));
    var rows = Math.min(5, 1 + Math.floor(level / 10) + (level > 20 ? 1 : 0));
    var cols = Math.min(12, 4 + Math.floor(level / 3));
    var baseHP = 1 + Math.floor(level / 15);
    var speedFactor = 0.10 + (level * 0.004);
    var fireChance = 0.0015 + (level * 0.0008);
    return { rows: rows, cols: cols, baseHP: baseHP, speedFactor: speedFactor, fireChance: fireChance };
}

/* ------------------------------ Game engine ------------------------------ */

function startGalaga(userNumber){
    ensureDirs();
    console.clear(); try{ console.home(); }catch(e){}

    var pdata = loadPlayer(userNumber);
    pdata.alias = pdata.alias || ((typeof user !== "undefined" && user && user.alias) ? user.alias : "Guest");
    pdata.lives = (typeof pdata.lives === "number") ? pdata.lives : 3;
    pdata.weaponLevel = pdata.weaponLevel || 1;
    pdata.score = pdata.score || 0;
    pdata.credits = pdata.credits || 0;

    var attr = console.attributes;
    var sys_status = bbs.sys_status;
    if(typeof SS_MOFF !== "undefined") bbs.sys_status |= SS_MOFF;

    var cols = (console.screen_columns && console.screen_columns > 0) ? console.screen_columns : 80;
    var rows = (console.screen_rows && console.screen_rows > 0) ? console.screen_rows : 24;

    console.clear();
    var mainFrame = new Frame(1,1,cols,rows, BG_BLACK|WHITE);
    mainFrame.open();

    var titleFrame = new Frame(mainFrame.x, mainFrame.y, cols, 1, BG_BLUE|WHITE, mainFrame);
    titleFrame.open();

    var fieldHeight = rows - 6;
    var fieldFrame = new Frame(mainFrame.x, mainFrame.y + 1, cols, fieldHeight, BG_BLACK|WHITE, mainFrame);
    fieldFrame.open();

    var hudFrame = new Frame(mainFrame.x, mainFrame.y + 1 + fieldHeight, cols, 3, BG_BLUE|WHITE, mainFrame);
    hudFrame.open();

    var playLeft = 2, playRight = fieldFrame.width - 2, playTop = 1, playBottom = fieldFrame.height - 2;

    var level = 1, running = true, lastFrame = Date.now(), frameAcc = 0, ticks = 0;
    var player = { x: Math.floor(fieldFrame.width/2), y: playBottom, _cooldown:0, weaponLevel: pdata.weaponLevel, captured:false, captureTimer:0 };
    var enemies = [], pbullets = [], ebullets = [], powerups = [], explosions = [], boss = null;

    // Additional features: homing bullets, boss phase tracker, achievements stub
    var achievements = pdata.achievements || {};

    function drawTitle(){
        titleFrame.clear();
        var title = S.bright + S.blue + "A-NET GALAGA" + S.reset + " - Player: " + S.bright + S.cyan + pdata.alias + S.reset;
        titleFrame.putmsg(title.substring(0, cols));
    }

    function addExplosion(x,y){
        explosions.push({ x:x, y:y, frame:0, life:EXPLOSION_FRAMES.length * 4, frames:EXPLOSION_FRAMES });
    }

    function spawnWave(lvl){
        enemies = []; pbullets = []; ebullets = []; powerups = []; explosions = []; boss = null;
        // every 10th level -> boss
        if(lvl % 10 === 0){
            boss = { x: Math.floor((playLeft+playRight)/2), y: Math.max(3, playTop+2), hp: 12 + Math.floor(lvl/10)*6, phase:0, guns:[-5,-2,0,2,5], phaseTimer:0, enraged:false };
            return;
        }
        var cfg = getLevelConfig(lvl);
        var fNames = Object.keys(FORMATIONS);
        var pick = fNames[Math.floor(Math.random()*fNames.length)];
        var coords = FORMATIONS[pick](cfg.cols, cfg.rows, playLeft, playRight, playTop+1);
        for(var i=0;i<coords.length;i++){
            var pos = coords[i];
            var r = Math.random();
            var type;
            if(r < 0.06) type = "homing"; // new: homing enemy
            else if(r < 0.14) type = "capture";
            else if(r < 0.34) type = "shooter";
            else type = "normal";
            var ch = type === "capture" ? "O" : (type === "shooter" ? "}" : (type === "homing" ? "<" : ">"));
            var col = type === "capture" ? S.bright + S.yellow + S.reset : (type === "shooter" ? S.bright + S.mag + S.reset : (type === "homing" ? S.bright + S.cyan + S.reset : S.bright + S.red + S.reset));
            enemies.push({ x: pos.x + (Math.random()*0.6-0.3), y: pos.y + (Math.random()*0.4-0.2), hp: cfg.baseHP + (type === "shooter" ? 1 : 0), char: ch, color: col, type: type, _dir: (Math.random() < 0.5 ? -1 : 1), _offset: Math.random(), _diving:0, _dTX:0 });
        }
    }

    function playerFire(){
        if(player.captured) return;
        if(player._cooldown > 0) return;
        var lvl = player.weaponLevel || 1;
        player._cooldown = Math.max(2, 8 - lvl);
        playSound("shoot");
        var baseDmg = 1 + Math.floor((lvl - 1)/2);
        var speed = 1.0 + (lvl * 0.08);
        if(lvl === 1){
            pbullets.push({ x: player.x, y: player.y - 1, dx: 0, dy: -speed, damage: baseDmg, life: 100 });
        } else if(lvl === 2){
            pbullets.push({ x: player.x - 0.4, y: player.y - 1, dx: -0.12, dy: -speed, damage: baseDmg, life: 100 });
            pbullets.push({ x: player.x + 0.4, y: player.y - 1, dx: 0.12, dy: -speed, damage: baseDmg, life: 100 });
        } else if(lvl === 3){
            pbullets.push({ x: player.x, y: player.y - 1, dx: 0, dy: -speed, damage: baseDmg, life: 100 });
            pbullets.push({ x: player.x - 0.45, y: player.y - 1, dx: -0.16, dy: -speed, damage: baseDmg, life: 100 });
            pbullets.push({ x: player.x + 0.45, y: player.y - 1, dx: 0.16, dy: -speed, damage: baseDmg, life: 100 });
        } else if(lvl === 4){
            pbullets.push({ x: player.x - 0.25, y: player.y - 1, dx: -0.08, dy: -speed, damage: baseDmg+1, life: 100 });
            pbullets.push({ x: player.x + 0.25, y: player.y - 1, dx: 0.08, dy: -speed, damage: baseDmg+1, life: 100 });
            pbullets.push({ x: player.x, y: player.y - 1, dx: 0, dy: -speed, damage: baseDmg+1, life: 100 });
        } else {
            pbullets.push({ x: player.x - 0.8, y: player.y - 1, dx: -0.18, dy: -speed, damage: baseDmg+1, life: 100 });
            pbullets.push({ x: player.x - 0.2, y: player.y - 1, dx: -0.06, dy: -speed, damage: baseDmg+1, life: 100 });
            pbullets.push({ x: player.x + 0.2, y: player.y - 1, dx: 0.06, dy: -speed, damage: baseDmg+1, life: 100 });
            pbullets.push({ x: player.x + 0.8, y: player.y - 1, dx: 0.18, dy: -speed, damage: baseDmg+1, life: 100 });
        }
    }

    function enemyFireFrom(e){
        // homing enemy fires slower homing bullet; shooter fires straight
        if(e.type === "homing"){
            ebullets.push({ x: e.x, y: e.y + 1, dy: 0.25, homing:true, life: 300, targetX: player.x, targetY: player.y });
        } else {
            ebullets.push({ x: e.x, y: e.y + 1, dy: 0.6 + Math.random()*0.2, life: 200 });
        }
    }

    function maybeSpawnPowerup(ex,ey){
        var r = Math.random();
        if(r < 0.05) powerups.push({ x: ex, y: ey, type: "life", life: 400 });
        else if(r < 0.20) powerups.push({ x: ex, y: ey, type: "weapon", life: 400 });
        else if(r < 0.35) powerups.push({ x: ex, y: ey, type: "score", life: 400 });
        else if(r < 0.44) powerups.push({ x: ex, y: ey, type: "rescue", life: 400 });
    }

    function updateBullets(){
        for(var i=pbullets.length-1;i>=0;i--){
            var b = pbullets[i]; b.x += b.dx; b.y += b.dy; b.life--;
            if(b.y < playTop || b.x < 1 || b.x > fieldFrame.width || b.life <= 0) pbullets.splice(i,1);
        }
        for(var j=ebullets.length-1;j>=0;j--){
            var eb = ebullets[j];
            if(eb.homing){
                // simple homing: adjust dx towards player
                var tx = player.x - eb.x;
                var ty = player.y - eb.y;
                var len = Math.sqrt(tx*tx + ty*ty) || 1;
                var speed = 0.6;
                eb.x += (tx/len) * speed;
                eb.y += (ty/len) * speed;
            } else {
                eb.y += eb.dy;
            }
            eb.life--;
            if(eb.y > playBottom || eb.x < 1 || eb.x > fieldFrame.width || eb.life <= 0) ebullets.splice(j,1);
        }
        for(var p=powerups.length-1;p>=0;p--){
            var pu = powerups[p]; pu.y += 0.25; pu.life--;
            if(pu.y > playBottom || pu.life <= 0) powerups.splice(p,1);
        }
        for(var eI=explosions.length-1;eI>=0;eI--){
            var ex = explosions[eI]; ex.frame++; ex.life--;
            if(ex.life <= 0) explosions.splice(eI,1);
        }
    }

    function collisionsCheck(){
        // Player bullets -> boss/enemies
        for(var i=pbullets.length-1;i>=0;i--){
            var b = pbullets[i], hit=false;
            if(boss){
                if(hitTest(b.x,b.y,boss.x,boss.y,1.0)){
                    boss.hp -= b.damage || 1; addExplosion(b.x,b.y); pbullets.splice(i,1); hit=true; playSound("hit");
                    if(boss.hp <= 0){
                        addExplosion(boss.x,boss.y); pdata.score += 500; // boss defeated
                        // reward credits and achievement
                        pdata.credits = (pdata.credits || 0) + 100;
                        achievements["beatBoss" + level] = true;
                        boss = null;
                    }
                    continue;
                }
            }
            for(var j=enemies.length-1;j>=0;j--){
                var e = enemies[j];
                if(hitTest(b.x,b.y,e.x,e.y,0.8)){
                    var dmg = (typeof b.damage === "number") ? b.damage : 1;
                    e.hp -= dmg; addExplosion(b.x,b.y); pbullets.splice(i,1); hit=true; playSound("hit");
                    if(e.hp <= 0){
                        if(e.type === "capture"){ maybeSpawnPowerup(e.x,e.y); pdata.score += 25; }
                        else { pdata.score += 10; maybeSpawnPowerup(e.x,e.y); }
                        enemies.splice(j,1);
                    }
                    break;
                }
            }
            if(hit) continue;
        }

        // Enemy bullets -> player
        for(var k=ebullets.length-1;k>=0;k--){
            var eb = ebullets[k];
            if(hitTest(eb.x,eb.y,player.x,player.y,0.8)){
                ebullets.splice(k,1);
                if(player.captured){
                    pdata.lives--; player.captured = false; player.captureTimer = 0; playSound("expl");
                } else {
                    if(Math.random() < 0.18){
                        player.captured = true; player.captureTimer = 0; playSound("expl");
                    } else {
                        pdata.lives--; playSound("expl");
                        if(pdata.lives <= 0) running = false;
                    }
                }
            }
        }

        // powerups -> player
        for(var q=powerups.length-1;q>=0;q--){
            var pu = powerups[q];
            if(hitTest(pu.x,pu.y,player.x,player.y,0.8)){
                if(pu.type === "life"){ pdata.lives = Math.min(PLAYER_MAX_LIVES, pdata.lives + 1); playSound("power"); }
                else if(pu.type === "weapon"){ pdata.weaponLevel = Math.min(5, (pdata.weaponLevel||1) + 1); player.weaponLevel = pdata.weaponLevel; playSound("power"); }
                else if(pu.type === "score"){ pdata.score = (pdata.score||0) + 100; playSound("power"); }
                else if(pu.type === "rescue"){ if(player.captured){ player.captured = false; player.captureTimer = 0; playSound("power"); } else pdata.score += 50; }
                powerups.splice(q,1);
            }
        }

        // enemies -> player collisions
        for(var m=enemies.length-1;m>=0;m--){
            var en = enemies[m];
            if(hitTest(en.x,en.y,player.x,player.y,0.8)){
                if(en.type === "capture"){ player.captured = true; player.captureTimer = 0; addExplosion(en.x,en.y); enemies.splice(m,1); playSound("expl"); }
                else { addExplosion(en.x,en.y); enemies.splice(m,1); pdata.lives--; playSound("expl"); if(pdata.lives <= 0) running = false; }
            }
        }
    }

    function updateEnemiesLogic(){
        var cfg = getLevelConfig(level);
        if(boss){
            boss.phaseTimer++;
            boss.phase += 0.02;
            boss.x = Math.floor((playLeft + playRight)/2 + Math.sin(boss.phase) * 6);
            // boss changes behavior when low HP
            if(boss.hp < 8 && !boss.enraged){ boss.enraged = true; boss.guns.push(-7); boss.guns.push(7); }
            if(Math.random() < 0.02 + (boss.enraged ? 0.02 : 0)){
                var gun = boss.guns[Math.floor(Math.random()*boss.guns.length)];
                ebullets.push({ x: boss.x + gun, y: boss.y + 1, dy: 0.6 + Math.random()*0.2, life: 300 });
            }
            return;
        }
        for(var i=0;i<enemies.length;i++){
            var e = enemies[i];
            if(e.type === "homing"){
                // gentle horizontal drift and attempt to home slowly
                var dx = (player.x - e.x) * 0.02;
                e.x += dx;
                e.y += 0.02 * Math.sin(e._offset + i);
            } else {
                e.x += e._dir * cfg.speedFactor;
                e._offset += cfg.speedFactor;
                if(e.x <= playLeft){ e.x = playLeft; e._dir *= -1; e.y += 0.4; }
                if(e.x >= playRight){ e.x = playRight; e._dir *= -1; e.y += 0.4; }
                if(Math.random() < 0.002 + (level * 0.0005)){ e._diving = 6 + Math.floor(Math.random()*6); e._dTX = player.x; }
                if(e._diving && e._diving > 0){
                    var dx2 = e._dTX - e.x;
                    e.x += (dx2 === 0 ? 0 : ((dx2>0)?1:-1)) * cfg.speedFactor * 6;
                    e.y += cfg.speedFactor * 6;
                    e._diving--;
                } else {
                    e.y += Math.sin(e._offset) * 0.02;
                }
            }
            if(Math.random() < cfg.fireChance && e.type === "shooter") enemyFireFrom(e);
            // homing enemies sometimes fire homing bullets
            if(e.type === "homing" && Math.random() < 0.01) enemyFireFrom(e);
            if(e.y > playBottom) e.y = playBottom;
        }
    }

    function render(){
        drawTitle();
        fieldFrame.clear();

        // Draw boss if present
        if(boss){
            try{ fieldFrame.gotoxy(clamp(Math.round(boss.x),1,fieldFrame.width), clamp(Math.round(boss.y),1,fieldFrame.height)); fieldFrame.putmsg(S.bright + S.mag + "W" + S.reset); }catch(e){}
        }

        // Draw enemies
        for(var i=0;i<enemies.length;i++){
            var e = enemies[i];
            try{ fieldFrame.gotoxy(clamp(Math.round(e.x),1,fieldFrame.width), clamp(Math.round(e.y),1,fieldFrame.height)); fieldFrame.putmsg(e.color + e.char + S.reset); }catch(e){}
        }

        // Power-ups
        for(var p=0;p<powerups.length;p++){
            var pu = powerups[p];
            try{
                fieldFrame.gotoxy(clamp(Math.round(pu.x),1,fieldFrame.width), clamp(Math.round(pu.y),1,fieldFrame.height));
                var sym = (pu.type==="life") ? (S.bright + S.green + "+" + S.reset) : ((pu.type==="weapon") ? (S.bright + S.yellow + "P" + S.reset) : (S.bright + S.cyan + "$" + S.reset));
                fieldFrame.putmsg(sym);
            }catch(e){}
        }

        // Enemy bullets
        for(var eb=0; eb<ebullets.length; eb++){
            var b = ebullets[eb];
            var bx = clamp(Math.round(b.x),1,fieldFrame.width);
            var by = Math.round(b.y);
            if(by >= 1 && by <= fieldFrame.height){
                try{ fieldFrame.gotoxy(bx, by); fieldFrame.putmsg(S.bright + S.red + "o" + S.reset); }catch(x){}
            }
        }

        // Player bullets
        for(var pb=0; pb<pbullets.length; pb++){
            var b2 = pbullets[pb];
            var bx2 = clamp(Math.round(b2.x),1,fieldFrame.width);
            var by2 = Math.round(b2.y);
            if(by2 >= 1 && by2 <= fieldFrame.height){
                try{ fieldFrame.gotoxy(bx2, by2); fieldFrame.putmsg(S.bright + S.yellow + "|" + S.reset); }catch(x){}
            }
        }

        // Explosions (simple)
        for(var exi=0; exi<explosions.length; exi++){
            var exx = explosions[exi];
            var frameIdx = Math.floor(exx.frame / 4) % exx.frames.length;
            var glyph = exx.frames[frameIdx][0];
            try{ fieldFrame.gotoxy(clamp(Math.round(exx.x),1,fieldFrame.width), clamp(Math.round(exx.y),1,fieldFrame.height)); fieldFrame.putmsg(S.bright + S.red + glyph + S.reset); }catch(e){}
        }

        // Player ship (ASCII art)
        try{
            var art = player.captured ? (S.bright + S.red + "/|\\" + S.reset) : (S.bright + S.green + "/|\\" + S.reset);
            var drawX = clamp(Math.round(player.x)-1, 1, fieldFrame.width-2);
            var drawY = clamp(Math.round(player.y), 1, fieldFrame.height);
            fieldFrame.gotoxy(drawX, drawY); fieldFrame.putmsg(art);
        }catch(e){}

        // HUD
        hudFrame.clear();
        var livesStr = "Lives: ";
        var lcount = (pdata.lives || 0);
        for(var l=0;l<lcount;l++) livesStr += S.bright + S.green + "*" + S.reset + " ";
        for(var l2=lcount; l2<PLAYER_MAX_LIVES; l2++) livesStr += "_ ";
        var scoreStr = "Score: " + (pdata.score || 0);
        var levelStr = "Level: " + level;
        var wpnStr = "Weapon: L" + (pdata.weaponLevel || 1);
        var credStr = "Credits: " + (pdata.credits || 0);
        hudFrame.gotoxy(2,1);
        hudFrame.putmsg(livesStr + "   " + scoreStr + "   " + levelStr + "   " + wpnStr + "   " + credStr);

        if(mainFrame.cycle()) console.gotoxy(console.screen_columns, console.screen_rows);
    }

    function moveLeft(){ if(!player.captured) player.x = clamp(player.x - 2, playLeft, playRight); }
    function moveRight(){ if(!player.captured) player.x = clamp(player.x + 2, playLeft, playRight); }

    spawnWave(level);

    // Hide the blinking cursor while the game draws ships and bullets.
    //
    console.print("\x1b[?25l"); // hide cursor
    try {
        // Game loop
        while(bbs.online && !js.terminated && running){
            var now = Date.now();
            var dt = now - lastFrame;
            lastFrame = now;
            frameAcc += dt;

            var key = console.inkey(K_NONE, 1);
            if(key){
                var s = String(key);
                if(s === "\x1b"){
                    var n1 = console.inkey(K_NONE,20); if(n1) s += String(n1);
                    var n2 = console.inkey(K_NONE,20); if(n2) s += String(n2);
                }
                var ks = s.toUpperCase();
                if(ks === "A" || ks === "\x1b[D" || ks === "\x1bOD") moveLeft();
                else if(ks === "D" || ks === "\x1b[C" || ks === "\x1bOC") moveRight();
                else if(ks === "4") moveLeft();
                else if(ks === "6") moveRight();
                else if(ks === " " || ks === "W" || ks === "F") playerFire();
                else if(ks === "P"){ hudFrame.gotoxy(2,2); hudFrame.putmsg(S.bright + S.yellow + "Paused - press any key to resume" + S.reset); if(mainFrame.cycle()) console.gotoxy(console.screen_columns, console.screen_rows); console.getkey(); }
                else if(ks === "Q" || ks === "\x1b"){ running = false; break; }
            }

            if(frameAcc >= FRAME_MS){
                var steps = Math.floor(frameAcc / FRAME_MS);
                frameAcc -= steps * FRAME_MS;
                for(var s=0;s<steps;s++){
                    ticks++;
                    if(player._cooldown > 0) player._cooldown--;
                    if(player.captured){ player.captureTimer += 1; if(player.captureTimer > GAME_FPS * 10){ player.captured = false; player.captureTimer = 0; pdata.lives--; if(pdata.lives <= 0) running = false; } }
                    updateEnemiesLogic();
                    updateBullets();
                    collisionsCheck();

                    if(!boss && enemies.length === 0){
                        pdata.score = (pdata.score || 0) + (level * 25);
                        if(level % 3 === 0) pdata.credits = (pdata.credits || 0) + (10 * level);
                        if(level % 5 === 0 && Math.random() < 0.7){ pdata.weaponLevel = Math.min(5, (pdata.weaponLevel || 1) + 1); player.weaponLevel = pdata.weaponLevel; playSound("power"); }
                        level++;
                        if(level > MAX_LEVEL){ playSound("level"); running = false; break; }
                        spawnWave(level);
                        playSound("level");
                    }
                }
                render();
            }
            mswait(1);
        }
    } finally {
        // Cursor is restored
        try { console.print("\x1b[?25h"); } catch(e){}
    }

    try{ mainFrame.close(); }catch(e){}
    console.clear(attr);
    if(typeof SS_MOFF !== "undefined") bbs.sys_status = sys_status;

    // Save results and update leaderboard
    pdata.totalPlays = (pdata.totalPlays || 0) + 1;
    if((pdata.score || 0) > (pdata.bestScore || 0)) pdata.bestScore = pdata.score;
    pdata.weaponLevel = pdata.weaponLevel || 1;
    pdata.lives = pdata.lives || 0;
    pdata.achievements = achievements;
    savePlayer(userNumber, pdata);

    try{
        var lb = loadLeaderboard();
        lb.push({ alias: pdata.alias, score: pdata.score || 0, date: (new Date()).toISOString() });
        lb.sort(function(a,b){ return b.score - a.score; });
        while(lb.length > 200) lb.pop();
        saveLeaderboard(lb);
        writeScoresAnsi();
    }catch(e){}

    console.clear();
    console.print("\r\n" + S.bright + S.cyan + "========== GAME OVER ==========" + S.reset + "\r\n");
    console.print(S.bright + S.white + "Player: " + S.cyan + pdata.alias + S.reset + "\r\n");
    console.print(S.bright + S.white + "Score: " + S.yellow + (pdata.score || 0) + S.reset + "\r\n");
    console.print(S.bright + S.white + "Level reached: " + S.yellow + (level > MAX_LEVEL ? MAX_LEVEL : level) + S.reset + "\r\n\r\n");

    var lbshow = loadLeaderboard();
    for(var i=0;i<Math.min(lbshow.length,5);i++){ var e = lbshow[i]; console.print(S.bright + S.yellow + (i+1) + ". " + S.reset + e.alias + " - " + e.score + " (" + e.date.slice(0,10) + ")\r\n"); }

    console.print("\r\nView full scoreboard? (Y/N) ");
    var k = console.getkey();
    if(k && String(k).toUpperCase() === "Y"){
        writeScoresAnsi();
        var scrollerPath = BASE_DIR + "art\\galaga-scores.ans";
        try{ bbs.exec('?../xtrn/scroller/scroller.js "' + scrollerPath + '" "A-NET GALAGA - LOCAL LEADERBOARD" top'); }catch(e){ try{ bbs.exec('?scroller/scroller.js "' + scrollerPath + '" "A-NET GALAGA - LOCAL LEADERBOARD" top'); }catch(e2){} }
    }

    console.print("\r\nPress any key to return...\r\n");
    console.getkey();
}

/* ------------------------------ Main Menu ------------------------------ */
function main(){
    ensureDirs();
    console.clear(); try{ console.home(); }catch(e){}
    // Main loop using DDLightbarMenu
    while(!js.terminated){
        drawHeader();
        var val = showMainMenu();
        if(!val) break;
        var choice = parseInt(val,10);
        var userNumber = (typeof user !== "undefined" && user && user.number) ? user.number : 9999;
        if(choice === 1) startGalaga(userNumber);
        else if(choice === 2) showInstructions();
        else if(choice === 3) showHighScoresScroller();
        else if(choice === 4) showShop(userNumber);
        else if(choice === 5){
            var pdata = loadPlayer(userNumber);
            console.clear();
            console.print(S.bright + S.white + "Player: " + S.cyan + pdata.alias + S.reset + "\r\n");
            console.print("Best Score: " + (pdata.bestScore || 0) + "\r\n");
            console.print("Total Plays: " + (pdata.totalPlays || 0) + "\r\n");
            console.print("Total Kills: " + (pdata.totalKills || 0) + "\r\n");
            console.print("Weapon Level: L" + (pdata.weaponLevel || 1) + "\r\n");
            console.print("Credits: " + (pdata.credits || 0) + "\r\n");
            console.print("\r\nPress any key...\r\n");
            console.getkey();
        } else if(choice === 6) break;
    }
}

try{ main(); }catch(err){ try{ console.print("\r\nFatal error: " + (err && err.toString ? err.toString() : String(err)) + "\r\n"); }catch(e){} }
