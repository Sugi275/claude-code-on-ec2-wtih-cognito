#!/bin/bash
# Claude Code 設定スクリプト (MCP サーバー + bypassPermissions)
# UserData から実行される想定。冪等性あり。
#
# 設定ファイル:
#   ~/.claude.json          - MCP サーバー設定 (~/.claude/ ディレクトリの外)
#   ~/.claude/settings.json - Claude Code 動作設定 (bypassPermissions 等)
#
# MCP サーバー:
#   - Brave Search: Web 検索 (要 SSM に API キー)
#   - AWS Knowledge: AWS ドキュメント・ベストプラクティス (認証不要)
#   - Context7: OSS ライブラリの最新ドキュメント (認証不要)
set -e

REGION="ap-northeast-1"
MCP_CONFIG="/home/ubuntu/.claude.json"
SETTINGS_DIR="/home/ubuntu/.claude"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"
CONFIGURED_MARKER="$SETTINGS_DIR/.mcp-configured"

# スクリプトのハッシュが前回と同じならスキップ（更新時は再実行される）
SCRIPT_HASH=$(sha256sum "$0" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
if [ -f "$CONFIGURED_MARKER" ] && [ "$(cat "$CONFIGURED_MARKER")" = "$SCRIPT_HASH" ]; then
  echo "Already configured (same version). Skipping."
  exit 0
fi

mkdir -p "$SETTINGS_DIR"

# --- bypassPermissions 設定 ---
if [ -f "$SETTINGS_FILE" ]; then
  python3 -c "
import json
with open('$SETTINGS_FILE') as f:
    settings = json.load(f)
settings.setdefault('permissions', {})
settings['permissions']['defaultMode'] = 'bypassPermissions'
settings['permissions']['allow'] = ['mcp__*']
settings['skipDangerousModePermissionPrompt'] = True
with open('$SETTINGS_FILE', 'w') as f:
    json.dump(settings, f, indent=2)
"
else
  cat > "$SETTINGS_FILE" << 'EOF'
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": ["mcp__*"]
  },
  "skipDangerousModePermissionPrompt": true
}
EOF
fi
echo "bypassPermissions configured."

# --- MCP サーバー設定 ---
# Brave API キーを取得 (未設定なら空)
BRAVE_KEY=$(aws ssm get-parameter \
  --name /codeserver/brave-api-key \
  --with-decryption \
  --query Parameter.Value \
  --output text \
  --region "$REGION" 2>/dev/null || echo "")

# MCP 設定を構築
python3 << PYEOF
import json, os

config = {}
if os.path.exists("$MCP_CONFIG"):
    with open("$MCP_CONFIG") as f:
        config = json.load(f)

config.setdefault("mcpServers", {})

# Brave Search (API キーがある場合のみ)
brave_key = "$BRAVE_KEY"
if brave_key:
    config["mcpServers"]["brave-search"] = {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "env": {"BRAVE_API_KEY": brave_key}
    }
    print("  Brave Search: configured")
else:
    print("  Brave Search: skipped (no API key in SSM)")

# AWS Knowledge (リモートサーバー、認証不要)
config["mcpServers"]["aws-knowledge"] = {
    "command": "uvx",
    "args": ["fastmcp", "run", "https://knowledge-mcp.global.api.aws"]
}
print("  AWS Knowledge: configured")

# Context7 (認証不要)
config["mcpServers"]["context7"] = {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp"]
}
print("  Context7: configured")

with open("$MCP_CONFIG", "w") as f:
    json.dump(config, f, indent=2)
PYEOF

chown ubuntu:ubuntu "$MCP_CONFIG"
chown -R ubuntu:ubuntu "$SETTINGS_DIR"

# --- Skills (spec-driven-presentation-maker) ---
SKILLS_DIR="/home/ubuntu/.claude/skills"
if [ ! -d "$SKILLS_DIR/presentation-maker" ]; then
  mkdir -p "$SKILLS_DIR"
  TMP_DIR=$(mktemp -d)
  git clone --depth 1 https://github.com/aws-samples/sample-spec-driven-presentation-maker.git "$TMP_DIR" 2>/dev/null
  if [ -d "$TMP_DIR/skill" ]; then
    cp -r "$TMP_DIR/skill" "$SKILLS_DIR/presentation-maker"
    chown -R ubuntu:ubuntu "$SKILLS_DIR"
    echo "Skill (presentation-maker) installed."
  fi
  rm -rf "$TMP_DIR"
else
  echo "Skill (presentation-maker) already installed."
fi

echo "$SCRIPT_HASH" > "$CONFIGURED_MARKER"
echo "MCP servers configured in $MCP_CONFIG"
