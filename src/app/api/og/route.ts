// OG 메타 추출 프록시.
//
// 작성 페이지에서 사용자가 URL을 입력하면, 클라이언트가 외부 사이트를 직접
// fetch할 수 없으므로(CORS) 이 엔드포인트를 거친다. 익명 SSRF 도구로
// 악용되지 않게 로그인한 사용자만 호출 가능.
//
// GET /api/og?url=<encoded>
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchOgMeta } from '@/lib/og';
import { detectPlatform } from '@/lib/embed';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const meta = await fetchOgMeta(url);
    const platform = detectPlatform(url);
    return NextResponse.json({ ...meta, platform });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
