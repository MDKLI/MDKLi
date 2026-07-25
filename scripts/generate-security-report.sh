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

  # Risk weights as published by Scorecard: Critical=10, High=7.5, Medium=5, Low=2.5
  # https://github.com/ossf/scorecard/blob/main/docs/checks.md
  WEIGHTS='{
    "Binary-Artifacts": 7.5, "Branch-Protection": 7.5, "CI-Tests": 2.5,
    "CII-Best-Practices": 2.5, "Code-Review": 7.5, "Contributors": 2.5,
    "Dangerous-Workflow": 10, "Dependency-Update-Tool": 7.5, "Fuzzing": 5,
    "License": 2.5, "Maintained": 7.5, "Packaging": 5, "Pinned-Dependencies": 5,
    "SAST": 5, "Security-Policy": 5, "Signed-Releases": 7.5,
    "Token-Permissions": 7.5, "Vulnerabilities": 7.5
  }'
  EXCLUDE_CHECKS='["Vulnerabilities", "Maintained", "Code-Review", "Dependency-Update-Tool", "Branch-Protection"]'

  ADJUSTED_SCORE=$(jq -r \
    --argjson weights "$WEIGHTS" \
    --argjson exclude "$EXCLUDE_CHECKS" \
    '
      (.checks // []) as $checks
      | ($checks | map(select(.score >= 0 and (([.name] - $exclude) | length) > 0))) as $included
      | ($included | map(.score * ($weights[.name] // 0)) | add // 0) as $wsum
      | ($included | map($weights[.name] // 0) | add // 0) as $tsum
      | if $tsum > 0 then (($wsum / $tsum * 10 | round) / 10) else "N/A" end
    ' scorecard-results.json)

  {
    echo ""
    echo "## OpenSSF Scorecard"
    echo ""
    echo "Overall score (official, all 18 checks): **$SCORE / 10**"
    echo ""
    echo "Adjusted score (excluding Vulnerabilities, Maintained, Code-Review, Dependency-Update-Tool, Branch-Protection): **$ADJUSTED_SCORE / 10**"
    echo ""
    echo "_The adjusted score is a local recomputation for this report only. It has no effect on scorecard.dev or the OSSF public API, which always score every check by design — excluding checks there would defeat the point of a comparable public score._"
  } >>"$OUT"
fi

cat "$OUT"
