#!/usr/bin/env bash
# ==============================================================================
# alexa-mcp — macOS LaunchAgent Service Controller
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.vd0.alexa-mcp"
PLIST_FILE="${LABEL}.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$LAUNCH_AGENTS_DIR/$PLIST_FILE"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/server.launchd.log"
PORT="${PORT:-8000}"
USER_ID="$(id -u)"

# Detect active Node binary dynamically
NODE_BIN="${NODE_BIN:-$(command -v node 2>/dev/null || which node 2>/dev/null || true)}"
if [ -z "$NODE_BIN" ]; then
  echo "Error: Node.js executable could not be found in PATH. Please install Node.js." >&2
  exit 1
fi

generate_plist() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <!-- Absolute interpreter and script paths to prevent launchd environment resolution issues -->
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${REPO_DIR}/dist/server.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${REPO_DIR}</string>

  <!-- Auto-launch on user login and restart on exit -->
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(dirname "${NODE_BIN}"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PORT</key>
    <string>${PORT}</string>
    <key>ALEXA_MCP_AUTH_DIR</key>
    <string>${REPO_DIR}/.auth-data</string>
  </dict>

  <key>StandardOutPath</key>
  <string>${LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_FILE}</string>

  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
EOF
}

detect_user_rc() {
  if [ -n "${ZSH_VERSION:-}" ] || [[ "${SHELL:-}" =~ "zsh" ]] || [ -f "$HOME/.zshrc" ]; then
    echo "$HOME/.zshrc"
  elif [ -n "${BASH_VERSION:-}" ] || [[ "${SHELL:-}" =~ "bash" ]] || [ -f "$HOME/.bashrc" ]; then
    echo "$HOME/.bashrc"
  elif [ -f "$HOME/.bash_profile" ]; then
    echo "$HOME/.bash_profile"
  else
    echo "$HOME/.zshrc"
  fi
}

cmd_install_shortcuts() {
  local RC_FILE
  RC_FILE="$(detect_user_rc)"
  touch "$RC_FILE"

  "$NODE_BIN" -e '
    const fs = require("fs");
    const rcPath = process.argv[1];
    const repoDir = process.argv[2];
    let content = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, "utf8") : "";

    const startMarker = "# >>> alexa-mcp service shortcuts >>>";
    const endMarker = "# <<< alexa-mcp service shortcuts <<<";

    // Remove existing block if present
    const regex = new RegExp(`\\n*${startMarker}[\\s\\S]*?${endMarker}\\n*`, "g");
    content = content.replace(regex, "\n");

    const block = `
${startMarker}
# Added by alexa-mcp (https://github.com/james----/alexa-mcp)
alexa() {
    bash "${repoDir}/scripts/service.sh" "\${1:-status}"
}

alexa-status() {
    bash "${repoDir}/scripts/service.sh" status
}

alexa-logs() {
    bash "${repoDir}/scripts/service.sh" logs
}

alexa-restart() {
    bash "${repoDir}/scripts/service.sh" restart
}

alexa-stop() {
    bash "${repoDir}/scripts/service.sh" stop
}

alexa-start() {
    bash "${repoDir}/scripts/service.sh" start
}

# Quick aliases
alias astatus="alexa-status"
alias alogs="alexa-logs"
alias arestart="alexa-restart"
alias astop="alexa-stop"
alias astart="alexa-start"
${endMarker}
`;
    content = content.trimEnd() + "\n" + block;
    fs.writeFileSync(rcPath, content, "utf8");
  ' "$RC_FILE" "$REPO_DIR"

  echo "Installed shortcuts in $RC_FILE:"
  echo "  - astatus  (or 'alexa status')"
  echo "  - alogs    (or 'alexa logs')"
  echo "  - arestart (or 'alexa restart')"
  echo "  - astop    (or 'alexa stop')"
  echo "  - astart   (or 'alexa start')"
  echo ""
  echo "Run 'source $RC_FILE' or open a new terminal window to activate."
}

cmd_uninstall_shortcuts() {
  local RC_FILE
  RC_FILE="$(detect_user_rc)"
  if [ -f "$RC_FILE" ]; then
    "$NODE_BIN" -e '
      const fs = require("fs");
      const rcPath = process.argv[1];
      if (!fs.existsSync(rcPath)) process.exit(0);
      let content = fs.readFileSync(rcPath, "utf8");
      const startMarker = "# >>> alexa-mcp service shortcuts >>>";
      const endMarker = "# <<< alexa-mcp service shortcuts <<<";
      const regex = new RegExp(`\\n*${startMarker}[\\s\\S]*?${endMarker}\\n*`, "g");
      if (regex.test(content)) {
        content = content.replace(regex, "\n");
        fs.writeFileSync(rcPath, content.trimEnd() + "\n", "utf8");
        console.log("Removed shortcuts from " + rcPath + ".");
      } else {
        console.log("No alexa-mcp shortcuts found in " + rcPath + ".");
      }
    ' "$RC_FILE"
  else
    echo "No config file found at $RC_FILE."
  fi
}

