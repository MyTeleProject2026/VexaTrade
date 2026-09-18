const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const PROFILES = {
  mtp2026: { id: 'mtp2026', name: 'MTP2026 Device OS', orientation: 'portrait' },
  android: { id: 'android', name: 'MTP2026 Android OS', orientation: 'portrait' },
  windows11: { id: 'windows11', name: 'MTP2026 Desktop OS', orientation: 'landscape' },
  gaming: { id: 'gaming', name: 'MTP2026 Gaming OS', orientation: 'landscape' },
};

function bundleUrl(profile) {
  const base = String(process.env.MTP2026_GUEST_RELEASE_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/mtp2026-${profile.id}-arm64-guest.tar.gz` : null;
}
function checksum(profile) {
  const key = `MTP2026_GUEST_SHA256_${profile.id.toUpperCase()}`;
  return String(process.env[key] || '').trim().toLowerCase() || null;
}
function publicManifest(req) {
  const base = String(process.env.MTP2026_GUEST_RELEASE_BASE_URL || '').replace(/\/$/, '');
  const release = String(process.env.MTP2026_GUEST_RELEASE_TAG || 'mtp2026-physical-test');
  const profiles = Object.values(PROFILES).map(p => {
    const url = bundleUrl(p) || (base ? `${base}/mtp2026-${p.id}-arm64-guest.tar.gz` : null);
    return {
      id: p.id, name: p.name, architecture: 'arm64', machine: 'qemu-aarch64-virt',
      orientation: p.orientation, installSlot: `mtp2026-${p.id}`,
      imageRequired: true, physicalTest: true,
      imageSource: url && checksum(p) ? { type: 'tar.gz', url, sha256: checksum(p), releaseTag: release } : null,
      nativeRuntime: { command: 'qemu-system-aarch64', required: true, graphical: true, persistentStorage: true },
      capabilities: ['graphics','input','touch','keyboard','mouse','network','audio','notifications','filesystem','settings','account','store','persistent-storage','recovery']
    };
  });
  return {
    schema: 'mtp2026-v9',
    architecture: 'arm64',
    generatedAt: new Date().toISOString(),
    source: 'VexaTrade',
    physicalTestManifestUrl: base ? `${base}/physical-test-manifest.json` : null,
    guests: Object.fromEntries(profiles.map(p => [p.id, p]))
  };
}
router.get('/mtp2026/guest-manifest.json', (req,res) => {
  const manifest = publicManifest(req);
  const incomplete = Object.values(manifest.guests).filter(g => !g.imageSource?.url || !g.imageSource?.sha256);
  if (incomplete.length) return res.status(503).json({ error:'GUEST_MANIFEST_INCOMPLETE', profiles: incomplete.map(g=>g.id), manifest });
  res.set('Cache-Control','no-store');
  return res.json(manifest);
});
router.get('/mtp2026/guest-profile/:id', (req,res) => {
  const profile=PROFILES[String(req.params.id)];
  if(!profile) return res.status(404).json({error:'GUEST_PROFILE_NOT_FOUND'});
  return res.json(publicManifest(req).guests[profile.id]);
});
router.get('/mtp2026/guest-install-config', (req,res) => {
  const manifest=publicManifest(req);
  return res.json({schema:'mtp2026-install-v1',architecture:'arm64',profiles:Object.values(manifest.guests)});
});
module.exports = router;
