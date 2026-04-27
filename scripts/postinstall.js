#!/usr/bin/env node
// Railway 환경에서만 Playwright Chromium을 설치합니다
import { execSync } from 'child_process';

if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME) {
  console.log('[postinstall] Railway 환경 감지 - Playwright Chromium 설치 중...');
  try {
    execSync('npx playwright install chrome --with-deps', { stdio: 'inherit' });
    console.log('[postinstall] Playwright Chrome 설치 완료');
  } catch (err) {
    console.error('[postinstall] Playwright 설치 실패:', err.message);
    // 설치 실패해도 빌드는 계속 진행
  }
} else {
  console.log('[postinstall] 로컬 환경 - Playwright 자동 설치 건너뜀');
}
