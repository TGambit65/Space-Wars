#!/usr/bin/env bash
# Space Wars 3000 Planner CLI -- works via direct file access (no server needed)
# Usage: ./planner-cli.sh <command> [args]
#
# Commands:
#   features                               List all features (id, title, status)
#   feature <id>                           Show feature details + comments
#   comments [feature-id]                  Show comments (all or for a specific feature)
#   comment <feature-id> <author> <text>   Post a comment
#   delete-comment <feature-id> <index>    Delete a comment by index
#   search <query>                         Search features by keyword
#   update-desc <feature-id> <new-desc>    Update a feature's summary description
#   add-feature <section-id> <json>        Add a new feature (provide JSON object)
#   sections                               List all sections
#   plan-json                              Export full plan as JSON

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PLAN_FILE="$DIR/index.html"
COMMENTS_FILE="$DIR/comments.json"

cmd="${1:-help}"
shift || true

extract_plan() {
  node -e "
    const fs = require('fs');
    const html = fs.readFileSync('$PLAN_FILE', 'utf8');
    const start = html.indexOf('const PLAN=[');
    const end = html.indexOf('];', start) + 2;
    eval(html.substring(start, end).replace('const PLAN=', 'var PLAN='));
    process.stdout.write(JSON.stringify(PLAN));
  "
}