cmd_install() {
  echo "Installing ${LABEL} service..."
  mkdir -p "$LAUNCH_AGENTS_DIR"
  mkdir -p "$LOG_DIR"

  if [ ! -f "$REPO_DIR/dist/server.js" ]; then
    echo "dist/server.js not found; building project..."
    (cd "$REPO_DIR" && npm run build)
  fi

  generate_plist > "$TARGET_PLIST"
  chmod 644 "$TARGET_PLIST"
  echo "Generated LaunchAgent configuration: $TARGET_PLIST"

  # Unload previous instance or legacy labels if registered
  for OLD_LABEL in "${LABEL}" "com.alexa-mcp.server" "com.jtucker.alexa-mcp"; do
    launchctl bootout "gui/${USER_ID}/${OLD_LABEL}" 2>/dev/null || true
    if [ "$OLD_LABEL" != "$LABEL" ]; then
      rm -f "$LAUNCH_AGENTS_DIR/${OLD_LABEL}.plist" 2>/dev/null || true
    fi
  done
  launchctl unload "$TARGET_PLIST" 2>/dev/null || true

  # Load and start the service
  if launchctl bootstrap "gui/${USER_ID}" "$TARGET_PLIST" 2>/dev/null; then
    echo "Bootstrapped via modern launchctl."
  else
    launchctl load "$TARGET_PLIST"
    echo "Loaded via traditional launchctl."
  fi

  sleep 1.5
  cmd_status
}

cmd_start() {
  if [ ! -f "$TARGET_PLIST" ]; then
    echo "Service plist not found at $TARGET_PLIST. Running install first..."
    cmd_install
    return
  fi

  echo "Starting ${LABEL}..."
  if ! launchctl list | grep -q "${LABEL}"; then
    launchctl bootstrap "gui/${USER_ID}" "$TARGET_PLIST" 2>/dev/null || launchctl load "$TARGET_PLIST"
  else
    launchctl kickstart -k "gui/${USER_ID}/${LABEL}" 2>/dev/null || launchctl start "${LABEL}"
  fi

  sleep 1.5
  cmd_status
}

cmd_stop() {
  echo "Stopping ${LABEL}..."
  # Because KeepAlive is true, bootout/unload is required to prevent immediate respawn
  launchctl bootout "gui/${USER_ID}/${LABEL}" 2>/dev/null || launchctl unload "$TARGET_PLIST" 2>/dev/null || true
  echo "Service stopped."
}

cmd_restart() {
  echo "Restarting ${LABEL}..."
  if [ -f "$TARGET_PLIST" ]; then
    launchctl bootout "gui/${USER_ID}/${LABEL}" 2>/dev/null || launchctl unload "$TARGET_PLIST" 2>/dev/null || true
    sleep 0.5
    launchctl bootstrap "gui/${USER_ID}" "$TARGET_PLIST" 2>/dev/null || launchctl load "$TARGET_PLIST"
    sleep 1.5
    cmd_status
  else
    echo "Service plist not installed. Running install..."
    cmd_install
  fi
}

cmd_status() {
  echo "=================================================="
  echo " Service Status: ${LABEL}"
  echo "=================================================="

  if [ ! -f "$TARGET_PLIST" ]; then
    echo "Status: NOT INSTALLED (plist missing from $TARGET_PLIST)"
    return
  fi

  local LIST_OUTPUT
  LIST_OUTPUT="$(launchctl list | grep "${LABEL}" || true)"
  if [ -z "$LIST_OUTPUT" ]; then
    echo "Launchd Status: STOPPED (not currently loaded)"
  else
    local PID STATUS
    PID="$(echo "$LIST_OUTPUT" | awk '{print $1}')"
    STATUS="$(echo "$LIST_OUTPUT" | awk '{print $2}')"
    echo "Launchd Status: LOADED (PID: ${PID:-unknown}, Last Exit Code: ${STATUS})"
  fi

  # Check network listener on target port
  local PORT_INFO
  PORT_INFO="$(lsof -nP -i ":${PORT}" 2>/dev/null | grep -i LISTEN || true)"
  if [ -n "$PORT_INFO" ]; then
    echo "Network Listener: Port ${PORT} is ACTIVE"
    echo "  ${PORT_INFO}"
  else
    echo "Network Listener: Port ${PORT} is NOT LISTENING"
  fi

  # HTTP Health probe
  local HTTP_STATUS
  HTTP_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/" 2>/dev/null || echo "failed")"
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "HTTP Endpoint:  HEALTHY (http://localhost:${PORT}/mcp responded 200)"
  else
    echo "HTTP Endpoint:  UNAVAILABLE (probe returned: ${HTTP_STATUS})"
  fi

  echo ""
  echo "Recent Logs (${LOG_FILE}):"
  echo "--------------------------------------------------"
  if [ -f "$LOG_FILE" ]; then
    tail -n 8 "$LOG_FILE"
  else
    echo "(Log file does not exist yet)"
  fi
  echo "=================================================="
}

cmd_logs() {
  mkdir -p "$LOG_DIR"
  touch "$LOG_FILE"
  echo "Tailing ${LOG_FILE} (Ctrl+C to exit)..."
  tail -n 50 -f "$LOG_FILE"
}

cmd_uninstall() {
  echo "Uninstalling ${LABEL}..."
  launchctl bootout "gui/${USER_ID}/${LABEL}" 2>/dev/null || launchctl unload "$TARGET_PLIST" 2>/dev/null || true
  rm -f "$TARGET_PLIST"
  echo "Removed $TARGET_PLIST and stopped launchd service."
}

ACTION="${1:-status}"

case "$ACTION" in
  install)            cmd_install ;;
  start)              cmd_start ;;
  stop)               cmd_stop ;;
  restart)            cmd_restart ;;
  status)             cmd_status ;;
  logs)               cmd_logs ;;
  uninstall)          cmd_uninstall ;;
  install-shortcuts|shortcuts)  cmd_install_shortcuts ;;
  uninstall-shortcuts) cmd_uninstall_shortcuts ;;
  *)
    echo "Usage: $0 {install|start|stop|restart|status|logs|uninstall|install-shortcuts|uninstall-shortcuts}"
    exit 1
    ;;
esac
