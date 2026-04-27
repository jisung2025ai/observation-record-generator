import { NextResponse } from 'next/server';

// Next.js route 최대 실행 시간 150초로 설정
export const maxDuration = 150;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 150초 타임아웃으로 Express 서버에 프록시
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 145000);

    try {
      const EXPRESS_URL = process.env.EXPRESS_SERVER_URL || 'http://localhost:3001';
      const proxyResponse = await fetch(`${EXPRESS_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await proxyResponse.json();

      if (!proxyResponse.ok) {
        return NextResponse.json(
          { success: false, error: data.error || 'Proxy error' },
          { status: proxyResponse.status }
        );
      }

      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { success: false, error: 'NotebookLM 응답 대기 시간 초과 (145초). 다시 시도해주세요.' },
          { status: 504 }
        );
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error('[API] General Server Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
