#!/bin/bash
# Claude Code MCP サーバー設定スクリプト (Brave Search)
# UserData から実行される想定。冪等性あり。
#
# MCP サーバーの設定先:
#   ~/.claude.json (ユーザースコープ、~/.claude/ ディレクトリの外)
#   ※ ~/.claude/settings.json は Bedrock 等の動作設定用で、MCP には使えない
set -e

REGION="ap-northeast-1"
MCP_CONFIG="/home/ubuntu/.claude.json"
MCP_CONFIGURED_MARKER="/home/ubuntu/.claude/.mcp-configured"

# 既に設定済みならスキップ
if [ -f "$MCP_CONFIGURED_MARKER" ]; then
  echo "MCP servers already configured. Skipping."
  exit 0
fi

# Brave API キーを SSM Parameter Store から取得 (未設定ならスキップ)
BRAVE_KEY=$(aws ssm get-parameter \
  --name /codeserver/brave-api-key \
  --with-decryption \
  --query Parameter.Value \
  --output text \
  --region "$REGION" 2>/dev/null || echo "")

if [ -z "$BRAVE_KEY" ]; then
  echo "Brave API key not found in SSM. Skipping MCP setup."
  echo "To enable: aws ssm put-parameter --name /codeserver/brave-api-key --type SecureString --value 'YOUR_KEY' --region $REGION"
  exit 0
fi

# 既存の ~/.claude.json があればマージ、なければ新規作成
if [ -f "$MCP_CONFIG" ]; then
  python3 -c "
import json
with open('$MCP_CONFIG') as f:
    config = json.load(f)
config.setdefault('mcpServers', {})
config['mcpServers']['brave-search'] = {
    'command': 'npx',
    'args': ['-y', '@modelcontextprotocol/server-brave-search'],
    'env': {'BRAVE_API_KEY': '$BRAVE_KEY'}
}
with open('$MCP_CONFIG', 'w') as f:
    json.dump(config, f, indent=2)
"
else
  cat > "$MCP_CONFIG" << EOF
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "$BRAVE_KEY"
      }
    }
  }
}
EOF
fi

chown ubuntu:ubuntu "$MCP_CONFIG"

# 設定完了マーカーを作成
mkdir -p /home/ubuntu/.claude
touch "$MCP_CONFIGURED_MARKER"
chown -R ubuntu:ubuntu /home/ubuntu/.claude

echo "MCP server (Brave Search) configured in $MCP_CONFIG"
