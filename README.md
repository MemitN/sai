# Sai Lounge POS — Windows Setup Guide

> **Node.js + React restaurant POS system — runs entirely on your local Windows PC with no cloud hosting.**

---

## Quick Start (3 steps)

```
1. Copy all four .bat files into the same folder as backend\ and frontend\
2. Right-click install.bat → Run as administrator
3. Double-click the desktop shortcut or run start.bat
```

---

## Folder Layout Before Installing

```
📁 (Your USB drive or extracted folder)
│
├── backend\              ← Node.js server source
│   ├── server.js
│   ├── package.json
│   ├── .env
│   └── ...
│
├── frontend\             ← React source
│   ├── src\
│   ├── public\
│   ├── package.json
│   └── ...
│
├── install.bat           ← Run this first (as Admin)
├── start.bat             ← Run this to launch the POS
├── network-config.bat    ← Network tools menu
└── uninstall.bat         ← Run this to remove everything
```

After installing, a shortcut will be placed on the desktop and in the Start Menu.

---

## The Four Batch Files

### 1. `install.bat` — First-time setup (Run as Administrator)

**What it does:**

| Step | Action |
|------|--------|
| 1 | Checks that Node.js is installed |
| 2 | Locates `backend\` and `frontend\` folders next to itself |
| 3 | Creates `C:\Program Files\Sai Lounge POS` |
| 4 | Copies all backend and frontend files there |
| 5 | Runs `npm install` in the backend folder |
| 6 | Runs `npm install` in the frontend folder |
| 7 | Runs `npm run build` to compile React, then copies the build into `backend\public\` |
| 8 | Adds a Windows Firewall inbound rule for TCP port 3001 |
| 9 | Creates a desktop shortcut and Start Menu entry |
| 10 | Optionally adds the server to Windows startup (registry Run key) |

**Prerequisite:** [Node.js LTS](https://nodejs.org/en/download) must be installed first.

---

### 2. `start.bat` — Launch the server (no Admin needed)

Double-click this (or use the desktop shortcut) whenever you want to run the POS.

**What it does:**

1. Optionally kills existing Node.js processes (with your consent)
2. Detects your computer's local IP address automatically
3. Starts `node server.js` in a minimised background window, logging to `server.log`
4. Waits and performs a health check (up to 60 seconds, 5 s intervals)
5. If the server fails, displays the last 20 lines of `server.log` for diagnosis
6. If the server is up, shows the access URL for other devices
7. Displays all default staff login codes
8. Opens your browser to `http://localhost:3001`

> **Keep the "Sai Lounge POS - Server" window running in your taskbar.** Closing it stops the server.

---

### 3. `network-config.bat` — Network tools menu

Run this whenever you need to configure or diagnose network access. Some options require Administrator.

| Option | What it does |
|--------|-------------|
| **1** | Shows all IPv4 addresses and the recommended LAN access URL |
| **2** | Removes and re-adds the Windows Firewall rule for port 3001 |
| **3** | Full server health check: Node process, HTTP response, TCP port, firewall rule |
| **4** | Sets a static IP address on a chosen network adapter |
| **5** | Generates an HTML page with a scannable QR code — staff scan it with any phone |
| **6** | Step-by-step port-forwarding instructions for internet access |

**QR Code note:** Option 5 opens an HTML page in your browser. The QR code is generated using a CDN JavaScript library, so internet access is needed the first time. Print it while online for offline use.

---

### 4. `uninstall.bat` — Remove everything (Run as Administrator)

Asks for confirmation **twice** before making any changes.

**What it removes:**

- All files in `C:\Program Files\Sai Lounge POS`
- Windows Firewall rule "Sai Lounge POS"
- Registry auto-start entry (HKLM Run key)
- Desktop shortcut
- Start Menu folder

> ⚠️ **This deletes your database file (`sai_lounge.db`).** Back it up first if you need the data.

---

## Staff Login Codes

| Role    | Code |
|---------|------|
| Admin   | 4000 |
| Cashier | 2000 |
| Kitchen | 3000 |
| Waiters | 1001 |

---

## Network Access (Other Devices)

All phones, tablets and other computers on the **same WiFi or LAN** can access the POS:

```
http://<this-computer's-IP>:3001
```

Run `start.bat` and it will display the exact URL. Or use `network-config.bat → Option 1`.

**For the best experience on mobile devices:**
- Ensure all devices are connected to the same WiFi router
- Run `network-config.bat → Option 2` if other devices can connect but images don't load
- Set a static IP (Option 4) so the URL never changes

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `install.bat` fails with "Access Denied" | Right-click → Run as administrator |
| Node.js not found | Download from https://nodejs.org and install, then re-run `install.bat` |
| `npm install` fails | Check internet connection; try running `install.bat` again |
| Server doesn't start | Check `backend\server.log` for errors |
| Other devices can't connect | Run `network-config.bat → Option 2` (firewall), then Option 3 (test) |
| Images not loading on tablets | This is fixed by the CORS headers in `server.js` — ensure you rebuilt the frontend |
| Port 3001 already in use | Run `start.bat` and agree to kill existing Node processes |
| Can't delete install folder | Reboot the PC then delete `C:\Program Files\Sai Lounge POS` manually |

---

## Security Notes

- The `.env` file contains your Gmail OAuth tokens and JWT secret. Keep it private.
- Change `JWT_SECRET` in `backend\.env` to a random string before going live.
- For internet access, a VPN is safer than direct port forwarding.
- The POS is designed for a trusted private network (restaurant LAN/WiFi).
