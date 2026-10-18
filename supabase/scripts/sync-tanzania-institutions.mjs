#!/usr/bin/env node
/**
 * Sync public education institution directories into SmartNekam Supabase.
 * Sources: NECTA CSEE/ACSEE 2025 centres, TCU registered university institutions,
 * and NACTVET registered/accredited institutions. Run locally; never expose the
 * Supabase service-role key in browser code or commit it to source control.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
for (const fileName of ['.env.local', '.env']) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run');
const YEAR = process.env.INSTITUTION_DIRECTORY_YEAR || '2025';
const OUTPUT = path.join(ROOT, 'data', 'tanzania-institutions-preview.json');
const UA = 'SmartNekamInstitutionRegistry/1.0 (institution directory sync; public official register import)';
const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
const report = { startedAt: new Date().toISOString(), sources: {}, notes: [] };

if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL haipo kwenye .env.local.');
if (!SERVICE_KEY && !DRY_RUN) throw new Error('Weka SUPABASE_SERVICE_ROLE_KEY kwenye .env.local (key ya siri ya server tu). Usitumie publishable/anon key kwa import.');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decodeEntities = (s) => s
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const stripHtml = (s) => decodeEntities(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const normalize = (s) => stripHtml(String(s || '')).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
function aliasesFor(name) {
  const aliases = new Set();
  for (const match of String(name || '').matchAll(/\(([A-Z][A-Z0-9&.-]{1,14})\)/g)) aliases.add(match[1]);
  return [...aliases];
}

async function fetchText(url, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8' }, signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
  } catch (error) {
    if (attempt < 3) { await sleep(700 * (attempt + 1)); return fetchText(url, attempt + 1); }
    throw error;
  } finally { clearTimeout(timer); }
}

async function mapLimit(values, concurrency, handler) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= values.length) return;
      try { results[i] = await handler(values[i], i); }
      catch (error) { report.notes.push(`Fetch failed for ${String(values[i])}: ${error instanceof Error ? error.message : String(error)}`); results[i] = null; }
    }
  });
  await Promise.all(workers);
  return results.filter(Boolean).flat();
}

function parseAnchors(html) {
  const out = [];
  for (const match of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripHtml(match[1]);
    if (text) out.push(text);
  }
  return out;
}

function mapNectaSchool(name, code, exam, sourceUrl) {
  const levels = exam === 'ACSEE' ? ['A_LEVEL'] : ['O_LEVEL'];
  const cleaned = name.replace(/\s+(?:CENTRE|CENTER)$/i, '').replace(/\s+/g, ' ').trim();
  const kind = /\bHIGH\s+SCHOOL\b/i.test(cleaned) ? 'HIGH' : 'SECONDARY';
  return { name: cleaned, country: 'Tanzania', aliases: aliasesFor(cleaned), school_type: kind, education_levels: levels, source_code: `NECTA:${code}`, source_name: `NECTA ${exam} ${YEAR}`, source_url: sourceUrl, last_verified_at: new Date().toISOString() };
}

async function fetchNecta(exam) {
  const base = `https://onlinesys.necta.go.tz/results/${YEAR}/${exam.toLowerCase()}/indexfiles/index_`;
  const urls = letters.map((letter) => `${base}${letter}.htm`);
  const pages = await mapLimit(urls, 5, async (url) => {
    const html = await fetchText(url);
    const records = [];
    for (const label of parseAnchors(html)) {
      const match = label.match(/^(.+?)\s*-\s*(S\d{4})\s*$/i);
      if (!match) continue; // Ignore Pxxxx exam-centre aliases; Sxxxx identifies the school.
      const name = match[1].trim();
      if (!/\b(SEC(?:ONDARY)?\.?\s*SCHOOL|HIGH\s*SCHOOL|SCHOOL|SEMINARY|OPEN\s*SCHOOL|ACADEMY)\b/i.test(name)) continue;
      records.push(mapNectaSchool(name, match[2].toUpperCase(), exam, url));
    }
    await sleep(80);
    return records;
  });
  report.sources[`NECTA_${exam}_${YEAR}`] = { rows: pages.length, url: `https://onlinesys.necta.go.tz/results/${YEAR}/${exam.toLowerCase()}/index.htm` };
  return pages;
}

function parseTableRows(html) {
  const all = [];
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  for (const table of tables) {
    for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripHtml(m[1]));
      if (cells.length >= 3 && cells.some(Boolean)) all.push(cells);
    }
  }
  return all;
}

function mapNactvet(cells, pageUrl) {
  // The official directory columns are typically: S/N, Registration No, Institute Name, Town, Status, Details.
  const offset = /^\d+$/.test(cells[0] || '') ? 1 : 0;
  const code = cells[offset] || '';
  const name = cells[offset + 1] || '';
  const town = cells[offset + 2] || '';
  const status = cells[offset + 3] || '';
  if (!name || /registration no|institute name/i.test(name) || name.length < 3) return null;
  if (!/[A-Za-z]/.test(name)) return null;
  const isSecondarySchool = /\b(SEC(?:ONDARY)?\.?\s*SCHOOL|HIGH\s*SCHOOL|SCHOOL|SEMINARY|OPEN\s*SCHOOL|ACADEMY)\b/i.test(name)
  if (isSecondarySchool) {
    return { name: name.trim(), region: null, district: town || null, country: 'Tanzania', aliases: aliasesFor(name), school_type: /\bHIGH\s+SCHOOL\b/i.test(name) ? 'HIGH' : 'SECONDARY', education_levels: ['O_LEVEL'], source_code: code ? `NACTVET:${code.trim()}` : `NACTVET-SCHOOL:${normalize(name)}`, source_name: 'NACTVET registered/accredited institutions', source_url: pageUrl, last_verified_at: new Date().toISOString() }
  }
  const category = /teacher.?s? college|teacher education/i.test(name) ? 'TEACHER_COLLEGE'
    : /vocational|folk development|VETA|training centre|training center/i.test(name) ? 'VOCATIONAL_TRAINING'
    : /technical college|technical institute|institute of technology/i.test(name) ? 'TECHNICAL_COLLEGE'
    : /health|nursing|medical|clinical/i.test(name) ? 'HEALTH_COLLEGE'
    : /college/i.test(name) ? 'TERTIARY_COLLEGE' : 'OTHER_TERTIARY';
  return { name: name.trim(), region: null, country: 'Tanzania', aliases: aliasesFor(name), institution_type: category, source_code: code ? `NACTVET:${code.trim()}` : `NACTVET-NAME:${normalize(name)}`, source_name: 'NACTVET registered/accredited institutions', source_url: pageUrl, registration_status: status || null, _town: town || null, last_verified_at: new Date().toISOString() };
}

async function fetchNactvet() {
  const base = 'https://nactvet.go.tz/index.php/registered-institutions';
  const seen = new Map();
  const readPage = async (url) => {
    const html = await fetchText(url);
    return parseTableRows(html).map((cells) => mapNactvet(cells, url)).filter(Boolean);
  };
  for (const row of await readPage(base)) seen.set(row.source_code || normalize(row.name), row);

  // Follow the site's common ?page=N pagination while it keeps returning new registry rows.
  // Two consecutive pages with no new institution stop the crawl if paging is unsupported.
  let pagesRead = 0;
  let consecutiveNoNew = 0;
  for (let start = 1; start <= 250 && consecutiveNoNew < 2; start += 4) {
    const indexes = [start, start + 1, start + 2, start + 3].filter((page) => page <= 250);
    const pageRows = await mapLimit(indexes, 3, async (page) => {
      const url = `${base}?page=${page}`;
      const rows = await readPage(url);
      await sleep(100);
      return rows.map((row) => ({ ...row, _page: page }));
    });
    const byPage = new Map(indexes.map((page) => [page, []]));
    for (const row of pageRows) byPage.get(row._page)?.push(row);
    for (const page of indexes) {
      const rows = byPage.get(page) || [];
      pagesRead++;
      let added = 0;
      for (const row of rows) {
        const key = row.source_code || normalize(row.name);
        if (!seen.has(key)) { seen.set(key, row); added++; }
        else {
          const old = seen.get(key);
          if (row.registration_status && !old.registration_status) old.registration_status = row.registration_status;
        }
      }
      consecutiveNoNew = added === 0 ? consecutiveNoNew + 1 : 0;
      if (consecutiveNoNew >= 2) break;
    }
  }
  const all = [...seen.values()].map(({ _page, ...row }) => row);
  report.sources.NACTVET = { rows: all.length, pagesRead, url: base, note: 'Orodha rasmi ya registered/accredited institutions; taasisi za sekondari zimetenganishwa na colleges/TVET.' };
  return all;
}

function mapTcu(cells, pageUrl) {
  const data = [...cells];
  const serialIndex = /^\d+$/.test(data[0] || '') ? 0 : -1;
  const name = data[serialIndex === 0 ? 1 : 0] || '';
  if (!name || /name of the university|university institution/i.test(name)) return null;
  const headOffice = data[serialIndex === 0 ? 2 : 1] || '';
  const type = data[serialIndex === 0 ? 3 : 2] || 'UNIVERSITY';
  const status = data[serialIndex === 0 ? 4 : 3] || '';
  if (!/university|college|institute/i.test(`${name} ${type}`)) return null;
  const institutionType = /campus|centre|center/i.test(type) ? 'UNIVERSITY_CAMPUS_OR_CENTRE'
    : /university college/i.test(type) || /university college/i.test(name) ? 'UNIVERSITY_COLLEGE'
    : 'UNIVERSITY';
  return { name: name.trim(), region: headOffice || null, country: 'Tanzania', aliases: aliasesFor(name), institution_type: institutionType, source_code: `TCU:${normalize(name).replace(/ /g, '-')}`, source_name: 'Tanzania Commission for Universities — Registered institutions', source_url: pageUrl, registration_status: status || null, last_verified_at: new Date().toISOString() };
}

async function fetchTcu() {
  const base = 'https://tcu.go.tz/services/accreditation/universities-registered-tanzania';
  const urls = Array.from({ length: 8 }, (_, page) => `${base}?field_head_office_location_value=All&field_university_institution_typ_value=All&order=title&page=${page}&sort=asc`);
  const pages = await mapLimit(urls, 4, async (url) => {
    const html = await fetchText(url);
    const rows = parseTableRows(html).map((cells) => mapTcu(cells, url)).filter(Boolean);
    await sleep(100);
    return rows;
  });
  report.sources.TCU = { rows: pages.length, url: base };
  return pages;
}

function mergeSchools(records) {
  const byCode = new Map();
  const byName = new Map();
  for (const record of records) {
    const code = record.source_code;
    const key = normalize(record.name);
    let current = byCode.get(code) || byName.get(key);
    if (!current) current = { ...record, education_levels: [...record.education_levels] };
    else {
      current.education_levels = [...new Set([...(current.education_levels || []), ...(record.education_levels || [])])];
      if (record.source_name && !current.source_name.includes(record.source_name)) current.source_name += `; ${record.source_name}`;
      if (record.source_url && !current.source_url.includes(record.source_url)) current.source_url = current.source_url;
      if (/HIGH/i.test(record.name)) current.school_type = 'HIGH';
      // If duplicate listings appear from CSEE/ACSEE, prefer the same stable NECTA code.
      if (!current.source_code || (record.source_code.startsWith('NECTA:') && !current.source_code.startsWith('NECTA:'))) current.source_code = record.source_code;
    }
    byCode.set(current.source_code, current);
    byName.set(key, current);
  }
  return [...new Set(byName.values())].map((row) => ({
    name: row.name.slice(0, 180), region: row.region || null, district: row.district || null, country: 'Tanzania',
    school_type: row.school_type || 'SECONDARY', education_levels: [...new Set(row.education_levels || [])], aliases: [...new Set(row.aliases || [])],
    source_code: row.source_code, source_name: row.source_name, source_url: row.source_url,
    last_verified_at: new Date().toISOString(),
  }));
}

function mergeTertiary(records) {
  const byCode = new Map();
  const byName = new Map();
  for (const raw of records) {
    const nameKey = normalize(raw.name);
    const previous = (raw.source_code && byCode.get(raw.source_code)) || byName.get(nameKey);
    let current = previous || { ...raw, aliases: [...(raw.aliases || [])] };
    if (previous) {
      current.aliases = [...new Set([...(current.aliases || []), ...(raw.aliases || [])])];
      if (raw.source_name && !current.source_name.includes(raw.source_name)) current.source_name += `; ${raw.source_name}`;
      if (!current.region && raw.region) current.region = raw.region;
      if (raw.registration_status && !current.registration_status) current.registration_status = raw.registration_status;
      if (/^TCU:/.test(raw.source_code || '') && !/^TCU:/.test(current.source_code || '')) current.source_code = raw.source_code;
      if (current.institution_type === 'OTHER_TERTIARY' && raw.institution_type !== 'OTHER_TERTIARY') current.institution_type = raw.institution_type;
    }
    byName.set(nameKey, current);
    if (current.source_code) byCode.set(current.source_code, current);
  }
  return [...new Set(byName.values())].map(({ _town, ...row }) => ({
    ...row, name: row.name.slice(0, 180), region: row.region || null, country: 'Tanzania',
    aliases: [...new Set(row.aliases || [])], institution_type: row.institution_type || 'UNIVERSITY',
    source_code: row.source_code || `TERTIARY:${normalize(row.name)}`,
    registration_status: row.registration_status || null, last_verified_at: new Date().toISOString(),
  }));
}

async function fetchExisting(table) {
  const collected = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=id,name,region,source_code&limit=1000&offset=${offset}`;
    const response = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Supabase read ${table} failed: HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
    const page = await response.json();
    collected.push(...page);
    if (page.length < 1000) break;
  }
  return collected;
}

function reconcileExisting(incoming, existing) {
  const byCode = new Map(existing.filter((row) => row.source_code).map((row) => [row.source_code, row]));
  const byName = new Map();
  for (const row of existing.filter((item) => !item.source_code)) {
    const key = normalize(row.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }
  return incoming.map((row) => {
    const codeMatch = byCode.get(row.source_code);
    if (codeMatch) return { ...row, id: codeMatch.id };
    const nameMatches = byName.get(normalize(row.name)) || [];
    // Reuse a legacy row only if its normalized name is unique, preserving profile foreign keys.
    if (nameMatches.length === 1) return { ...row, id: nameMatches[0].id };
    return row;
  });
}

async function restUpsert(table, rows) {
  // PostgREST requires one consistent object shape per bulk payload. Split
  // legacy rows (stable existing ID, used to preserve profile foreign keys)
  // from new rows (stable source_code unique key).
  const existingRows = rows.filter((row) => Boolean(row.id));
  const newRows = rows.filter((row) => !row.id);
  let written = 0;
  let batchNumber = 0;
  const sendGroup = async (group, conflictColumn) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictColumn}`;
    for (let i = 0; i < group.length; i += 100) {
      const batch = group.slice(i, i + 100);
      batchNumber += 1;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(batch),
      });
      if (!response.ok) throw new Error(`Supabase upsert ${table} batch ${batchNumber} failed: HTTP ${response.status}: ${(await response.text()).slice(0, 1500)}`);
      written += batch.length;
      process.stdout.write(`\r${table}: ${written}/${rows.length}`);
    }
  };
  await sendGroup(existingRows, 'id');
  await sendGroup(newRows, 'source_code');
  if (rows.length) process.stdout.write('\n');
  return written;
}

console.log(`SmartNekam Tanzania Institution Sync — official public registers (${YEAR})`);
console.log('1/3: Fetching NECTA CSEE + ACSEE school indexes...');
const csee = await fetchNecta('CSEE');
const acsee = await fetchNecta('ACSEE');
const schools = mergeSchools([...csee, ...acsee]);
console.log(`   NECTA: ${schools.length} unique secondary/high-school records from CSEE/ACSEE indexes.`);

console.log('2/3: Fetching NACTVET registered/accredited directory...');
const nactvetAll = await fetchNactvet();
const nactvetSchools = nactvetAll.filter((row) => Array.isArray(row.education_levels));
const nactvet = nactvetAll.filter((row) => !Array.isArray(row.education_levels));
const fullSchools = mergeSchools([...csee, ...acsee, ...nactvetSchools]);
console.log(`   NACTVET: ${nactvetAll.length} records; ${nactvetSchools.length} school records and ${nactvet.length} tertiary records.`);

console.log('3/3: Fetching TCU registered university institutions...');
const tcu = await fetchTcu();
const tertiary = mergeTertiary([...nactvet, ...tcu]);
console.log(`   Tertiary: ${tertiary.length} unique records after de-duplication.`);

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
const preview = { ...report, counts: { secondary_and_high: fullSchools.length, tertiary: tertiary.length }, schools: fullSchools, tertiary };
fs.writeFileSync(OUTPUT, JSON.stringify(preview, null, 2), 'utf8');
console.log(`Preview written to ${path.relative(ROOT, OUTPUT)}.`);

if (DRY_RUN) {
  console.log('DRY RUN: Supabase was not changed. Review the generated JSON and source warnings.');
} else {
  console.log('Uploading to Supabase with service role (local script only)...');
  const [existingSchools, existingTertiary] = await Promise.all([fetchExisting('schools'), fetchExisting('universities')]);
  const reconciledSchools = reconcileExisting(fullSchools, existingSchools);
  const reconciledTertiary = reconcileExisting(tertiary, existingTertiary);
  const schoolsWritten = await restUpsert('schools', reconciledSchools);
  const tertiaryWritten = await restUpsert('universities', reconciledTertiary);
  report.completedAt = new Date().toISOString();
  report.uploaded = { schools: schoolsWritten, tertiary: tertiaryWritten };
  fs.writeFileSync(path.join(ROOT, 'data', 'tanzania-institutions-sync-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`Finished. Uploaded/upserted ${schoolsWritten} schools and ${tertiaryWritten} tertiary institutions.`);
}
console.log('Official-source limits: NECTA lists exam schools for CSEE/ACSEE; TCU lists university institutions; NACTVET lists registered/accredited institutions. This is not a claim that every non-exam or newly opened institution is included. Review source errors/counts before calling the registry exhaustive.');
