const fs = require('fs');
const h = fs.readFileSync('index.html', 'utf8');
const s = h.indexOf('const PLAN=[');
const e = h.indexOf('];', s) + 2;
const fn = new Function(h.substring(s, e) + '\nreturn PLAN;');
const P = fn();
const total = P.reduce((a, s) => a + s.features.length, 0);
console.log('Sections:', P.length, '| Features:', total);

// Verify faction feature updated
const factions = P.flatMap(s => s.features).find(f => f.id === 'factions');
console.log('Factions title:', factions.title);
console.log('Factions desc starts:', factions.desc.substring(0, 80));

// Check details contain 5 factions
const has5 = factions.details.includes('Synthesis Accord') && factions.details.includes('Sylvari Dominion');
console.log('PRD mentions both new factions:', has5);

// Check faction-theme updated
const theme = P.flatMap(s => s.features).find(f => f.id === 'faction-theme');
console.log('Theme desc:', theme.desc.substring(0, 100));

// Check ship-types updated
const ships = P.flatMap(s => s.features).find(f => f.id === 'ship-types');
console.log('Ships desc includes Synthesis:', ships.desc.includes('Synthesis'));

// Verify all features have 9 PRD sections
const allFeatures = P.flatMap(s => s.features);
let issues = 0;
allFeatures.forEach(f => {
  const count = (f.details.match(/modal-section-title/g) || []).length;
  if (count < 9) {
    console.log('  WARNING: ' + f.id + ' has only ' + count + ' PRD sections');
    issues++;
  }
});
if (issues === 0) console.log('All', total, 'features have 9+ PRD sections');

// Re-export JSON
const exportData = {
  meta: {
    title: 'Space Wars 3000 \u2014 Game Design Plan',
    version: '2.4',
    exported_at: new Date().toISOString(),
    total_sections: P.length,
    total_features: total
  },
  sections: P.map(s => ({
    id: s.id, title: s.title, status: s.status,
    feature_count: s.features.length,
    features: s.features.map(f => ({
      id: f.id, title: f.title, status: f.status,
      summary: f.desc, tags: f.tags || [],
      workflow_steps: (f.workflow || []).length,
      has_prd: Boolean(f.details && f.details.includes('modal-section'))
    }))
  }))
};
fs.writeFileSync('spacewars-plan-export.json', JSON.stringify(exportData, null, 2));
console.log('Export: v' + exportData.meta.version + ',', total, 'features');
