// uploadSailingPerformancePoints.admin.js
// Uses Firebase Admin SDK (bypasses Firestore rules)
// SAFE: only writes to a NEW collection

import admin from 'firebase-admin';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

/* ================= Init Admin ================= */
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(
      fs.readFileSync(
        './serviceAccountKey.json', // <-- rename your key to this
        'utf8'
      )
    )
  )
});

const db = admin.firestore();

/* ================= Upload ================= */
async function upload(csvPath) {
  console.log('='.repeat(60));
  console.log('📤 Uploading Sailing Performance Points (ADMIN)');
  console.log('='.repeat(60));
  console.log(`📄 CSV: ${csvPath}`);

  const file = fs.readFileSync(csvPath, 'utf-8');

  const rows = parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`✅ Parsed ${rows.length} rows`);

  const colRef = db.collection('sailing_performance_points');

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;
  let total = 0;

  for (const r of rows) {
    const ref = colRef.doc();

    batch.set(ref, {
      lat: Number(r.lat),
      lon: Number(r.lon),

      boat_speed: Number(r.boat_speed),
      wind_speed: Number(r.wind_speed),
      wind_dir: Number(r.wind_dir),

      boat_heading: Number(r.boat_heading),
      wind_boat_angle: Number(r.wind_boat_angle),
      angle_bin: r.angle_bin,

      speed_ratio: Number(r.speed_ratio),

      date: r.date,
      gpx_path: r.gpx_path,
      start_time: r.start_time,
      end_time: r.end_time
    });

    count++;
    total++;

    if (count === BATCH_SIZE) {
      await batch.commit();
      console.log(`✅ Uploaded ${total}`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('🎉 DONE');
  console.log('='.repeat(60));
  console.log(`📍 Total uploaded: ${total}`);
}

/* ================= CLI ================= */
const csvPath = process.argv[2];

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('❌ CSV file not found');
  process.exit(1);
}

upload(csvPath)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Upload failed:', err);
    process.exit(1);
  });