case "$cmd" in
  features)
    node -e "
      const PLAN = $(extract_plan);
      for (const s of PLAN) {
        console.log('\n=== ' + s.title + ' (' + s.status + ') ===');
        for (const f of s.features) {
          const tag = f.status === 'exists' ? '[BUILT]' : f.status === 'new' ? '[NEW]  ' : '[PLAN] ';
          console.log('  ' + tag + ' ' + f.id.padEnd(25) + f.title);
        }
      }
      console.log('\nTotal: ' + PLAN.reduce((s,sec)=>s+sec.features.length,0) + ' features');
    "
    ;;

  sections)
    node -e "
      const PLAN = $(extract_plan);
      for (const s of PLAN) {
        console.log(s.id.padEnd(20) + s.title + ' (' + s.features.length + ' features, ' + s.status + ')');
      }
    "
    ;;

  feature)
    fid="${1:-}"
    if [ -z "$fid" ]; then echo "Usage: planner-cli.sh feature <feature-id>"; exit 1; fi
    node -e "
      const fs = require('fs');
      const PLAN = $(extract_plan);
      const comments = JSON.parse(fs.readFileSync('$COMMENTS_FILE', 'utf8'));
      let found = false;
      for (const s of PLAN) for (const f of s.features) {
        if (f.id === process.argv[1]) {
          found = true;
          console.log('ID:      ' + f.id);
          console.log('Title:   ' + f.title);
          console.log('Status:  ' + f.status);
          console.log('Section: ' + s.title);
          console.log('Tags:    ' + (f.tags||[]).join(', '));
          console.log('\n--- Summary ---');
          console.log(f.desc);
          if (f.workflow) { console.log('\n--- Workflow ---'); console.log(f.workflow.join(' -> ')); }
          if (f.details) { console.log('\n--- Details ---'); console.log(f.details.replace(/<[^>]+>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g, ' ').trim()); }
          const fc = comments[f.id] || [];
          if (fc.length) {
            console.log('\n--- Comments (' + fc.length + ') ---');
            fc.forEach((c, i) => console.log('[' + i + '] ' + c.author + ': ' + c.text));
          } else { console.log('\n--- No comments ---'); }
        }
      }
      if (!found) console.error('Feature not found: ' + process.argv[1]);
    " "$fid"
    ;;

  comments)
    fid="${1:-}"
    node -e "
      const fs = require('fs');
      const comments = JSON.parse(fs.readFileSync('$COMMENTS_FILE', 'utf8'));
      const fid = process.argv[1] || '';
      if (fid) {
        const fc = comments[fid] || [];
        console.log('Comments for ' + fid + ' (' + fc.length + '):');
        fc.forEach((c, i) => console.log('[' + i + '] ' + c.author + ' (' + new Date(c.time).toISOString().slice(0,16) + '): ' + c.text));
        if (!fc.length) console.log('  (none)');
      } else {
        const total = Object.values(comments).reduce((s,a) => s + a.length, 0);
        console.log('Total comments: ' + total + '\n');
        for (const [fid, arr] of Object.entries(comments)) {
          console.log(fid + ' (' + arr.length + '):');
          arr.forEach((c, i) => console.log('  [' + i + '] ' + c.author + ': ' + c.text.substring(0, 140) + (c.text.length > 140 ? '...' : '')));
          console.log();
        }
      }
    " "$fid"
    ;;

  comment)
    fid="${1:-}"; author="${2:-}"; text="${3:-}"
    if [ -z "$fid" ] || [ -z "$author" ] || [ -z "$text" ]; then
      echo "Usage: planner-cli.sh comment <feature-id> <author> <text>"; exit 1
    fi
    node -e "
      const fs = require('fs');
      const fid = process.argv[1], author = process.argv[2], text = process.argv[3];
      const f = '$COMMENTS_FILE';
      const comments = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!comments[fid]) comments[fid] = [];
      comments[fid].push({ author, text, time: Date.now() });
      fs.writeFileSync(f, JSON.stringify(comments, null, 2));
      console.log('Comment posted to ' + fid + ' by ' + author);
    " "$fid" "$author" "$text"
    ;;

  delete-comment)
    fid="${1:-}"; idx="${2:-}"
    if [ -z "$fid" ] || [ -z "$idx" ]; then
      echo "Usage: planner-cli.sh delete-comment <feature-id> <index>"; exit 1
    fi
    node -e "
      const fs = require('fs');
      const fid = process.argv[1], idx = parseInt(process.argv[2]);
      const f = '$COMMENTS_FILE';
      const comments = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (comments[fid] && comments[fid][idx] !== undefined) {
        comments[fid].splice(idx, 1);
        if (comments[fid].length === 0) delete comments[fid];
        fs.writeFileSync(f, JSON.stringify(comments, null, 2));
        console.log('Comment ' + idx + ' deleted from ' + fid);
      } else { console.error('Comment not found'); }
    " "$fid" "$idx"
    ;;

  search)
    query="${1:-}"
    if [ -z "$query" ]; then echo "Usage: planner-cli.sh search <query>"; exit 1; fi
    node -e "
      const PLAN = $(extract_plan);
      const q = process.argv[1].toLowerCase();
      let count = 0;
      for (const s of PLAN) for (const f of s.features) {
        const searchable = (f.id + ' ' + f.title + ' ' + f.desc + ' ' + (f.details||'')).toLowerCase();
        if (searchable.includes(q)) {
          count++;
          const tag = f.status === 'exists' ? '[BUILT]' : f.status === 'new' ? '[NEW]' : '[PLAN]';
          console.log(tag + ' ' + f.id + ' -- ' + f.title);
          console.log('  ' + f.desc.substring(0, 160) + (f.desc.length > 160 ? '...' : ''));
          console.log();
        }
      }
      console.log(count + ' results for: ' + process.argv[1]);
    " "$query"
    ;;

  update-desc)
    fid="${1:-}"; newdesc="${2:-}"
    if [ -z "$fid" ] || [ -z "$newdesc" ]; then
      echo "Usage: planner-cli.sh update-desc <feature-id> <new-description>"; exit 1
    fi
    node -e "
      const fs = require('fs');
      const fid = process.argv[1], newdesc = process.argv[2];
      let html = fs.readFileSync('$PLAN_FILE', 'utf8');
      // Find the feature's desc field and replace it
      const idPattern = \"id:'\" + fid + \"'\";
      const idx = html.indexOf(idPattern);
      if (idx === -1) { console.error('Feature not found: ' + fid); process.exit(1); }
      const descStart = html.indexOf(\"desc:'\", idx);
      if (descStart === -1) { console.error('desc field not found'); process.exit(1); }
      const descContentStart = descStart + 6;
      // Find the closing quote (handle escaped quotes)
      let i = descContentStart, depth = 0;
      while (i < html.length) {
        if (html[i] === \"'\" && html[i-1] !== '\\\\') break;
        i++;
      }
      const oldDesc = html.substring(descContentStart, i);
      const escaped = newdesc.replace(/'/g, \"\\\\\'\");
      html = html.substring(0, descContentStart) + escaped + html.substring(i);
      fs.writeFileSync('$PLAN_FILE', html);
      console.log('Updated desc for ' + fid);
    " "$fid" "$newdesc"
    ;;

  plan-json)
    extract_plan | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
    ;;

  *)
    echo "Space Wars 3000 Planner CLI"
    echo ""
    echo "Commands:"
    echo "  features                               List all features (id, title, status)"
    echo "  feature <id>                           Show feature details + comments"
    echo "  comments [feature-id]                  Show comments (all or specific feature)"
    echo "  comment <feature-id> <author> <text>   Post a comment"
    echo "  delete-comment <feature-id> <index>    Delete a comment by index"
    echo "  search <query>                         Search features by keyword"
    echo "  update-desc <feature-id> <new-desc>    Update a feature summary"
    echo "  sections                               List all sections"
    echo "  plan-json                              Export full plan as JSON"
    echo ""
    echo "Examples:"
    echo "  ./planner-cli.sh features"
    echo "  ./planner-cli.sh feature pvp-zones"
    echo "  ./planner-cli.sh comment pvp-zones Codex 'We should add reputation decay for griefers'"
    echo "  ./planner-cli.sh search 'agent'"
    ;;
esac
