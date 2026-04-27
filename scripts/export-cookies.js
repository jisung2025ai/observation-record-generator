#!/usr/bin/env node
/**
 * 로컬 notebooklm-mcp Chrome 프로필에서 쿠키를 추출하여
 * 플랫폼 독립적인 JSON 형태(Playwright storageState)로 저장합니다.
 * 
 * 실행: node scripts/export-cookies.js
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import path from 'path';
import os from 'os';

const platform = os.platform();
let profileDir;

if (platform === 'win32') {
  profileDir = path.join(process.env.LOCALAPPDATA, 'notebooklm-mcp', 'Data', 'chrome_profile');
} else {
  profileDir = path.join(os.homedir(), '.local', 'share', 'notebooklm-mcp', 'Data', 'chrome_profile');
}

console.log(`[Export] 프로필 경로: ${profileDir}`);

let context;
try {
  context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // Chrome 배포판 사용 (notebooklm-mcp와 동일)
    channel: 'chrome',
  });

  // Google 관련 쿠키 포함 전체 storageState 추출 (DPAPI 자동 복호화됨)
  const state = await context.storageState();

  // Google 인증 쿠키 필터링 (필수 쿠키만)
  const googleCookies = state.cookies.filter(c =>
    c.domain.includes('google.com') ||
    c.domain.includes('accounts.google.com') ||
    c.domain.includes('notebooklm.google.com')
  );

  console.log(`[Export] 전체 쿠키: ${state.cookies.length}개`);
  console.log(`[Export] Google 쿠키: ${googleCookies.length}개`);

  const exportState = {
    cookies: googleCookies,
    origins: state.origins || []
  };

  // storage_state.json으로 저장
  const outPath = path.join(process.cwd(), 'scripts', 'storage_state.json');
  writeFileSync(outPath, JSON.stringify(exportState, null, 2), 'utf8');
  console.log(`[Export] 저장 완료: ${outPath}`);

  // Base64 인코딩 (Railway 환경변수용)
  const json = JSON.stringify(exportState);
  const compressed = await compress(json);
  const base64 = compressed.toString('base64');
  console.log(`\n[Export] Railway 환경변수 값:`);
  console.log(`길이: ${base64.length}자 (32768 제한: ${base64.length <= 32768 ? '통과 ✅' : '초과 ❌'})`);

  // 클립보드 복사 (Windows)
  if (platform === 'win32') {
    const { execSync } = await import('child_process');
    try {
      execSync(`echo ${base64} | clip`);
      console.log('클립보드에 복사됨 ✅');
    } catch {
      // 클립보드 실패 시 파일로 저장
      writeFileSync(path.join(process.cwd(), 'scripts', 'storage_state_b64.tmp'), base64, 'ascii');
      console.log('클립보드 실패 → scripts/storage_state_b64.tmp 파일로 저장됨');
    }
  }

} catch (err) {
  console.error('[Export] 오류:', err.message);
  process.exit(1);
} finally {
  if (context) await context.close();
}

async function compress(str) {
  const { gzip } = await import('zlib');
  const { promisify } = await import('util');
  const gzipAsync = promisify(gzip);
  return gzipAsync(Buffer.from(str, 'utf8'));
}
