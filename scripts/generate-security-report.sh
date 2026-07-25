#!/usr/bin/env bash
set -euo pipefail

REPO="${GITHUB_REPOSITORY}"
OUT="security-report.md"

echo "# Security Report — $REPO" >"$OUT"
echo "" >>"$OUT"
echo "_Generated: $(date -u +"%Y-%m-%d %H:%M UTC") — commit \`${GITHUB_SHA:0:7}\`_" >>"$OUT"
echo "" >>"$OUT"

echo "Fetching code scanning alerts..."
gh api --paginate "/repos/$REPO/code-scanning/alerts?state=open&per_page=100" >alerts.json || echo "[]" >alerts.json

TOTAL=$(jq 'length' alerts.json)
CRITICAL=$(jq '[.[] | select(.rule.security_severity_level=="critical")] | length' alerts.json)
HIGH=$(jq '[.[] | select(.rule.security_severity_level=="high")] | length' alerts.json)
MEDIUM=$(jq '[.[] | select(.rule.security_severity_level=="medium")] | length' alerts.json)
LOW=$(jq '[.[] | select(.rule.security_severity_level=="low" or .rule.security_severity_level==null)] | length' alerts.json)

{
  echo "## Summary"
  echo ""
  echo "| Severity | Open |"
  echo "|---|---|"
  echo "| Critical | $CRITICAL |"
  echo "| High | $HIGH |"
  echo "| Medium | $MEDIUM |"
  echo "| Low | $LOW |"
  echo "| **Total** | **$TOTAL** |"
  echo ""
  echo "## By tool"
  echo ""
  echo "| Tool | Open alerts |"
  echo "|---|---|"
  jq -r '[.[].tool.name] | group_by(.) | map({tool: .[0], count: length}) | .[] | "| \(.tool) | \(.count) |"' alerts.json
  echo ""
  echo "## Open Critical/High findings"
  echo ""
  echo "| Severity | Rule | Location |"
  echo "|---|---|---|"
  jq -r '.[] | select(.rule.security_severity_level=="critical" or .rule.security_severity_level=="high") | "| \(.rule.security_severity_level) | \(.rule.description) | \(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line) |"' alerts.json
} >>"$OUT"

echo "Fetching Dependabot alerts..."
gh api --paginate "/repos/$REPO/dependabot/alerts?state=open&per_page=100" >dep-alerts.json 2>/dev/null || echo "[]" >dep-alerts.json
DEP_TOTAL=$(jq 'length' dep-alerts.json)

echo "Fetching secret scanning alerts..."
gh api --paginate "/repos/$REPO/secret-scanning/alerts?state=open&per_page=100" >secret-alerts.json 2>/dev/null || echo "[]" >secret-alerts.json
SECRET_TOTAL=$(jq 'length' secret-alerts.json)

{
  echo ""
  echo "## Dependency vulnerabilities (Dependabot)"
  echo ""
  echo "Open: **$DEP_TOTAL**"
  echo ""
  echo "## Secret scanning"
  echo ""
  echo "Open: **$SECRET_TOTAL**"
} >>"$OUT"

if [ -f scorecard-results.json ]; then
  SCORE=$(jq -r '.score // "N/A"' scorecard-results.json)
  {
    echo ""
    echo "## OpenSSF Scorecard"
    echo ""
    echo "Overall score: **$SCORE / 10**"
  } >>"$OUT"
fi

cat "$OUT"
